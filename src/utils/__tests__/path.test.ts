import { validatePath, isReadable, getIgnoredDirectories } from "../path";

describe("validatePath", () => {
  const originalCwd = process.cwd;

  beforeEach(() => {
    // Mock process.cwd to return a consistent value
    process.cwd = () => "/workspace";
  });

  afterEach(() => {
    process.cwd = originalCwd;
  });

  it("should allow valid relative paths", () => {
    expect(validatePath("src/index.ts")).toBe(true);
    expect(validatePath("package.json")).toBe(true);
    expect(validatePath("README.md")).toBe(true);
  });

  it("should allow nested paths", () => {
    expect(validatePath("src/components/Button.tsx")).toBe(true);
    expect(validatePath("lib/utils/helper.ts")).toBe(true);
  });

  it("should block .env files", () => {
    expect(validatePath(".env")).toBe(false);
    expect(validatePath(".env.local")).toBe(false);
    expect(validatePath(".env.production")).toBe(false);
  });

  it("should block .git directory", () => {
    expect(validatePath(".git")).toBe(false);
    expect(validatePath(".git/config")).toBe(false);
    expect(validatePath(".gitignore")).toBe(true); // .gitignore is a file, not .git directory
  });

  it("should block node_modules", () => {
    expect(validatePath("node_modules")).toBe(false);
    expect(validatePath("node_modules/package/index.js")).toBe(false);
  });

  it("should block parent directory traversal", () => {
    expect(validatePath("../secret.txt")).toBe(false);
    expect(validatePath("src/../../secret.txt")).toBe(false);
  });

  it("should block absolute paths", () => {
    expect(validatePath("/etc/passwd")).toBe(false);
    expect(validatePath("C:\\Windows\\System32")).toBe(false);
  });

  it("should block backup files", () => {
    expect(validatePath("src/index.ts.bak")).toBe(false);
    expect(validatePath("config.json.tmp")).toBe(false);
  });

  it("should block build output directories", () => {
    expect(validatePath("dist")).toBe(false);
    expect(validatePath("build")).toBe(false);
    expect(validatePath(".next")).toBe(false);
    expect(validatePath("coverage")).toBe(false);
  });
});

describe("isReadable", () => {
  it("should return true for valid paths", () => {
    expect(isReadable("src/index.ts")).toBe(true);
  });

  it("should return false for blocked paths", () => {
    expect(isReadable(".env")).toBe(false);
    expect(isReadable("node_modules/package")).toBe(false);
  });
});

describe("getIgnoredDirectories", () => {
  it("should return an array of ignored directories", () => {
    const ignored = getIgnoredDirectories();
    expect(Array.isArray(ignored)).toBe(true);
    expect(ignored).toContain("node_modules");
    expect(ignored).toContain(".git");
    expect(ignored).toContain("dist");
  });
});
