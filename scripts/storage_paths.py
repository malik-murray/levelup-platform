"""Centralized storage path configuration for local Python tooling.

Mirrors src/lib/storage/paths.ts: the codebase, git repo, .venv, and the
active Supabase connection always stay local. This module only governs
where large/generated/static content lives (media, exports, timestamped DB
backups) so it can be redirected to iCloud Drive via environment variables
instead of hardcoded paths.
"""

from __future__ import annotations

import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]


def _load_dotenv_files() -> None:
    """Best-effort load of .env.local / .env into os.environ (stdlib only,
    no python-dotenv dependency required)."""
    for name in (".env.local", ".env"):
        env_path = REPO_ROOT / name
        if not env_path.exists():
            continue
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            os.environ.setdefault(key, value)


_load_dotenv_files()


def _expand(value: str) -> Path:
    return Path(value).expanduser().resolve()


def _default_icloud_root() -> Path:
    # "Mobile Documents" contains a space; pathlib handles this natively
    # since no shell is involved.
    return (
        Path.home()
        / "Library"
        / "Mobile Documents"
        / "com~apple~CloudDocs"
        / "LevelUpSolutions"
    )


def _resolve(env_var: str, fallback: Path) -> Path:
    value = os.environ.get(env_var, "").strip()
    return _expand(value) if value else fallback


STORAGE_DIR = _resolve("LEVELUP_STORAGE_DIR", _default_icloud_root())
ASSETS_DIR = _resolve("LEVELUP_ASSETS_DIR", STORAGE_DIR / "assets")
EXPORTS_DIR = _resolve("LEVELUP_EXPORTS_DIR", STORAGE_DIR / "exports")
BACKUPS_DIR = _resolve("LEVELUP_BACKUPS_DIR", STORAGE_DIR / "backups")
DATABASE_BACKUP_DIR = _resolve(
    "LEVELUP_DATABASE_BACKUP_DIR", BACKUPS_DIR / "database-backups"
)
DOCUMENTS_DIR = STORAGE_DIR / "documents"

ASSET_SUBDIRS = ["images", "videos", "audio", "thumbnails", "logos", "characters"]
EXPORT_SUBDIRS = ["finished-shorts", "blog-images", "ebook-files"]
BACKUP_SUBDIRS = ["database-backups", "project-snapshots"]
DOCUMENT_SUBDIRS = ["brand-plans", "product-notes", "content-calendars"]

# Directories that must never be copied into iCloud (or scanned as sources).
EXCLUDED_DIR_NAMES = {
    ".git",
    "node_modules",
    ".venv",
    "venv",
    "__pycache__",
    ".cache",
    "dist",
    "build",
    "tmp",
    "logs",
    ".next",
    ".swc",
    "plaid_quickstart",
    ".idea",
}

EXCLUDED_FILE_NAMES = {".DS_Store"}

# Active database file extensions. A file with one of these extensions is
# only treated as a *backup* (safe to copy) if its name also looks like a
# timestamped backup/snapshot/dump - see migrate_storage_to_icloud.py.
ACTIVE_DB_EXTENSIONS = {".sqlite", ".sqlite3", ".db", ".db-journal", ".db-wal", ".db-shm"}


def all_icloud_dirs() -> list[Path]:
    dirs = [STORAGE_DIR, ASSETS_DIR, EXPORTS_DIR, BACKUPS_DIR, DOCUMENTS_DIR]
    dirs += [ASSETS_DIR / s for s in ASSET_SUBDIRS]
    dirs += [EXPORTS_DIR / s for s in EXPORT_SUBDIRS]
    dirs += [BACKUPS_DIR / s for s in BACKUP_SUBDIRS]
    dirs += [DOCUMENTS_DIR / s for s in DOCUMENT_SUBDIRS]
    return dirs


def ensure_icloud_dirs() -> list[Path]:
    """Idempotently create the iCloud directory tree. Never deletes or
    overwrites anything - safe to call as often as needed."""
    created = []
    for directory in all_icloud_dirs():
        directory.mkdir(parents=True, exist_ok=True)
        created.append(directory)
    return created


if __name__ == "__main__":
    for directory in ensure_icloud_dirs():
        print(directory)
