#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# dev-pipeline/run.sh - Autonomous Dev Pipeline Runner
#
# Drives the prizm-dev-team multi-agent team through iterative
# AI CLI sessions (CodeBuddy or Claude Code) to build a complete app
# from a feature list.
#
# Usage:
#   ./run.sh run [feature-list.json]            Run all features
#   ./run.sh run <feature-id> [options]         Run a single feature
#   ./run.sh status [feature-list.json]         Show pipeline status
#   ./run.sh reset                              Clear all state
#
# Environment Variables:
#   MAX_RETRIES           Max retries per feature (default: 3)
#   SESSION_TIMEOUT       Session timeout in seconds (default: 0 = no limit)
#   AI_CLI                AI CLI command name (override; also readable from .prizmkit/config.json)
#   CODEBUDDY_CLI         Legacy alias for AI_CLI (deprecated, use AI_CLI instead)
#   PRIZMKIT_PLATFORM     Force platform: 'codebuddy' or 'claude' (auto-detected)
#   MODEL                 AI model to use (e.g. claude-opus-4.6, claude-sonnet-4.6, claude-haiku-4.5)
#   VERBOSE               Set to 1 to enable --verbose on AI CLI (shows subagent output)
#   HEARTBEAT_INTERVAL    Heartbeat log interval in seconds (default: 30)
#   HEARTBEAT_STALE_THRESHOLD  Heartbeat stale threshold in seconds (default: 600)
#   LOG_CLEANUP_ENABLED   Run periodic log cleanup (default: 1)
#   LOG_RETENTION_DAYS    Delete logs older than N days (default: 14)
#   LOG_MAX_TOTAL_MB      Keep total logs under N MB via oldest-first cleanup (default: 1024)
#   PIPELINE_MODE         Override mode for all features: lite|standard|full|self-evolve (used by daemon)
#   DEV_BRANCH            Custom dev branch name (default: auto-generated dev/{feature_id}-YYYYMMDDHHmm)
#   AUTO_PUSH             Auto-push to remote after successful feature (default: 0). Set to 1 to enable.
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_DIR="$SCRIPT_DIR/state"
SCRIPTS_DIR="$SCRIPT_DIR/scripts"

# Configuration (override via environment variables)
MAX_RETRIES=${MAX_RETRIES:-3}
SESSION_TIMEOUT=${SESSION_TIMEOUT:-0}
HEARTBEAT_STALE_THRESHOLD=${HEARTBEAT_STALE_THRESHOLD:-600}
HEARTBEAT_INTERVAL=${HEARTBEAT_INTERVAL:-30}
LOG_CLEANUP_ENABLED=${LOG_CLEANUP_ENABLED:-1}
LOG_RETENTION_DAYS=${LOG_RETENTION_DAYS:-14}
LOG_MAX_TOTAL_MB=${LOG_MAX_TOTAL_MB:-1024}
VERBOSE=${VERBOSE:-0}
MODEL=${MODEL:-""}
DEV_BRANCH=${DEV_BRANCH:-""}
AUTO_PUSH=${AUTO_PUSH:-0}

# Source shared common helpers (CLI/platform detection + logs + deps)
source "$SCRIPT_DIR/lib/common.sh"
prizm_detect_cli_and_platform

# Source shared heartbeat library
source "$SCRIPT_DIR/lib/heartbeat.sh"

# Source shared branch library
source "$SCRIPT_DIR/lib/branch.sh"

# Detect stream-json support
detect_stream_json_support "$CLI_CMD"

# Feature list path (set in main, used by cleanup trap)
FEATURE_LIST=""

# Branch tracking (for cleanup on interrupt)
_ORIGINAL_BRANCH=""
_DEV_BRANCH_NAME=""

# ============================================================
# Shared: Spawn an AI CLI session and wait for result
# ============================================================

