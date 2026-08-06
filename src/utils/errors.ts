/**
 * Structured error types for Zaahix CLI.
 */

export enum ErrorCode {
  // Tool errors
  TOOL_NOT_FOUND = "TOOL_NOT_FOUND",
  TOOL_EXECUTION_FAILED = "TOOL_EXECUTION_FAILED",
  TOOL_TIMEOUT = "TOOL_TIMEOUT",
  TOOL_ARGS_INVALID = "TOOL_ARGS_INVALID",

  // File errors
  FILE_NOT_FOUND = "FILE_NOT_FOUND",
  FILE_READ_ERROR = "FILE_READ_ERROR",
  FILE_WRITE_ERROR = "FILE_WRITE_ERROR",
  FILE_PERMISSION_DENIED = "FILE_PERMISSION_DENIED",
  FILE_ALREADY_EXISTS = "FILE_ALREADY_EXISTS",
  FILE_CORRUPTED = "FILE_CORRUPTED",

  // Path errors
  PATH_INVALID = "PATH_INVALID",
  PATH_OUTSIDE_WORKSPACE = "PATH_OUTSIDE_WORKSPACE",
  PATH_BLOCKED = "PATH_BLOCKED",
  PATH_NOT_FOUND = "PATH_NOT_FOUND",

  // Provider errors
  PROVIDER_NOT_FOUND = "PROVIDER_NOT_FOUND",
  PROVIDER_AUTH_FAILED = "PROVIDER_AUTH_FAILED",
  PROVIDER_RATE_LIMITED = "PROVIDER_RATE_LIMITED",
  PROVIDER_QUOTA_EXCEEDED = "PROVIDER_QUOTA_EXCEEDED",
  PROVIDER_MODEL_NOT_FOUND = "PROVIDER_MODEL_NOT_FOUND",
  PROVIDER_NETWORK_ERROR = "PROVIDER_NETWORK_ERROR",

  // Agent errors
  AGENT_MAX_ITERATIONS = "AGENT_MAX_ITERATIONS",
  AGENT_INVALID_RESPONSE = "AGENT_INVALID_RESPONSE",
  AGENT_CONTEXT_TOO_LONG = "AGENT_CONTEXT_TOO_LONG",

  // Git errors
  GIT_NOT_INITIALIZED = "GIT_NOT_INITIALIZED",
  GIT_BRANCH_EXISTS = "GIT_BRANCH_EXISTS",
  GIT_NO_CHANGES = "GIT_NO_CHANGES",
  GIT_PUSH_FAILED = "GIT_PUSH_FAILED",

  // System errors
  SYSTEM_ERROR = "SYSTEM_ERROR",
  SYSTEM_MEMORY = "SYSTEM_MEMORY",
  SYSTEM_DISK = "SYSTEM_DISK",
}

export interface ErrorContext {
  tool?: string;
  filePath?: string;
  provider?: string;
  model?: string;
  retryCount?: number;
  maxRetries?: number;
  suggestion?: string;
  originalError?: Error | string;
}

export class ZaahixError extends Error {
  public readonly code: ErrorCode;
  public readonly context: ErrorContext;
  public readonly timestamp: Date;

  constructor(code: ErrorCode, message: string, context: ErrorContext = {}) {
    super(message);
    this.name = "ZaahixError";
    this.code = code;
    this.context = context;
    this.timestamp = new Date();
  }

  /**
   * Get a user-friendly error message with recovery suggestion.
   */
  toUserMessage(): string {
    const parts = [`❌ ${this.message}`];

    if (this.context.suggestion) {
      parts.push(`💡 Suggestion: ${this.context.suggestion}`);
    }

    if (this.context.originalError) {
      const origErr = this.context.originalError;
      if (origErr instanceof Error) {
        parts.push(`   Original error: ${origErr.message}`);
      } else {
        parts.push(`   Original error: ${origErr}`);
      }
    }

    return parts.join("\n");
  }

  /**
   * Check if this error is retryable.
   */
  isRetryable(): boolean {
    const retryableCodes = [
      ErrorCode.PROVIDER_RATE_LIMITED,
      ErrorCode.PROVIDER_NETWORK_ERROR,
      ErrorCode.TOOL_TIMEOUT,
      ErrorCode.SYSTEM_ERROR,
    ];
    return retryableCodes.includes(this.code);
  }

  /**
   * Get the recommended retry delay in milliseconds.
   */
  getRetryDelay(): number {
    const retryCount = this.context.retryCount || 0;
    const baseDelay = 1000;
    const maxDelay = 30000;
    return Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
  }
}

// Tool errors
export class ToolError extends ZaahixError {
  constructor(code: ErrorCode, tool: string, message: string, context: ErrorContext = {}) {
    super(code, message, { ...context, tool });
    this.name = "ToolError";
  }
}

// File errors
export class FileError extends ZaahixError {
  constructor(code: ErrorCode, filePath: string, message: string, context: ErrorContext = {}) {
    super(code, message, { ...context, filePath });
    this.name = "FileError";
  }
}

// Provider errors
export class ProviderError extends ZaahixError {
  constructor(code: ErrorCode, provider: string, message: string, context: ErrorContext = {}) {
    super(code, message, { ...context, provider });
    this.name = "ProviderError";
  }
}

// Path errors
export class PathError extends ZaahixError {
  constructor(code: ErrorCode, filePath: string, message: string, context: ErrorContext = {}) {
    super(code, message, { ...context, filePath });
    this.name = "PathError";
  }
}

// Git errors
export class GitError extends ZaahixError {
  constructor(code: ErrorCode, message: string, context: ErrorContext = {}) {
    super(code, message, context);
    this.name = "GitError";
  }
}

// Agent errors
export class AgentError extends ZaahixError {
  constructor(code: ErrorCode, message: string, context: ErrorContext = {}) {
    super(code, message, context);
    this.name = "AgentError";
  }
}

/**
 * Create a user-friendly error message from any error type.
 */
export function formatError(err: unknown): string {
  if (err instanceof ZaahixError) {
    return err.toUserMessage();
  }

  if (err instanceof Error) {
    return `❌ Error: ${err.message}`;
  }

  return `❌ Error: ${String(err)}`;
}

/**
 * Get a recovery suggestion for common errors.
 */
export function getRecoverySuggestion(code: ErrorCode): string {
  const suggestions: Record<ErrorCode, string> = {
    [ErrorCode.TOOL_NOT_FOUND]: "Check the available tools list.",
    [ErrorCode.TOOL_EXECUTION_FAILED]: "Try running the tool again with different arguments.",
    [ErrorCode.TOOL_TIMEOUT]: "The operation took too long. Try a simpler task.",
    [ErrorCode.TOOL_ARGS_INVALID]: "Check the tool arguments and try again.",

    [ErrorCode.FILE_NOT_FOUND]: "Check the file path and try again.",
    [ErrorCode.FILE_READ_ERROR]: "Ensure you have read permissions for this file.",
    [ErrorCode.FILE_WRITE_ERROR]: "Ensure you have write permissions and disk space.",
    [ErrorCode.FILE_PERMISSION_DENIED]: "Check file permissions or run with appropriate privileges.",
    [ErrorCode.FILE_ALREADY_EXISTS]: "Use a different filename or delete the existing file.",
    [ErrorCode.FILE_CORRUPTED]: "The file may be corrupted. Try re-downloading or restoring from backup.",

    [ErrorCode.PATH_INVALID]: "The path contains invalid characters.",
    [ErrorCode.PATH_OUTSIDE_WORKSPACE]: "Cannot access files outside the workspace.",
    [ErrorCode.PATH_BLOCKED]: "This path is blocked for security reasons.",
    [ErrorCode.PATH_NOT_FOUND]: "Check the path and try again.",

    [ErrorCode.PROVIDER_NOT_FOUND]: "Set ZAAHIX_PROVIDER in your .env file.",
    [ErrorCode.PROVIDER_AUTH_FAILED]: "Check your API key in the .env file.",
    [ErrorCode.PROVIDER_RATE_LIMITED]: "Wait a moment and try again.",
    [ErrorCode.PROVIDER_QUOTA_EXCEEDED]: "Check your provider dashboard for quota.",
    [ErrorCode.PROVIDER_MODEL_NOT_FOUND]: "Try a different model name.",
    [ErrorCode.PROVIDER_NETWORK_ERROR]: "Check your internet connection.",

    [ErrorCode.AGENT_MAX_ITERATIONS]: "The task is too complex. Try breaking it into smaller steps.",
    [ErrorCode.AGENT_INVALID_RESPONSE]: "The AI response was invalid. Try rephrasing your request.",
    [ErrorCode.AGENT_CONTEXT_TOO_LONG]: "The conversation is too long. Start a new session.",

    [ErrorCode.GIT_NOT_INITIALIZED]: "Initialize git with: git init",
    [ErrorCode.GIT_BRANCH_EXISTS]: "Use a different branch name.",
    [ErrorCode.GIT_NO_CHANGES]: "Make some changes before committing.",
    [ErrorCode.GIT_PUSH_FAILED]: "Check your remote and permissions.",

    [ErrorCode.SYSTEM_ERROR]: "An unexpected error occurred. Try again.",
    [ErrorCode.SYSTEM_MEMORY]: "Close other applications to free memory.",
    [ErrorCode.SYSTEM_DISK]: "Free up disk space and try again.",
  };

  return suggestions[code] || "Try again or check the logs.";
}
