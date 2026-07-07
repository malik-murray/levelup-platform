import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Centralized, environment-configurable storage locations.
 *
 * The codebase, git repo, package files, virtual envs, and the active
 * Supabase connection always stay local. This module only governs where
 * large/generated/static content lives (media, exports, timestamped DB
 * backups) so it can be redirected to iCloud Drive without any hardcoded
 * paths in the app code.
 */

export interface StorageDirs {
  storageDir: string;
  assetsDir: string;
  exportsDir: string;
  backupsDir: string;
  databaseBackupDir: string;
  assets: {
    images: string;
    videos: string;
    audio: string;
    thumbnails: string;
    logos: string;
    characters: string;
  };
  exports: {
    finishedShorts: string;
    blogImages: string;
    ebookFiles: string;
  };
  backups: {
    databaseBackups: string;
    projectSnapshots: string;
  };
  documents: {
    root: string;
    brandPlans: string;
    productNotes: string;
    contentCalendars: string;
  };
}

function defaultIcloudRoot(): string {
  // "Mobile Documents" contains a space; path.join keeps it a single path
  // segment (no shell involved), so this is safe on any macOS username/home.
  return path.join(
    os.homedir(),
    "Library",
    "Mobile Documents",
    "com~apple~CloudDocs",
    "LevelUpSolutions"
  );
}

function resolveDir(envValue: string | undefined, fallback: string): string {
  const raw = envValue && envValue.trim().length > 0 ? envValue.trim() : fallback;
  const expanded = raw.startsWith("~") ? path.join(os.homedir(), raw.slice(1)) : raw;
  return path.resolve(expanded);
}

/**
 * Reads LEVELUP_* env vars fresh on every call (rather than caching module
 * -level constants) so tests and hot-reloaded dev servers always see the
 * current environment.
 */
export function getStorageDirs(): StorageDirs {
  const storageDir = resolveDir(process.env.LEVELUP_STORAGE_DIR, defaultIcloudRoot());
  const assetsDir = resolveDir(process.env.LEVELUP_ASSETS_DIR, path.join(storageDir, "assets"));
  const exportsDir = resolveDir(process.env.LEVELUP_EXPORTS_DIR, path.join(storageDir, "exports"));
  const backupsDir = resolveDir(process.env.LEVELUP_BACKUPS_DIR, path.join(storageDir, "backups"));
  const databaseBackupDir = resolveDir(
    process.env.LEVELUP_DATABASE_BACKUP_DIR,
    path.join(backupsDir, "database-backups")
  );

  return {
    storageDir,
    assetsDir,
    exportsDir,
    backupsDir,
    databaseBackupDir,
    assets: {
      images: path.join(assetsDir, "images"),
      videos: path.join(assetsDir, "videos"),
      audio: path.join(assetsDir, "audio"),
      thumbnails: path.join(assetsDir, "thumbnails"),
      logos: path.join(assetsDir, "logos"),
      characters: path.join(assetsDir, "characters"),
    },
    exports: {
      finishedShorts: path.join(exportsDir, "finished-shorts"),
      blogImages: path.join(exportsDir, "blog-images"),
      ebookFiles: path.join(exportsDir, "ebook-files"),
    },
    backups: {
      databaseBackups: databaseBackupDir,
      projectSnapshots: path.join(backupsDir, "project-snapshots"),
    },
    documents: {
      root: path.join(storageDir, "documents"),
      brandPlans: path.join(storageDir, "documents", "brand-plans"),
      productNotes: path.join(storageDir, "documents", "product-notes"),
      contentCalendars: path.join(storageDir, "documents", "content-calendars"),
    },
  };
}

function flattenDirs(dirs: StorageDirs): string[] {
  return [
    dirs.storageDir,
    dirs.assetsDir,
    ...Object.values(dirs.assets),
    dirs.exportsDir,
    ...Object.values(dirs.exports),
    dirs.backupsDir,
    ...Object.values(dirs.backups),
    ...Object.values(dirs.documents),
  ];
}

/**
 * Idempotently creates the full iCloud directory tree. Safe to call on every
 * startup or before any write - uses recursive mkdir so it never errors on
 * existing directories and never touches existing files. Never throws:
 * environments without iCloud Drive (CI, Linux, Vercel) just report the
 * directories that couldn't be created so the caller can log/ignore it.
 */
export function ensureIcloudDirs(dirs: StorageDirs = getStorageDirs()): {
  created: string[];
  failed: string[];
} {
  const created: string[] = [];
  const failed: string[] = [];
  for (const dir of flattenDirs(dirs)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      created.push(dir);
    } catch (err) {
      failed.push(dir);
      console.warn(`[storage] Could not create directory: ${dir}`, err);
    }
  }
  return { created, failed };
}