# Spawns an AI CLI session with heartbeat + timeout, waits for completion,
# checks session status, and updates feature status.
#
# Arguments:
#   $1 - feature_id
#   $2 - feature_list (absolute path)
#   $3 - session_id
#   $4 - bootstrap_prompt (path)
#   $5 - session_dir
#   $6 - max_retries (for status update)
spawn_and_wait_session() {
    local feature_id="$1"
    local feature_list="$2"
    local session_id="$3"
    local bootstrap_prompt="$4"
    local session_dir="$5"
    local max_retries="$6"
    local feature_model="${7:-}"

    local session_log="$session_dir/logs/session.log"
    local progress_json="$session_dir/logs/progress.json"

    # Spawn AI CLI session
    local verbose_flag=""
    if [[ "$VERBOSE" == "1" ]]; then
        verbose_flag="--verbose"
    fi

    local stream_json_flag=""
    if [[ "$USE_STREAM_JSON" == "true" ]]; then
        stream_json_flag="--output-format stream-json"
        # claude-internal requires --verbose when using stream-json with -p/--print
        verbose_flag="--verbose"
    fi

    local model_flag=""
    local effective_model="${feature_model:-$MODEL}"
    if [[ -n "$effective_model" ]]; then
        model_flag="--model $effective_model"
    fi

    # Unset CLAUDECODE to prevent "nested session" error when launched from
    # within an existing Claude Code session (e.g. via launch-daemon.sh).
    unset CLAUDECODE 2>/dev/null || true

    case "$CLI_CMD" in
        *claude*)
            # Claude Code: prompt via -p argument, --dangerously-skip-permissions for auto-accept
            "$CLI_CMD" \
                -p "$(cat "$bootstrap_prompt")" \
                --dangerously-skip-permissions \
                $verbose_flag \
                $stream_json_flag \
                $model_flag \
                > "$session_log" 2>&1 &
            ;;
        *)
            # CodeBuddy (cbc) and others: prompt via stdin
            "$CLI_CMD" \
                --print \
                -y \
                $verbose_flag \
                $stream_json_flag \
                $model_flag \
                < "$bootstrap_prompt" \
                > "$session_log" 2>&1 &
            ;;
    esac
    local cbc_pid=$!

    # Start progress parser (no-op if stream-json not supported)
    start_progress_parser "$session_log" "$progress_json" "$SCRIPTS_DIR"
    local parser_pid="${_PARSER_PID:-}"

    # Timeout watchdog (only if SESSION_TIMEOUT > 0)
    local watcher_pid=""
    if [[ $SESSION_TIMEOUT -gt 0 ]]; then
        ( sleep "$SESSION_TIMEOUT" && kill -TERM "$cbc_pid" 2>/dev/null ) &
        watcher_pid=$!
    fi

    # Heartbeat monitor (reads progress.json when available, falls back to tail)
    start_heartbeat "$cbc_pid" "$session_log" "$progress_json" "$HEARTBEAT_INTERVAL"
    local heartbeat_pid="${_HEARTBEAT_PID:-}"

    # Wait for AI CLI to finish
    local exit_code=0
    if wait "$cbc_pid" 2>/dev/null; then
        exit_code=0
    else
        exit_code=$?
    fi

    # Clean up watcher, heartbeat, and parser
    [[ -n "$watcher_pid" ]] && kill "$watcher_pid" 2>/dev/null || true
    stop_heartbeat "$heartbeat_pid"
    stop_progress_parser "$parser_pid"
    [[ -n "$watcher_pid" ]] && wait "$watcher_pid" 2>/dev/null || true

    # Map SIGTERM (143) to timeout code 124
    if [[ $exit_code -eq 143 ]]; then
        exit_code=124
    fi

    # Show final session summary
    if [[ -f "$session_log" ]]; then
        local final_size=$(wc -c < "$session_log" 2>/dev/null | tr -d ' ')
        local final_lines=$(wc -l < "$session_log" 2>/dev/null | tr -d ' ')
        log_info "Session log: $final_lines lines, $((final_size / 1024))KB"
    fi
    log_info "exit_code=$exit_code"

    # ── Determine session outcome from observable signals ──────────────
    # No dependency on session-status.json — uses exit code, git commits,
    # and working tree cleanliness as the single source of truth.
    local session_status
    local project_root
    project_root="$(cd "$SCRIPT_DIR/.." && pwd)"
    local default_branch
    default_branch=$(git -C "$project_root" symbolic-ref refs/remotes/origin/HEAD 2>/dev/null \
        | sed 's@^refs/remotes/origin/@@') \
        || default_branch=$(git -C "$project_root" rev-parse --abbrev-ref HEAD 2>/dev/null | grep -E '^(main|master)$' || echo "main")

    if [[ $exit_code -eq 124 ]]; then
        log_warn "Session timed out after ${SESSION_TIMEOUT}s"
        session_status="timed_out"
    elif [[ $exit_code -ne 0 ]]; then
        log_warn "Session exited with code $exit_code"
        session_status="crashed"
    else
        # Exit code 0 — check if the session actually produced commits
        local has_commits=""
        if git -C "$project_root" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
            has_commits=$(git -C "$project_root" log "${default_branch}..HEAD" --oneline 2>/dev/null | head -1)
        fi

        if [[ -n "$has_commits" ]]; then
            session_status="success"
        else
            # No commits found — check if there are uncommitted changes (session
            # did work but didn't commit, e.g. context window exhausted)
            local uncommitted=""
            uncommitted=$(git -C "$project_root" status --porcelain 2>/dev/null | head -1 || true)
            if [[ -n "$uncommitted" ]]; then
                log_warn "Session exited cleanly but produced no commits (uncommitted changes found) — auto-committing..."
                git -C "$project_root" add -A 2>/dev/null || true
                if git -C "$project_root" commit --no-verify -m "chore($feature_id): auto-commit session work" 2>/dev/null; then
                    log_info "Auto-commit succeeded"
                    session_status="success"
                else
                    log_warn "Auto-commit failed — no changes to commit"
                    session_status="crashed"
                fi
            else
                log_warn "Session exited cleanly but produced no commits and no changes"
                session_status="crashed"
            fi
        fi
    fi

    # ── Post-success validation ──────────────────────────────────────────
    if [[ "$session_status" == "success" ]]; then
        if git -C "$project_root" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
            # Auto-commit any remaining dirty files produced during the session
            local dirty_files=""
            dirty_files=$(git -C "$project_root" status --porcelain 2>/dev/null || true)
            if [[ -n "$dirty_files" ]]; then
                log_info "Auto-committing remaining session artifacts..."
                git -C "$project_root" add -A 2>/dev/null || true
                git -C "$project_root" commit --no-verify --amend --no-edit -a 2>/dev/null \
                    || git -C "$project_root" commit --no-verify -m "chore($feature_id): include remaining session artifacts" 2>/dev/null \
                    || true
            fi
        fi
    fi

    log_info "Session result: $session_status"

    # Write lightweight session summary for post-session inspection
    local feature_slug
    feature_slug=$(python3 -c "
import json, re, sys
flist, fid = sys.argv[1], sys.argv[2]
with open(flist) as f:
    data = json.load(f)
for feat in data.get('features', []):
    if feat.get('id') == fid:
        fnum = feat['id'].replace('F-', '').replace('f-', '').zfill(3)
        title = feat.get('title', '').lower()
        title = re.sub(r'[^a-z0-9\s-]', '', title)
        title = re.sub(r'[\s]+', '-', title.strip())
        title = re.sub(r'-+', '-', title).strip('-')
        print(f'{fnum}-{title}')
        sys.exit(0)
sys.exit(1)
" "$feature_list" "$feature_id" 2>/dev/null) || {
        log_warn "Could not resolve feature slug for $feature_id — session summary and artifact validation will be skipped"
        feature_slug=""
    }

    # Validate key artifacts exist after successful session
    if [[ "$session_status" == "success" && -n "$feature_slug" ]]; then
        local project_root_for_artifacts
        project_root_for_artifacts="$(cd "$SCRIPT_DIR/.." && pwd)"
        local context_snapshot="$project_root_for_artifacts/.prizmkit/specs/${feature_slug}/context-snapshot.md"
        local plan_file="$project_root_for_artifacts/.prizmkit/specs/${feature_slug}/plan.md"

        if [[ ! -f "$context_snapshot" ]]; then
            log_warn "ARTIFACT_MISSING: context-snapshot.md not found at $context_snapshot"
        fi
        if [[ ! -f "$plan_file" ]]; then
            log_warn "ARTIFACT_MISSING: plan.md not found at $plan_file"
        fi
    fi

    # Update feature status
    local update_output
    update_output=$(python3 "$SCRIPTS_DIR/update-feature-status.py" \
        --feature-list "$feature_list" \
        --state-dir "$STATE_DIR" \
        --feature-id "$feature_id" \
        --session-status "$session_status" \
        --session-id "$session_id" \
        --max-retries "$max_retries" \
        --action update 2>&1) || {
        log_error "Failed to update feature status: $update_output"
        log_error "feature-list.json may be out of sync. Manual intervention needed."
    }

    # Return status via global variable (avoids $() swallowing stdout)
    _SPAWN_RESULT="$session_status"
}

