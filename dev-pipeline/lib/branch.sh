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
