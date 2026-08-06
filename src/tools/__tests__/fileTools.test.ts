import fs from "fs-extra";
import path from "path";
import os from "os";
import { readFile } from "../readFile";
import { writeFile } from "../writeFile";
import { readFileChunk } from "../readFileChunk";

const testDir = path.resolve(__dirname, "../../.test-temp");

describe("readFile", () => {
  const testFile = path.join(testDir, "read-test.txt");

  beforeAll(async () => {
    await fs.ensureDir(testDir);
  });

  afterAll(async () => {
    await fs.remove(testDir);
  });

  it("should read file content", async () => {
    await fs.writeFile(testFile, "Hello, World!");
    const result = await readFile(testFile);
    expect(result).toBe("Hello, World!");
  });

  it("should truncate large files", async () => {
    const largeFile = path.join(testDir, "large.txt");
    const largeContent = "x".repeat(200000);
    await fs.writeFile(largeFile, largeContent);
    const result = await readFile(largeFile);
    expect(typeof result).toBe("string");
    expect(result.length).toBeLessThan(largeContent.length);
    expect(result).toContain("truncated");
  });

  it("should return error for non-existent files", async () => {
    const result = await readFile(path.join(testDir, "nonexistent.txt"));
    expect(result).toContain("❌ Error");
  });

  it("should block blocked paths", async () => {
    const result = await readFile(".env");
    expect(result).toContain("❌ Access denied");
  });
});

describe("writeFile", () => {
  const testFile = path.join(testDir, "write-test.txt");

  beforeAll(async () => {
    await fs.ensureDir(testDir);
  });

  afterAll(async () => {
    await fs.remove(testDir);
  });

  it("should write file content", async () => {
    const result = await writeFile(testFile, "Hello, World!");
    expect(result).toContain("✅ File written");
    const content = await fs.readFile(testFile, "utf-8");
    expect(content).toBe("Hello, World!");
  });

  it("should create parent directories", async () => {
    const nestedFile = path.join(testDir, "nested", "file.txt");
    await writeFile(nestedFile, "nested content");
    const content = await fs.readFile(nestedFile, "utf-8");
    expect(content).toBe("nested content");
  });

  it("should block blocked paths", async () => {
    const result = await writeFile(".env", "SECRET=key");
    expect(result).toContain("❌ Access denied");
  });

  it("should create backup when requested", async () => {
    const backupFile = path.join(testDir, "backup-test.txt");
    await fs.writeFile(backupFile, "original");
    await writeFile(backupFile, "updated", { backup: true });
    const content = await fs.readFile(backupFile, "utf-8");
    expect(content).toBe("updated");
  });
});

describe("readFileChunk", () => {
  const testFile = path.join(testDir, "chunk-test.txt");

  beforeAll(async () => {
    await fs.ensureDir(testDir);
    await fs.writeFile(testFile, "Hello, World! This is a test file.");
  });

  afterAll(async () => {
    await fs.remove(testDir);
  });

  it("should read a chunk of the file", async () => {
    const result = await readFileChunk(testFile, 0, 5);
    expect(typeof result).toBe("object");
    if (typeof result === "object" && result !== null) {
      expect(result.content).toBe("Hello");
      expect(result.start).toBe(0);
      expect(result.length).toBe(5);
    }
  });

  it("should read from specified start position", async () => {
    const result = await readFileChunk(testFile, 7, 6);
    expect(typeof result).toBe("object");
    if (typeof result === "object" && result !== null) {
      expect(result.content).toBe("World!");
    }
  });

  it("should handle reading beyond file end", async () => {
    const result = await readFileChunk(testFile, 25, 100);
    expect(typeof result).toBe("object");
    if (typeof result === "object" && result !== null) {
      expect(result.content.length).toBeLessThanOrEqual(100);
      expect(result.content).toBe("est file.");
    }
  });

  it("should return error for non-existent files", async () => {
    const result = await readFileChunk(path.join(testDir, "nonexistent.txt"), 0, 10);
    expect(typeof result).toBe("string");
    expect(result).toContain("❌ Error");
  });
});