# ============================================================
# Graceful Shutdown
# ============================================================

cleanup() {
    echo ""
    log_warn "Received interrupt signal. Saving state..."

    # Kill all child processes (claude-internal, heartbeat, progress parser, etc.)
    kill 0 2>/dev/null || true

    # Log current branch info for recovery
    if [[ -n "$_DEV_BRANCH_NAME" ]]; then
        log_info "Development was on branch: $_DEV_BRANCH_NAME"
        log_info "Original branch was: $_ORIGINAL_BRANCH"
    fi

    if [[ -n "$FEATURE_LIST" && -f "$FEATURE_LIST" ]]; then
        python3 "$SCRIPTS_DIR/update-feature-status.py" \
            --feature-list "$FEATURE_LIST" \
            --state-dir "$STATE_DIR" \
            --action pause 2>/dev/null || true
    fi

    log_info "Pipeline paused. Run './run.sh run' to resume."
    exit 130
}
trap cleanup SIGINT SIGTERM

# ============================================================
# Dependency Check
# ============================================================

check_dependencies() {
    prizm_check_common_dependencies "$CLI_CMD"
}

run_log_cleanup() {
    if [[ "$LOG_CLEANUP_ENABLED" != "1" ]]; then
        return 0
    fi

    local cleanup_result
    cleanup_result=$(python3 "$SCRIPTS_DIR/cleanup-logs.py" \
        --state-dir "$STATE_DIR" \
        --retention-days "$LOG_RETENTION_DAYS" \
        --max-total-mb "$LOG_MAX_TOTAL_MB" 2>/dev/null) || {
        log_warn "Log cleanup failed (continuing)"
        return 0
    }

    local deleted reclaimed_kb
    deleted=$(echo "$cleanup_result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('deleted_files', 0))" 2>/dev/null || echo "0")
    reclaimed_kb=$(echo "$cleanup_result" | python3 -c "import sys,json; print(int(json.load(sys.stdin).get('reclaimed_bytes', 0)/1024))" 2>/dev/null || echo "0")

    if [[ "$deleted" -gt 0 ]]; then
        log_info "Log cleanup: deleted $deleted files, reclaimed ${reclaimed_kb}KB"
    fi
}

# ============================================================
# run-one: Run a single feature with full control
# ============================================================

