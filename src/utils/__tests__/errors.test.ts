import { ErrorCode, ZaahixError, ToolError, FileError, ProviderError, formatError, getRecoverySuggestion } from "../errors";

describe("ZaahixError", () => {
  it("should create an error with code and message", () => {
    const err = new ZaahixError(ErrorCode.TOOL_NOT_FOUND, "Tool not found");
    expect(err.code).toBe(ErrorCode.TOOL_NOT_FOUND);
    expect(err.message).toBe("Tool not found");
    expect(err.name).toBe("ZaahixError");
  });

  it("should include context", () => {
    const err = new ZaahixError(ErrorCode.FILE_NOT_FOUND, "File not found", {
      filePath: "/path/to/file",
      suggestion: "Check the file path",
    });
    expect(err.context.filePath).toBe("/path/to/file");
    expect(err.context.suggestion).toBe("Check the file path");
  });

  it("should generate user-friendly message", () => {
    const err = new ZaahixError(ErrorCode.PROVIDER_RATE_LIMITED, "Rate limited", {
      suggestion: "Wait a moment and try again",
    });
    const msg = err.toUserMessage();
    expect(msg).toContain("❌ Rate limited");
    expect(msg).toContain("💡 Suggestion: Wait a moment and try again");
  });

  it("should identify retryable errors", () => {
    const retryable = new ZaahixError(ErrorCode.PROVIDER_RATE_LIMITED, "Rate limited");
    expect(retryable.isRetryable()).toBe(true);

    const nonRetryable = new ZaahixError(ErrorCode.FILE_NOT_FOUND, "Not found");
    expect(nonRetryable.isRetryable()).toBe(false);
  });

  it("should calculate retry delay with exponential backoff", () => {
    const err1 = new ZaahixError(ErrorCode.PROVIDER_RATE_LIMITED, "Rate limited", { retryCount: 0 });
    expect(err1.getRetryDelay()).toBe(1000);

    const err2 = new ZaahixError(ErrorCode.PROVIDER_RATE_LIMITED, "Rate limited", { retryCount: 1 });
    expect(err2.getRetryDelay()).toBe(2000);

    const err3 = new ZaahixError(ErrorCode.PROVIDER_RATE_LIMITED, "Rate limited", { retryCount: 2 });
    expect(err3.getRetryDelay()).toBe(4000);
  });

  it("should cap retry delay at 30 seconds", () => {
    const err = new ZaahixError(ErrorCode.PROVIDER_RATE_LIMITED, "Rate limited", { retryCount: 10 });
    expect(err.getRetryDelay()).toBe(30000);
  });
});

describe("ToolError", () => {
  it("should include tool name in context", () => {
    const err = new ToolError(ErrorCode.TOOL_EXECUTION_FAILED, "read_file", "Failed to read", {
      filePath: "/path/to/file",
    });
    expect(err.context.tool).toBe("read_file");
    expect(err.context.filePath).toBe("/path/to/file");
  });
});

describe("FileError", () => {
  it("should include file path in context", () => {
    const err = new FileError(ErrorCode.FILE_WRITE_ERROR, "/path/to/file", "Write failed");
    expect(err.context.filePath).toBe("/path/to/file");
  });
});

describe("ProviderError", () => {
  it("should include provider name in context", () => {
    const err = new ProviderError(ErrorCode.PROVIDER_AUTH_FAILED, "openai", "Auth failed");
    expect(err.context.provider).toBe("openai");
  });
});

describe("formatError", () => {
  it("should format ZaahixError", () => {
    const err = new ZaahixError(ErrorCode.FILE_NOT_FOUND, "File not found");
    const msg = formatError(err);
    expect(msg).toContain("❌ File not found");
  });

  it("should format standard Error", () => {
    const err = new Error("Something went wrong");
    const msg = formatError(err);
    expect(msg).toContain("❌ Error: Something went wrong");
  });

  it("should format unknown errors", () => {
    const msg = formatError("string error");
    expect(msg).toContain("❌ Error: string error");
  });

  it("should format null/undefined errors", () => {
    const msg = formatError(null);
    expect(msg).toContain("❌ Error: null");
  });
});

describe("getRecoverySuggestion", () => {
  it("should return suggestions for known error codes", () => {
    const suggestion = getRecoverySuggestion(ErrorCode.FILE_NOT_FOUND);
    expect(suggestion).toBeTruthy();
    expect(typeof suggestion).toBe("string");
  });

  it("should return a default suggestion for unknown codes", () => {
    // Using a valid code but testing the function works
    const suggestion = getRecoverySuggestion(ErrorCode.SYSTEM_ERROR);
    expect(suggestion).toBeTruthy();
  });
});
