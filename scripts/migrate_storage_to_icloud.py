#!/usr/bin/env python3
"""Copy locally-generated LevelUp assets/exports/backups into iCloud Drive.

This script is additive only: it NEVER deletes or moves local files, it only
copies. Safe to re-run at any time.

What it does:
  1. Ensures the full iCloud directory tree exists (assets/, exports/,
     backups/, documents/ and their subfolders).
  2. Mirrors a local staging directory (default: ./storage) that follows the
     same assets/exports/backups/documents layout into the iCloud tree.
  3. Picks up loose, timestamped database backup files sitting at the repo
     root or in a local ./backups folder (e.g. "supabase_backup_2026-07-06.sql")
     and copies them into LEVELUP_DATABASE_BACKUP_DIR.

What it deliberately skips:
  - .git, node_modules, .venv, __pycache__, .cache, dist, build, tmp, logs,
    .next, .swc, plaid_quickstart, .idea (see EXCLUDED_DIR_NAMES)
  - Active database files (*.sqlite, *.db, ...) unless the filename clearly
    looks like a timestamped backup/snapshot/dump rather than the live DB.

Usage:
    python scripts/migrate_storage_to_icloud.py [--dry-run] [--source DIR]
"""

from __future__ import annotations

import argparse
import re
import shutil
import sys
from dataclasses import dataclass, field
from pathlib import Path

from storage_paths import (
    ACTIVE_DB_EXTENSIONS,
    DATABASE_BACKUP_DIR,
    EXCLUDED_DIR_NAMES,
    EXCLUDED_FILE_NAMES,
    REPO_ROOT,
    STORAGE_DIR,
    ensure_icloud_dirs,
)

BACKUP_NAME_PATTERN = re.compile(r"(backup|snapshot|dump).*\d{4}-?\d{2}-?\d{2}", re.IGNORECASE)
DB_DUMP_EXTENSIONS = {".sql", ".dump", ".gz", ".tar", ".bak"}
STORAGE_TOP_LEVEL_DIRS = {"assets", "exports", "backups", "documents"}


@dataclass
class CopyResult:
    copied: list[tuple[Path, Path]] = field(default_factory=list)
    skipped: list[tuple[Path, str]] = field(default_factory=list)
    bytes_copied: int = 0

    def record_copy(self, src: Path, dest: Path) -> None:
        self.copied.append((src, dest))
        try:
            self.bytes_copied += src.stat().st_size
        except OSError:
            pass

    def record_skip(self, src: Path, reason: str) -> None:
        self.skipped.append((src, reason))


def is_excluded_path(rel_path: Path) -> bool:
    return any(part in EXCLUDED_DIR_NAMES for part in rel_path.parts)


def is_active_db_file(path: Path) -> bool:
    """True for a live database file that must stay local (not a backup)."""
    if path.suffix.lower() not in ACTIVE_DB_EXTENSIONS:
        return False
    return not BACKUP_NAME_PATTERN.search(path.name)


def looks_like_db_backup(path: Path) -> bool:
    if path.suffix.lower() in DB_DUMP_EXTENSIONS:
        return True
    return bool(BACKUP_NAME_PATTERN.search(path.name))


def copy_file(src: Path, dest: Path, dry_run: bool, result: CopyResult) -> None:
    if not dry_run:
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)  # copy2 preserves metadata (mtime, permissions)
    result.record_copy(src, dest)


def migrate_source_tree(source_root: Path, dry_run: bool, result: CopyResult) -> None:
    """Mirror a local staging directory (default ./storage) into the iCloud
    assets/exports/backups/documents tree, preserving the relative subpath."""
    if not source_root.exists():
        return

    for path in sorted(source_root.rglob("*")):
        if path.is_dir():
            continue
        if path.name in EXCLUDED_FILE_NAMES:
            continue

        rel = path.relative_to(source_root)
        if is_excluded_path(rel):
            result.record_skip(path, "excluded directory")
            continue
        if is_active_db_file(path):
            result.record_skip(path, "active database file (not a timestamped backup)")
            continue

        top = rel.parts[0] if rel.parts else ""
        if top not in STORAGE_TOP_LEVEL_DIRS:
            result.record_skip(
                path,
                f"unrecognized top-level folder '{top}' under {source_root} "
                f"(expected one of {sorted(STORAGE_TOP_LEVEL_DIRS)})",
            )
            continue

        dest = STORAGE_DIR / rel
        copy_file(path, dest, dry_run, result)


def migrate_loose_db_backups(dry_run: bool, result: CopyResult) -> None:
    """Pick up loose, timestamped DB dump files sitting at the repo root or in
    a local ./backups folder, without ever touching the active database."""
    candidates: list[Path] = []
    for base in (REPO_ROOT, REPO_ROOT / "backups"):
        if base.exists():
            candidates.extend(p for p in base.glob("*") if p.is_file())

    for path in candidates:
        if path.name in EXCLUDED_FILE_NAMES:
            continue
        rel = path.relative_to(REPO_ROOT)
        if is_excluded_path(rel):
            continue
        if is_active_db_file(path):
            result.record_skip(path, "active database file (not a timestamped backup)")
            continue
        if looks_like_db_backup(path):
            dest = DATABASE_BACKUP_DIR / path.name
            copy_file(path, dest, dry_run, result)


def print_summary(result: CopyResult, dry_run: bool) -> None:
    verb = "Would copy" if dry_run else "Copied"
    print("\n" + "=" * 70)
    print(f"LevelUp storage migration {'(DRY RUN - nothing written)' if dry_run else ''}".rstrip())
    print("=" * 70)
    print(f"iCloud storage root: {STORAGE_DIR}")

    if result.copied:
        mb = result.bytes_copied / (1024 * 1024)
        print(f"\n{verb} {len(result.copied)} file(s), {mb:.2f} MB total:")
        for src, dest in result.copied:
            try:
                shown_src = src.relative_to(REPO_ROOT)
            except ValueError:
                shown_src = src
            print(f"  {shown_src}  ->  {dest}")
    else:
        print(
            "\nNo matching files found to copy. This is expected if you haven't "
            "generated any local assets/exports/backups yet - the iCloud folder "
            "tree has still been created and is ready for future content."
        )

    if result.skipped:
        print(f"\nSkipped {len(result.skipped)} item(s):")
        for src, reason in result.skipped[:20]:
            print(f"  {src} ({reason})")
        if len(result.skipped) > 20:
            print(f"  ... and {len(result.skipped) - 20} more")

    print("\nLocal files were NOT deleted or moved - this script only copies.")
    print("=" * 70 + "\n")


def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--source",
        type=Path,
        default=REPO_ROOT / "storage",
        help="Local staging directory mirroring the assets/exports/backups/documents "
        "layout to copy into iCloud (default: ./storage)",
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="Preview what would be copied without writing anything"
    )
    args = parser.parse_args()

    if args.dry_run:
        print("(dry run: skipping iCloud directory creation)")
    else:
        ensure_icloud_dirs()

    result = CopyResult()
    migrate_source_tree(args.source, args.dry_run, result)
    migrate_loose_db_backups(args.dry_run, result)
    print_summary(result, args.dry_run)
    return 0


if __name__ == "__main__":
    sys.exit(main())
