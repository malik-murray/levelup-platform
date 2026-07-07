import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getStorageDirs, ensureIcloudDirs } from "../paths";

describe("storage path configuration", () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("defaults to the LevelUpSolutions folder in iCloud Drive", () => {
    delete process.env.LEVELUP_STORAGE_DIR;
    const dirs = getStorageDirs();
    expect(dirs.storageDir).toBe(
      path.join(
        os.homedir(),
        "Library",
        "Mobile Documents",
        "com~apple~CloudDocs",
        "LevelUpSolutions"
      )
    );
  });

  it("derives asset/export/backup paths from an overridden root", () => {
    process.env.LEVELUP_STORAGE_DIR = "/tmp/levelup-test-storage";
    delete process.env.LEVELUP_ASSETS_DIR;
    delete process.env.LEVELUP_DATABASE_BACKUP_DIR;
    const dirs = getStorageDirs();
    expect(dirs.assetsDir).toBe(path.join("/tmp/levelup-test-storage", "assets"));
    expect(dirs.databaseBackupDir).toBe(
      path.join("/tmp/levelup-test-storage", "backups", "database-backups")
    );
  });

  it("honors independent overrides for each variable", () => {
    process.env.LEVELUP_STORAGE_DIR = "/tmp/root";
    process.env.LEVELUP_ASSETS_DIR = "/tmp/custom-assets";
    const dirs = getStorageDirs();
    expect(dirs.assetsDir).toBe(path.resolve("/tmp/custom-assets"));
    expect(dirs.backupsDir).toBe(path.join("/tmp/root", "backups"));
  });

  it("creates the full directory tree idempotently without deleting existing files", () => {
    const tmpRoot = path.join(os.tmpdir(), `levelup-test-${Date.now()}`);
    process.env.LEVELUP_STORAGE_DIR = tmpRoot;
    const dirs = getStorageDirs();

    const first = ensureIcloudDirs(dirs);
    fs.writeFileSync(path.join(dirs.assets.images, "keep-me.txt"), "hello");
    const second = ensureIcloudDirs(dirs);

    expect(first.failed).toEqual([]);
    expect(second.failed).toEqual([]);
    expect(fs.existsSync(path.join(dirs.assets.images, "keep-me.txt"))).toBe(true);
    for (const dir of [
      ...Object.values(dirs.assets),
      ...Object.values(dirs.exports),
      ...Object.values(dirs.backups),
      ...Object.values(dirs.documents),
    ]) {
      expect(fs.existsSync(dir)).toBe(true);
    }

    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("handles paths containing spaces (e.g. 'Mobile Documents') safely", () => {
    delete process.env.LEVELUP_STORAGE_DIR;
    const dirs = getStorageDirs();
    expect(dirs.storageDir).toContain("Mobile Documents");
    expect(path.isAbsolute(dirs.storageDir)).toBe(true);
  });
});
