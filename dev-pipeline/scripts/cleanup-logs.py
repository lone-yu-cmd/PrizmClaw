#!/usr/bin/env python3
"""Clean up pipeline session logs by age and total size.

Targets files under any `.../sessions/.../logs/` directory inside a state dir.

Policies:
1) Remove files older than retention window.
2) If total remaining size still exceeds max threshold, remove oldest files first
   until within threshold.

Usage:
  python3 cleanup-logs.py --state-dir dev-pipeline/state
  python3 cleanup-logs.py --state-dir dev-pipeline/bugfix-state --retention-days 30 --max-total-mb 2048
"""

import argparse
import json
import os
import time

from utils import error_out, setup_logging

LOGGER = setup_logging("cleanup-logs")


def parse_args():
    parser = argparse.ArgumentParser(description="Cleanup pipeline logs by age and total size.")
    parser.add_argument("--state-dir", required=True, help="State directory to scan")
    parser.add_argument(
        "--retention-days",
        type=int,
        default=14,
        help="Delete logs older than this many days (default: 14)",
    )
    parser.add_argument(
        "--max-total-mb",
        type=int,
        default=1024,
        help="Target max total log size in MB after cleanup (default: 1024)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Report actions without deleting")
    return parser.parse_args()


def iter_log_files(state_dir):
    """Yield absolute paths of files inside .../sessions/.../logs/ directories."""
    for root, _dirs, files in os.walk(state_dir):
        if os.path.basename(root) != "logs":
            continue

        normalized = root.replace("\\", "/")
        if "/sessions/" not in normalized:
            continue

        for name in files:
            if name == ".DS_Store":
                continue
            yield os.path.join(root, name)


def file_info(path):
    """Return file metadata dict with path, size, and mtime."""
    st = os.stat(path)
    return {"path": path, "size": st.st_size, "mtime": st.st_mtime}


def remove_file(path, dry_run=False):
    if dry_run:
        return True
    try:
        os.remove(path)
        return True
    except OSError:
        return False


def cleanup_empty_dirs(state_dir, dry_run=False):
    """Remove empty logs directories bottom-up."""
    removed = 0
    for root, dirs, _files in os.walk(state_dir, topdown=False):
        for d in dirs:
            full = os.path.join(root, d)
            if os.path.basename(full) != "logs":
                continue
            try:
                if not os.listdir(full):
                    if not dry_run:
                        os.rmdir(full)
                    removed += 1
            except OSError:
                continue
    return removed


def main():
    args = parse_args()
    state_dir = os.path.abspath(args.state_dir)

    if not os.path.isdir(state_dir):
        error_out("State directory not found: {}".format(state_dir), code=2)

    if args.retention_days < 0:
        error_out("retention-days must be >= 0", code=2)
    if args.max_total_mb < 0:
        error_out("max-total-mb must be >= 0", code=2)

    now = time.time()
    retention_cutoff = now - (args.retention_days * 86400)
    max_total_bytes = args.max_total_mb * 1024 * 1024

    files = []
    for path in iter_log_files(state_dir):
        try:
            files.append(file_info(path))
        except OSError:
            continue

    initial_total = sum(f["size"] for f in files)

    deleted_files = []
    kept_files = []

    # Step 1: age-based cleanup
    for f in files:
        if f["mtime"] < retention_cutoff:
            if remove_file(f["path"], dry_run=args.dry_run):
                deleted_files.append({**f, "reason": "retention"})
            else:
                kept_files.append(f)
        else:
            kept_files.append(f)

    # Step 2: size-based cleanup (oldest first)
    current_total = sum(f["size"] for f in kept_files)
    if current_total > max_total_bytes:
        kept_files.sort(key=lambda x: x["mtime"])  # oldest first
        still_kept = []
        for f in kept_files:
            if current_total <= max_total_bytes:
                still_kept.append(f)
                continue

            if remove_file(f["path"], dry_run=args.dry_run):
                deleted_files.append({**f, "reason": "size"})
                current_total -= f["size"]
            else:
                still_kept.append(f)

        kept_files = still_kept

    removed_empty_log_dirs = cleanup_empty_dirs(state_dir, dry_run=args.dry_run)

    final_total = sum(f["size"] for f in kept_files)
    reclaimed = initial_total - final_total

    report = {
        "success": True,
        "state_dir": state_dir,
        "dry_run": args.dry_run,
        "retention_days": args.retention_days,
        "max_total_mb": args.max_total_mb,
        "initial_files": len(files),
        "deleted_files": len(deleted_files),
        "deleted_by_reason": {
            "retention": sum(1 for f in deleted_files if f["reason"] == "retention"),
            "size": sum(1 for f in deleted_files if f["reason"] == "size"),
        },
        "removed_empty_log_dirs": removed_empty_log_dirs,
        "initial_total_bytes": initial_total,
        "final_total_bytes": final_total,
        "reclaimed_bytes": reclaimed,
    }

    LOGGER.info(
        "cleanup complete: deleted=%s reclaimed=%sKB",
        report["deleted_files"],
        int(report["reclaimed_bytes"] / 1024),
    )

    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        error_out("cleanup-logs interrupted", code=130)
    except SystemExit:
        raise
    except Exception as exc:
        LOGGER.exception("Unhandled exception in cleanup-logs")
        error_out("cleanup-logs failed: {}".format(str(exc)), code=1)
