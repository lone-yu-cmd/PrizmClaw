#!/usr/bin/env bash
# ============================================================
# dev-pipeline/lib/branch.sh - Git Branch Lifecycle Library
#
# Shared by run.sh and run-bugfix.sh for branch-based serial
# development. Each pipeline run creates a dev branch and all
# features/bugs commit directly on it in sequence.
#
# Functions:
#   branch_create  — Create and checkout a new branch
#   branch_return  — Checkout back to original branch
#   branch_merge   — Merge dev branch into original and optionally push
#
# Environment:
#   DEV_BRANCH    — Optional custom branch name override
#   AUTO_PUSH     — Set to 1 to auto-push after successful feature
# ============================================================

# branch_create <project_root> <branch_name> <source_branch>
#
# Creates a new branch from source_branch and checks it out.
# If the branch already exists, checks it out instead.
#
# Returns 0 on success, 1 on failure.
branch_create() {
    local project_root="$1"
    local branch_name="$2"
    local source_branch="$3"

    # Check if branch already exists
    if git -C "$project_root" rev-parse --verify "$branch_name" >/dev/null 2>&1; then
        log_info "Branch already exists: $branch_name — checking out"
        if ! git -C "$project_root" checkout "$branch_name" 2>/dev/null; then
            log_error "Failed to checkout existing branch: $branch_name"
            return 1
        fi
        return 0
    fi

    # Create and checkout new branch
    if ! git -C "$project_root" checkout -b "$branch_name" "$source_branch" 2>/dev/null; then
        log_error "Failed to create branch: $branch_name from $source_branch"
        return 1
    fi

    log_info "Created and checked out branch: $branch_name (from $source_branch)"
    return 0
}

# branch_return <project_root> <original_branch>
#
# Checks out the original branch after pipeline completes.
# Safe to call even if already on the original branch.
#
# Returns 0 on success, 1 on failure.
branch_return() {
    local project_root="$1"
    local original_branch="$2"

    local current_branch
    current_branch=$(git -C "$project_root" rev-parse --abbrev-ref HEAD 2>/dev/null) || {
        log_error "Failed to determine current branch"
        return 1
    }

    if [[ "$current_branch" == "$original_branch" ]]; then
        return 0
    fi

    if ! git -C "$project_root" checkout "$original_branch" 2>/dev/null; then
        log_error "Failed to checkout original branch: $original_branch"
        return 1
    fi

    log_info "Returned to branch: $original_branch"
    return 0
}

# branch_merge <project_root> <dev_branch> <original_branch> [auto_push]
#
# Merges dev_branch into original_branch, then optionally pushes.
# Steps:
#   1. Checkout original_branch
#   2. Merge dev_branch (fast-forward when possible)
#   3. Push to remote if auto_push == "1"
#   4. Delete dev_branch (local only, it's been merged)
#
# Returns 0 on success, 1 on failure.
branch_merge() {
    local project_root="$1"
    local dev_branch="$2"
    local original_branch="$3"
    local auto_push="${4:-0}"

    # Step 1: Checkout original branch
    if ! git -C "$project_root" checkout "$original_branch" 2>/dev/null; then
        log_error "Failed to checkout $original_branch for merge"
        return 1
    fi

    # Step 2: Merge dev branch (fast-forward only — avoids interactive merge commit editor)
    log_info "Merging $dev_branch into $original_branch..."
    if ! git -C "$project_root" merge --ff-only "$dev_branch" 2>&1; then
        log_error "Merge failed (non-fast-forward) — resolve manually:"
        log_error "  git checkout $original_branch && git rebase $dev_branch"
        git -C "$project_root" checkout "$dev_branch" 2>/dev/null || true
        return 1
    fi

    log_success "Merged $dev_branch into $original_branch"

    # Step 3: Push if AUTO_PUSH enabled
    if [[ "$auto_push" == "1" ]]; then
        log_info "Pushing $original_branch to remote..."
        if git -C "$project_root" push 2>/dev/null; then
            log_success "Pushed $original_branch to remote"
        else
            log_warn "Push failed — run 'git push' manually"
        fi
    fi

    # Step 4: Delete merged dev branch
    git -C "$project_root" branch -d "$dev_branch" 2>/dev/null && \
        log_info "Deleted merged branch: $dev_branch" || true

    return 0
}