run_one() {
    local feature_id=""
    local feature_list=""
    local dry_run=false
    local resume_phase=""
    local mode_override=""
    local do_clean=false
    local no_reset=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --dry-run)
                dry_run=true
                shift
                ;;
            --resume-phase)
                shift
                if [[ $# -eq 0 ]]; then
                    log_error "--resume-phase requires a value"
                    exit 1
                fi
                resume_phase="$1"
                shift
                ;;
            --mode)
                shift
                if [[ $# -eq 0 ]]; then
                    log_error "--mode requires a value (lite|standard|full)"
                    exit 1
                fi
                case "$1" in
                    lite|standard|full|self-evolve)
                        mode_override="$1"
                        ;;
                    *)
                        log_error "Invalid mode: $1 (must be lite, standard, full, or self-evolve)"
                        exit 1
                        ;;
                esac
                shift
                ;;
            --clean)
                do_clean=true
                shift
                ;;
            --no-reset)
                no_reset=true
                shift
                ;;
            --timeout)
                shift
                if [[ $# -eq 0 ]]; then
                    log_error "--timeout requires a value in seconds"
                    exit 1
                fi
                SESSION_TIMEOUT="$1"
                shift
                ;;
            F-*|f-*)
                feature_id="$1"
                shift
                ;;
            *)
                feature_list="$1"
                shift
                ;;
        esac
    done

    # Validate required args
    if [[ -z "$feature_id" ]]; then
        log_error "Feature ID is required (e.g. F-007)"
        echo ""
        show_help
        exit 1
    fi

    # Default feature list
    if [[ -z "$feature_list" ]]; then
        feature_list="feature-list.json"
    fi

    # Resolve to absolute path
    if [[ ! "$feature_list" = /* ]]; then
        feature_list="$(pwd)/$feature_list"
    fi

    FEATURE_LIST="$feature_list"

    # Default resume phase
    if [[ -z "$resume_phase" ]]; then
        resume_phase="null"
    fi

    # Validation
    if [[ ! -f "$feature_list" ]]; then
        log_error "Feature list not found: $feature_list"
        exit 1
    fi

    check_dependencies
    run_log_cleanup

    # Initialize pipeline state if needed (same logic as run_all)
    if [[ ! -f "$STATE_DIR/pipeline.json" ]]; then
        log_info "Initializing pipeline state for single-feature run..."
        local init_result
        init_result=$(python3 "$SCRIPTS_DIR/init-pipeline.py" \
            --feature-list "$feature_list" \
            --state-dir "$STATE_DIR" 2>&1)

        local init_valid
        init_valid=$(echo "$init_result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('valid', False))" 2>/dev/null || echo "False")

        if [[ "$init_valid" != "True" ]]; then
            log_error "Pipeline initialization failed:"
            echo "$init_result"
            exit 1
        fi

        local features_count
        features_count=$(echo "$init_result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('features_count', 0))" 2>/dev/null || echo "0")
        log_success "Pipeline initialized with $features_count features"
    fi

    # Auto-detect framework repo: if scripts/bundle.js exists, enable self-evolve mode
    local project_root
    project_root=$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || echo "")
    if [[ -z "$mode_override" && -n "$project_root" && -f "$project_root/scripts/bundle.js" ]]; then
        log_info "Detected PrizmKit framework repo — auto-enabling self-evolve mode"
        mode_override="self-evolve"
    fi

    # Verify feature exists
    local feature_title
    feature_title=$(python3 -c "
import json, sys
feature_list_path, fid = sys.argv[1], sys.argv[2]
with open(feature_list_path) as f:
    data = json.load(f)
for feat in data.get('features', []):
    if feat.get('id') == fid:
        print(feat.get('title', ''))
        sys.exit(0)
sys.exit(1)
" "$feature_list" "$feature_id" 2>/dev/null) || {
        log_error "Feature $feature_id not found in $feature_list"
        exit 1
    }

    # Optional Clean
    if [[ "$do_clean" == true ]]; then
        if [[ "$dry_run" == true ]]; then
            log_warn "Dry-run mode: --clean ignored (no artifacts will be deleted)"
        else
            log_info "Cleaning artifacts for $feature_id..."

            local feature_slug
            feature_slug=$(python3 -c "
import json, re, sys
feature_list_path, fid = sys.argv[1], sys.argv[2]
with open(feature_list_path) as f:
    data = json.load(f)
for feat in data.get('features', []):
    if feat.get('id') == fid:
        fnum = feat['id'].replace('F-', '').replace('f-', '').zfill(3)
        title = feat.get('title', '').lower()
        title = re.sub(r'[^a-z0-9\s-]', '', title)
        title = re.sub(r'[\s]+', '-', title.strip())
        title = re.sub(r'-+', '-', title).strip('-')
        print(f'{fnum}-{title}')
        sys.exit(0)
sys.exit(1)
" "$feature_list" "$feature_id" 2>/dev/null) || {
                log_warn "Could not determine feature slug for cleanup"
                feature_slug=""
            }

            local project_root
            project_root="$(cd "$SCRIPT_DIR/.." && pwd)"

            if [[ -n "$feature_slug" ]]; then
                local specs_dir="$project_root/.prizmkit/specs/$feature_slug"
                if [[ -d "$specs_dir" ]]; then
                    rm -rf "$specs_dir"
                    log_info "Removed $specs_dir"
                fi
            fi

            local dev_team_dir="$project_root/.dev-team"
            if [[ -d "$dev_team_dir" ]]; then
                rm -rf "$dev_team_dir"
                log_info "Removed $dev_team_dir"
            fi

            local feature_state_dir="$STATE_DIR/features/$feature_id"
            if [[ -d "$feature_state_dir" ]]; then
                rm -rf "$feature_state_dir"
                log_info "Removed $feature_state_dir"
            fi
        fi
    fi

    # Reset Status
    if [[ "$no_reset" == false && "$dry_run" == false ]]; then
        log_info "Resetting $feature_id status..."
        python3 "$SCRIPTS_DIR/update-feature-status.py" \
            --feature-list "$feature_list" \
            --state-dir "$STATE_DIR" \
            --feature-id "$feature_id" \
            --action reset >/dev/null 2>&1 || {
            log_warn "Failed to reset feature status (may already be pending)"
        }
    elif [[ "$dry_run" == true && "$no_reset" == false ]]; then
        log_info "Dry-run mode: skipping status reset"
    fi

    # Generate Bootstrap Prompt
    local run_id session_id session_dir bootstrap_prompt
    run_id=$(jq -r '.run_id' "$STATE_DIR/pipeline.json")
    session_id="${feature_id}-$(date +%Y%m%d%H%M%S)"
    session_dir="$STATE_DIR/features/$feature_id/sessions/$session_id"
    mkdir -p "$session_dir/logs"

    bootstrap_prompt="$session_dir/bootstrap-prompt.md"

    local prompt_args=(
        --feature-list "$feature_list"
        --feature-id "$feature_id"
        --session-id "$session_id"
        --run-id "$run_id"
        --retry-count 0
        --resume-phase "$resume_phase"
        --state-dir "$STATE_DIR"
        --output "$bootstrap_prompt"
    )

    if [[ -n "$mode_override" ]]; then
        prompt_args+=(--mode "$mode_override")
    fi

    log_info "Generating bootstrap prompt..."
    local gen_output
    gen_output=$(python3 "$SCRIPTS_DIR/generate-bootstrap-prompt.py" "${prompt_args[@]}" 2>/dev/null) || {
        log_error "Failed to generate bootstrap prompt for $feature_id"
        return 1
    }
    local feature_model
    feature_model=$(echo "$gen_output" | python3 -c "import json,sys; print(json.load(sys.stdin).get('model',''))" 2>/dev/null || echo "")

    # Dry-Run: Print info and exit
    if [[ "$dry_run" == true ]]; then
        echo ""
        echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
        echo -e "${BOLD}  Dry Run: $feature_id — $feature_title${NC}"
        echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
        echo ""
        log_info "Session ID:    $session_id"
        log_info "Resume Phase:  $resume_phase"
        if [[ -n "$mode_override" ]]; then
            log_info "Mode Override: $mode_override"
        else
            log_info "Mode:          auto-detect (from complexity)"
        fi
        if [[ -n "$feature_model" ]]; then
            log_info "Feature Model: $feature_model"
        elif [[ -n "${MODEL:-}" ]]; then
            log_info "Model (env):   $MODEL"
        else
            log_info "Model:         (CLI default)"
        fi
        echo ""
        log_info "Bootstrap prompt written to:"
        echo "  $bootstrap_prompt"
        echo ""

        local prompt_lines
        prompt_lines=$(wc -l < "$bootstrap_prompt" | tr -d ' ')
        log_info "Prompt: $prompt_lines lines"
        echo ""
        echo -e "${BOLD}--- Session Context (from prompt) ---${NC}"
        sed -n '/^## Session Context/,/^##[^#]/p' "$bootstrap_prompt" | head -20
        echo -e "${BOLD}--- end ---${NC}"
        echo ""

        log_success "Dry run complete. Inspect full prompt with:"
        echo "  cat $bootstrap_prompt"
        return 0
    fi

    # Spawn AI CLI Session
    echo ""
    echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}  Run: $feature_id — $feature_title${NC}"
    echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
    log_info "AI CLI: $CLI_CMD (platform: $PLATFORM)"
    log_info "Session ID: $session_id"
    log_info "Resume Phase: $resume_phase"
    local effective_model="${feature_model:-$MODEL}"
    if [[ -n "$effective_model" ]]; then
        log_info "Model: $effective_model"
    else
        log_info "Model: (CLI default)"
    fi
    if [[ -n "$mode_override" ]]; then
        log_info "Mode Override: $mode_override"
    fi
    if [[ $SESSION_TIMEOUT -gt 0 ]]; then
        log_info "Session timeout: ${SESSION_TIMEOUT}s"
    else
        log_info "Session timeout: none"
    fi
    log_info "Prompt: $bootstrap_prompt"
    log_info "Log: $session_dir/logs/session.log"
    echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
    echo ""

    # Override cleanup trap for single-feature mode (use distinct name to avoid overwriting global cleanup)
    cleanup_single_feature() {
        echo ""
        log_warn "Interrupted. Killing session..."
        # Kill all child processes
        kill 0 2>/dev/null || true
        # Log current branch info
        if [[ -n "$_DEV_BRANCH_NAME" ]]; then
            log_info "Development was on branch: $_DEV_BRANCH_NAME"
        fi
        log_info "Session log: $session_dir/logs/session.log"
        exit 130
    }
    trap cleanup_single_feature SIGINT SIGTERM

    _SPAWN_RESULT=""

    # Branch lifecycle: create and checkout feature branch
    local _proj_root
    _proj_root="$(cd "$SCRIPT_DIR/.." && pwd)"
    local _source_branch
    _source_branch=$(git -C "$_proj_root" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
    _ORIGINAL_BRANCH="$_source_branch"

    local _branch_name="${DEV_BRANCH:-dev/${feature_id}-$(date +%Y%m%d%H%M)}"
    if branch_create "$_proj_root" "$_branch_name" "$_source_branch"; then
        _DEV_BRANCH_NAME="$_branch_name"
    else
        log_warn "Failed to create branch; running session on current branch"
    fi

    spawn_and_wait_session \
        "$feature_id" "$feature_list" "$session_id" \
        "$bootstrap_prompt" "$session_dir" 999 "$feature_model"
    local session_status="$_SPAWN_RESULT"

    # Merge dev branch back to original on success
    if [[ "$session_status" == "success" && -n "$_DEV_BRANCH_NAME" ]]; then
        if branch_merge "$_proj_root" "$_DEV_BRANCH_NAME" "$_ORIGINAL_BRANCH" "$AUTO_PUSH"; then
            _DEV_BRANCH_NAME=""
        else
            log_warn "Auto-merge failed — dev branch preserved: $_DEV_BRANCH_NAME"
        fi
    fi

    echo ""
    if [[ "$session_status" == "success" ]]; then
        # Self-evolve mode: run framework validation after successful session
        if [[ "$mode_override" == "self-evolve" ]]; then
            log_info "Self-evolve mode: running framework validation..."
            if bash "$SCRIPTS_DIR/validate-framework.sh" 2>&1; then
                log_success "Framework validation passed"
            else
                log_warn "Framework validation failed — review issues above"
                session_status="framework_validation_failed"
            fi

            # Check for reload_needed marker in session status
            local session_status_file="$session_dir/session-status.json"
            if [[ -f "$session_status_file" ]]; then
                local reload_needed
                reload_needed=$(python3 -c "
import json, sys
with open(sys.argv[1]) as f:
    data = json.load(f)
print(data.get('reload_needed', False))
" "$session_status_file" 2>/dev/null || echo "False")
                if [[ "$reload_needed" == "True" ]]; then
                    echo ""
                    log_warn "╔══════════════════════════════════════════════════════════════╗"
                    log_warn "║  RELOAD NEEDED: This session modified pipeline skills or     ║"
                    log_warn "║  templates that are used by the dev-pipeline itself.          ║"
                    log_warn "║  Changes will take effect in the NEXT session.                ║"
                    log_warn "╚══════════════════════════════════════════════════════════════╝"
                fi
            fi
        fi

        log_success "════════════════════════════════════════════════════"
        log_success "  $feature_id completed successfully!"
        log_success "════════════════════════════════════════════════════"
    else
        log_error "════════════════════════════════════════════════════"
        log_error "  $feature_id result: $session_status"
        log_error "  Review log: $session_dir/logs/session.log"
        log_error "════════════════════════════════════════════════════"
    fi
}

# ============================================================
# Main Loop: Run all features
# ============================================================

main() {
    local feature_list="${1:-feature-list.json}"

    # Resolve to absolute path
    if [[ ! "$feature_list" = /* ]]; then
        feature_list="$(pwd)/$feature_list"
    fi

    FEATURE_LIST="$feature_list"

    # Validate feature list exists
    if [[ ! -f "$feature_list" ]]; then
        log_error "Feature list not found: $feature_list"
        log_info "Create a feature list first using the app-planner skill,"
        log_info "or provide a path: ./run.sh run <path-to-feature-list.json>"
        exit 1
    fi

    # Validate feature-list.json is at project root
    local fl_dir
    fl_dir="$(cd "$(dirname "$feature_list")" && pwd)"
    local project_root
    project_root="$(pwd)"
    if [[ "$fl_dir" != "$project_root" ]]; then
        log_warn "feature-list.json is not at project root ($project_root), found at $fl_dir"
        log_warn "Pipeline expects feature-list.json at project root. Proceeding but results may be unstable."
    fi

    check_dependencies
    run_log_cleanup

    # Initialize pipeline state if needed
    if [[ ! -f "$STATE_DIR/pipeline.json" ]]; then
        log_info "Initializing pipeline state..."
        local init_result
        init_result=$(python3 "$SCRIPTS_DIR/init-pipeline.py" \
            --feature-list "$feature_list" \
            --state-dir "$STATE_DIR" 2>&1)

        local init_valid
        init_valid=$(echo "$init_result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('valid', False))" 2>/dev/null || echo "False")

        if [[ "$init_valid" != "True" ]]; then
            log_error "Pipeline initialization failed:"
            echo "$init_result"
            exit 1
        fi

        local features_count
        features_count=$(echo "$init_result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('features_count', 0))" 2>/dev/null || echo "0")
        log_success "Pipeline initialized with $features_count features"
    else
        log_info "Resuming existing pipeline..."
    fi

    # Auto-detect available models + validate feature model fields
    bash "$SCRIPT_DIR/scripts/detect-models.sh" --quiet 2>/dev/null || true
    if [[ -f ".prizmkit/available-models.json" ]]; then
        python3 "$SCRIPTS_DIR/validate-feature-models.py" \
            --feature-list "$feature_list" \
            --models-file ".prizmkit/available-models.json" 2>&1 | head -5 || true
    fi

    # Print header
    echo ""
    echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}          Dev-Pipeline Runner Started${NC}"
    echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
    log_info "Feature list: $feature_list"
    log_info "Max retries per feature: $MAX_RETRIES"
    if [[ $SESSION_TIMEOUT -gt 0 ]]; then
        log_info "Session timeout: ${SESSION_TIMEOUT}s"
    else
        log_info "Session timeout: none"
    fi
    log_info "AI CLI: $CLI_CMD (platform: $PLATFORM)"
    if [[ -n "${MODEL:-}" ]]; then
        log_info "Default Model: $MODEL"
    fi
    echo -e "${BOLD}════════════════════════════════════════════════════${NC}"
    echo ""

    # Branch lifecycle: each feature gets its own dev branch (created per-iteration below)
    local _proj_root
    _proj_root="$(cd "$SCRIPT_DIR/.." && pwd)"
    local _source_branch
    _source_branch=$(git -C "$_proj_root" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
    _ORIGINAL_BRANCH="$_source_branch"

    # Main processing loop
    local session_count=0

    while true; do
        # Check for stuck features
        local stuck_result
        stuck_result=$(python3 "$SCRIPTS_DIR/detect-stuck.py" \
            --state-dir "$STATE_DIR" \
            --feature-list "$FEATURE_LIST" \
            --max-retries "$MAX_RETRIES" \
            --stale-threshold "$HEARTBEAT_STALE_THRESHOLD" 2>/dev/null || echo '{"stuck_count": 0}')

        local stuck_count
        stuck_count=$(echo "$stuck_result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('stuck_count', 0))" 2>/dev/null || echo "0")

        if [[ "$stuck_count" -gt 0 ]]; then
            log_warn "Detected $stuck_count stuck feature(s):"
            echo "$stuck_result" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for f in data.get('stuck_features', []):
    print(f'  - {f[\"feature_id\"]}: {f[\"reason\"]} — {f[\"suggestion\"]}')
" 2>/dev/null || true
        fi

        # Find next feature to process
        local next_feature
        next_feature=$(python3 "$SCRIPTS_DIR/update-feature-status.py" \
            --feature-list "$feature_list" \
            --state-dir "$STATE_DIR" \
            --max-retries "$MAX_RETRIES" \
            --action get_next 2>/dev/null) || true

        if [[ "$next_feature" == "PIPELINE_COMPLETE" ]]; then
            echo ""
            log_success "════════════════════════════════════════════════════"
            log_success "  All features completed! Pipeline finished."
            log_success "  Total sessions: $session_count"
            log_success "════════════════════════════════════════════════════"
            rm -f "$STATE_DIR/current-session.json"
            break
        fi

        if [[ "$next_feature" == "PIPELINE_BLOCKED" ]]; then
            log_warn "All remaining features are blocked by dependencies or failed."
            log_warn "Run './run.sh status' to see details."
            log_warn "Waiting 60s before re-checking... (Ctrl+C to stop)"
            sleep 60
            continue
        fi

        # Parse feature info
        local feature_id feature_title retry_count resume_phase
        feature_id=$(echo "$next_feature" | jq -r '.feature_id')
        feature_title=$(echo "$next_feature" | jq -r '.title')
        retry_count=$(echo "$next_feature" | jq -r '.retry_count // 0')
        resume_phase=$(echo "$next_feature" | jq -r '.resume_from_phase // "null"')

        echo ""
        echo -e "${BOLD}────────────────────────────────────────────────────${NC}"
        log_info "Feature: ${BOLD}$feature_id${NC} — $feature_title"
        log_info "Retry: $retry_count / $MAX_RETRIES"
        if [[ "$resume_phase" != "null" ]]; then
            log_info "Resuming from Phase $resume_phase"
        fi
        echo -e "${BOLD}────────────────────────────────────────────────────${NC}"

        # Create per-feature dev branch
        local _feature_branch="${DEV_BRANCH:-dev/${feature_id}-$(date +%Y%m%d%H%M)}"
        if branch_create "$_proj_root" "$_feature_branch" "$_ORIGINAL_BRANCH"; then
            _DEV_BRANCH_NAME="$_feature_branch"
            log_info "Dev branch: $_feature_branch"
        else
            log_warn "Failed to create dev branch; running on current branch: $_ORIGINAL_BRANCH"
            _DEV_BRANCH_NAME=""
        fi

        # Generate session ID and bootstrap prompt
        local session_id run_id
        run_id=$(jq -r '.run_id' "$STATE_DIR/pipeline.json")
        session_id="${feature_id}-$(date +%Y%m%d%H%M%S)"

        local session_dir="$STATE_DIR/features/$feature_id/sessions/$session_id"
        mkdir -p "$session_dir/logs"

        local bootstrap_prompt="$session_dir/bootstrap-prompt.md"

        local main_prompt_args=(
            --feature-list "$feature_list"
            --feature-id "$feature_id"
            --session-id "$session_id"
            --run-id "$run_id"
            --retry-count "$retry_count"
            --resume-phase "$resume_phase"
            --state-dir "$STATE_DIR"
            --output "$bootstrap_prompt"
        )

        # Support PIPELINE_MODE env var (set by launch-daemon.sh --mode)
        if [[ -n "${PIPELINE_MODE:-}" ]]; then
            main_prompt_args+=(--mode "$PIPELINE_MODE")
        fi

        # Auto-detect framework repo: if scripts/bundle.js exists, enable self-evolve mode
        if [[ -z "${PIPELINE_MODE:-}" ]]; then
            local _project_root
            _project_root=$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || echo "")
            if [[ -n "$_project_root" && -f "$_project_root/scripts/bundle.js" ]]; then
                if [[ $session_count -eq 0 ]]; then
                    log_info "Detected PrizmKit framework repo — auto-enabling self-evolve mode"
                fi
                main_prompt_args+=(--mode "self-evolve")
            fi
        fi

        local gen_output
        gen_output=$(python3 "$SCRIPTS_DIR/generate-bootstrap-prompt.py" "${main_prompt_args[@]}" 2>/dev/null) || {
            log_error "Failed to generate bootstrap prompt for $feature_id"
            continue
        }
        local feature_model
        feature_model=$(echo "$gen_output" | python3 -c "import json,sys; print(json.load(sys.stdin).get('model',''))" 2>/dev/null || echo "")

        # Update current session tracking (atomic write via temp file)
        python3 -c "
import json, sys, os
from datetime import datetime, timezone
feature_id, session_id, state_dir = sys.argv[1], sys.argv[2], sys.argv[3]
data = {
    'feature_id': feature_id,
    'session_id': session_id,
    'started_at': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
}
target = os.path.join(state_dir, 'current-session.json')
tmp = target + '.tmp'
with open(tmp, 'w') as f:
    json.dump(data, f, indent=2)
os.replace(tmp, target)
" "$feature_id" "$session_id" "$STATE_DIR"

        # Mark feature as in-progress before spawning session
        python3 "$SCRIPTS_DIR/update-feature-status.py" \
            --feature-list "$feature_list" \
            --state-dir "$STATE_DIR" \
            --feature-id "$feature_id" \
            --action start >/dev/null 2>&1 || true

        # Spawn session and wait
        log_info "Spawning AI CLI session: $session_id"
        if [[ -n "$feature_model" ]]; then
            log_info "Feature model: $feature_model"
        fi
        _SPAWN_RESULT=""

        spawn_and_wait_session \
            "$feature_id" "$feature_list" "$session_id" \
            "$bootstrap_prompt" "$session_dir" "$MAX_RETRIES" "$feature_model"
        local session_status="$_SPAWN_RESULT"

        # Merge per-feature dev branch back to original on success
        if [[ "$session_status" == "success" && -n "$_DEV_BRANCH_NAME" ]]; then
            if branch_merge "$_proj_root" "$_DEV_BRANCH_NAME" "$_ORIGINAL_BRANCH" "$AUTO_PUSH"; then
                _DEV_BRANCH_NAME=""
            else
                log_warn "Auto-merge failed — dev branch preserved: $_DEV_BRANCH_NAME"
                log_warn "Merge manually: git checkout $_ORIGINAL_BRANCH && git rebase $_DEV_BRANCH_NAME"
                _DEV_BRANCH_NAME=""
            fi
        elif [[ -n "$_DEV_BRANCH_NAME" ]]; then
            # Session failed — return to original branch, preserve dev branch for inspection
            git -C "$_proj_root" checkout "$_ORIGINAL_BRANCH" 2>/dev/null || true
            log_warn "Session failed — dev branch preserved for inspection: $_DEV_BRANCH_NAME"
            _DEV_BRANCH_NAME=""
        fi

        session_count=$((session_count + 1))

        # Brief pause before next iteration
        log_info "Pausing 5s before next feature..."
        sleep 5
    done
}

# ============================================================
# Entry Point
# ============================================================

show_help() {
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  run [feature-list.json]                 Run all features sequentially"
    echo "  run <feature-id> [options]              Run a single feature"
    echo "  status [feature-list.json]               Show pipeline status"
    echo "  test-cli                                 Test AI CLI: show detected CLI, version, and model"
    echo "  reset                                    Clear all state and start fresh"
    echo "  help                                     Show this help message"
    echo ""
    echo "Single Feature Options (run <feature-id>):"
    echo "  --dry-run                   Generate bootstrap prompt only, don't spawn session"
    echo "  --resume-phase N            Override resume phase (default: auto-detect)"
    echo "  --mode <lite|standard|full|self-evolve> Override pipeline mode (bypasses estimated_complexity)"
    echo "  --clean                     Delete artifacts and reset before running"
    echo "  --no-reset                  Skip feature status reset step"
    echo "  --timeout N                 Session timeout in seconds (default: 0 = no limit)"
    echo ""
    echo "Environment Variables:"
    echo "  MAX_RETRIES           Max retries per feature (default: 3)"
    echo "  SESSION_TIMEOUT       Session timeout in seconds (default: 0 = no limit)"
    echo "  AI_CLI                AI CLI command name (auto-detected: cbc or claude)"
    echo "  MODEL                 AI model ID (e.g. claude-opus-4.6, claude-sonnet-4.6, claude-haiku-4.5)"
    echo "  HEARTBEAT_INTERVAL    Heartbeat log interval in seconds (default: 30)"
    echo "  HEARTBEAT_STALE_THRESHOLD  Heartbeat stale threshold in seconds (default: 600)"
    echo "  LOG_CLEANUP_ENABLED   Run log cleanup before execution (default: 1)"
    echo "  LOG_RETENTION_DAYS    Delete logs older than N days (default: 14)"
    echo "  LOG_MAX_TOTAL_MB      Keep total logs under N MB (default: 1024)"
    echo "  PIPELINE_MODE         Override mode for all features: lite|standard|full|self-evolve"
    echo ""
    echo "Examples:"
    echo "  ./run.sh run                                         # Run all features"
    echo "  ./run.sh run F-007 --dry-run                          # Inspect generated prompt"
    echo "  ./run.sh run F-007 --dry-run --mode lite               # Test lite mode"
    echo "  ./run.sh run F-007 --resume-phase 6                    # Skip to implementation"
    echo "  ./run.sh run F-007 --mode full --timeout 3600          # Full mode, 1h timeout"
    echo "  ./run.sh run F-007 --clean --mode standard             # Clean + run standard"
    echo "  ./run.sh status                                        # Show pipeline status"
    echo "  MAX_RETRIES=5 SESSION_TIMEOUT=7200 ./run.sh run        # Custom config"
    echo "  MODEL=claude-sonnet-4.6 ./run.sh run                    # Use Sonnet model"
    echo "  MODEL=claude-haiku-4.5 ./run.sh test-cli                # Test with Haiku"
}

case "${1:-run}" in
    run|resume)
        shift || true
        # Check if first arg is a feature ID (F-xxx pattern)
        if [[ "${1:-}" =~ ^[Ff]-[0-9]+ ]]; then
            run_one "$@"
        else
            main "${1:-feature-list.json}"
        fi
        ;;
    status)
        check_dependencies
        if [[ ! -f "$STATE_DIR/pipeline.json" ]]; then
            log_error "No pipeline state found. Run './run.sh run' first."
            exit 1
        fi
        python3 "$SCRIPTS_DIR/update-feature-status.py" \
            --feature-list "${2:-feature-list.json}" \
            --state-dir "$STATE_DIR" \
            --action status
        ;;
    test-cli)
        echo ""
        echo "============================================"
        echo "  Dev-Pipeline AI CLI Test"
        echo "============================================"
        echo ""
        echo "  Detected CLI:    $CLI_CMD"
        echo "  Platform:        $PLATFORM"
        if [[ -n "$MODEL" ]]; then
            echo "  Requested Model: $MODEL"
        fi

        # Get CLI version (first line only)
        cli_version=$("$CLI_CMD" -v 2>&1 | head -1 || echo "unknown")
        echo "  CLI Version:     $cli_version"
        echo ""
        echo "  Querying AI model (headless mode)..."

        test_prompt="What AI assistant/platform are you and what model are you running? Reply in one line, e.g. \"I'm Claude Code Claude Opnus x.x\".No extra text."

        local_model_flag=""
        if [[ -n "$MODEL" ]]; then
            local_model_flag="--model $MODEL"
        fi

        # Run headless query with 30s timeout (background + kill pattern for macOS)
        tmpfile=$(mktemp)
        (
            unset CLAUDECODE
            case "$CLI_CMD" in
                *claude*)
                    "$CLI_CMD" -p "$test_prompt" --dangerously-skip-permissions --no-session-persistence $local_model_flag > "$tmpfile" 2>/dev/null
                    ;;
                *)
                    echo "$test_prompt" | "$CLI_CMD" --print -y $local_model_flag > "$tmpfile" 2>/dev/null
                    ;;
            esac
        ) &
        query_pid=$!
        ( sleep 30 && kill "$query_pid" 2>/dev/null ) &
        timer_pid=$!
        wait "$query_pid" 2>/dev/null
        kill "$timer_pid" 2>/dev/null
        wait "$timer_pid" 2>/dev/null || true

        model_reply=$(cat "$tmpfile" 2>/dev/null | head -3)
        rm -f "$tmpfile"

        if [[ -z "$model_reply" ]]; then
            model_reply="(no response — CLI may require auth or is unavailable)"
        fi

        echo ""
        echo "  AI Response:     $model_reply"
        echo ""
        echo "============================================"
        echo ""
        ;;
    reset)
        log_warn "Resetting pipeline state..."
        rm -rf "$STATE_DIR"
        log_success "State cleared. Run './run.sh run' to start fresh."
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        log_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac
