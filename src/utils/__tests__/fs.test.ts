import fs from "fs-extra";
import path from "path";
import os from "os";
import { atomicWrite, createBackup, removeBackup, isFile, getFileSize } from "../fs";

describe("atomicWrite", () => {
  const testDir = path.join(os.tmpdir(), "zaahix-test-" + Date.now());
  const testFile = path.join(testDir, "test.txt");

  beforeEach(async () => {
    await fs.ensureDir(testDir);
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  it("should write content atomically", async () => {
    await atomicWrite(testFile, "Hello, World!");
    const content = await fs.readFile(testFile, "utf-8");
    expect(content).toBe("Hello, World!");
  });

  it("should create parent directories if they don't exist", async () => {
    const nestedFile = path.join(testDir, "nested", "deep", "file.txt");
    await atomicWrite(nestedFile, "Nested content");
    const content = await fs.readFile(nestedFile, "utf-8");
    expect(content).toBe("Nested content");
  });

  it("should not leave temp files on success", async () => {
    await atomicWrite(testFile, "content");
    const items = await fs.readdir(testDir);
    const tempFiles = items.filter((item) => item.startsWith(".zaahix-tmp-"));
    expect(tempFiles).toHaveLength(0);
  });

  it("should overwrite existing files", async () => {
    await atomicWrite(testFile, "original");
    await atomicWrite(testFile, "updated");
    const content = await fs.readFile(testFile, "utf-8");
    expect(content).toBe("updated");
  });
});

describe("createBackup", () => {
  const testDir = path.join(os.tmpdir(), "zaahix-backup-test-" + Date.now());
  const testFile = path.join(testDir, "test.txt");
  const backupFile = path.join(testDir, "test.txt.bak");

  beforeEach(async () => {
    await fs.ensureDir(testDir);
    await fs.writeFile(testFile, "original content");
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  it("should create a backup file", async () => {
    const backupPath = await createBackup(testFile);
    expect(backupPath).toBe(backupFile);
    const backupContent = await fs.readFile(backupFile, "utf-8");
    expect(backupContent).toBe("original content");
  });

  it("should return null if file does not exist", async () => {
    const backupPath = await createBackup(path.join(testDir, "nonexistent.txt"));
    expect(backupPath).toBeNull();
  });

  it("should preserve original file", async () => {
    await createBackup(testFile);
    const content = await fs.readFile(testFile, "utf-8");
    expect(content).toBe("original content");
  });
});

describe("removeBackup", () => {
  const testDir = path.join(os.tmpdir(), "zaahix-remove-backup-test-" + Date.now());
  const testFile = path.join(testDir, "test.txt");
  const backupFile = path.join(testDir, "test.txt.bak");

  beforeEach(async () => {
    await fs.ensureDir(testDir);
    await fs.writeFile(testFile, "original");
    await fs.writeFile(backupFile, "backup content");
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  it("should remove the backup file", async () => {
    await removeBackup(testFile);
    const exists = await fs.pathExists(backupFile);
    expect(exists).toBe(false);
  });

  it("should not throw if backup does not exist", async () => {
    await expect(removeBackup(path.join(testDir, "no-backup.txt"))).resolves.not.toThrow();
  });
});

describe("isFile", () => {
  const testDir = path.join(os.tmpdir(), "zaahix-isfile-test-" + Date.now());
  const testFile = path.join(testDir, "test.txt");

  beforeEach(async () => {
    await fs.ensureDir(testDir);
    await fs.writeFile(testFile, "content");
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  it("should return true for files", async () => {
    expect(await isFile(testFile)).toBe(true);
  });

  it("should return false for directories", async () => {
    expect(await isFile(testDir)).toBe(false);
  });

  it("should return false for non-existent paths", async () => {
    expect(await isFile(path.join(testDir, "nonexistent"))).toBe(false);
  });
});

describe("getFileSize", () => {
  const testDir = path.join(os.tmpdir(), "zaahix-filesize-test-" + Date.now());
  const testFile = path.join(testDir, "test.txt");

  beforeEach(async () => {
    await fs.ensureDir(testDir);
    await fs.writeFile(testFile, "Hello, World!");
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  it("should return file size in bytes", async () => {
    const size = await getFileSize(testFile);
    expect(size).toBe(13); // "Hello, World!" = 13 bytes
  });

  it("should return 0 for non-existent files", async () => {
    const size = await getFileSize(path.join(testDir, "nonexistent"));
    expect(size).toBe(0);
  });
});
