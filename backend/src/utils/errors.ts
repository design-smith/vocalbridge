/**
 * Error codes for structured error responses
 */
export enum ErrorCode {
  // Authentication & Authorization
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_API_KEY = 'INVALID_API_KEY',
  FORBIDDEN = 'FORBIDDEN',

  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_INPUT = 'INVALID_INPUT',

  // Resource Errors
  NOT_FOUND = 'NOT_FOUND',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  AGENT_NOT_FOUND = 'AGENT_NOT_FOUND',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  TENANT_NOT_FOUND = 'TENANT_NOT_FOUND',

  // Idempotency
  IDEMPOTENCY_KEY_REQUIRED = 'IDEMPOTENCY_KEY_REQUIRED',
  IDEMPOTENCY_CONFLICT = 'IDEMPOTENCY_CONFLICT',

  // Provider Errors
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  PROVIDER_TIMEOUT = 'PROVIDER_TIMEOUT',
  PROVIDER_RATE_LIMIT = 'PROVIDER_RATE_LIMIT',
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
  ALL_PROVIDERS_FAILED = 'ALL_PROVIDERS_FAILED',

  // Internal Errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Custom application error class with structured details
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;
  public readonly requestId?: string;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number,
    details?: Record<string, unknown>,
    requestId?: string
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.requestId = requestId;

    // Maintain proper stack trace for where error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  /**
   * Convert error to JSON for API responses
   */
  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
        ...(this.requestId && { requestId: this.requestId }),
      },
    };
  }
}

/**
 * Factory functions for common errors
 */

export function unauthorizedError(
  message = 'Unauthorized',
  requestId?: string
): AppError {
  return new AppError(
    ErrorCode.UNAUTHORIZED,
    message,
    401,
    undefined,
    requestId
  );
}

export function invalidApiKeyError(requestId?: string): AppError {
  return new AppError(
    ErrorCode.INVALID_API_KEY,
    'Invalid or missing API key',
    401,
    undefined,
    requestId
  );
}

export function validationError(
  message: string,
  details?: Record<string, unknown>,
  requestId?: string
): AppError {
  return new AppError(
    ErrorCode.VALIDATION_ERROR,
    message,
    400,
    details,
    requestId
  );
}

export function notFoundError(
  resource: string,
  id?: string,
  requestId?: string
): AppError {
  const message = id
    ? `${resource} with id '${id}' not found`
    : `${resource} not found`;

  return new AppError(
    ErrorCode.RESOURCE_NOT_FOUND,
    message,
    404,
    { resource, id },
    requestId
  );
}

export function agentNotFoundError(
  agentId: string,
  requestId?: string
): AppError {
  return new AppError(
    ErrorCode.AGENT_NOT_FOUND,
    `Agent with id '${agentId}' not found or does not belong to this tenant`,
    404,
    { agentId },
    requestId
  );
}

export function sessionNotFoundError(
  sessionId: string,
  requestId?: string
): AppError {
  return new AppError(
    ErrorCode.SESSION_NOT_FOUND,
    `Session with id '${sessionId}' not found or does not belong to this tenant`,
    404,
    { sessionId },
    requestId
  );
}

export function idempotencyKeyRequiredError(requestId?: string): AppError {
  return new AppError(
    ErrorCode.IDEMPOTENCY_KEY_REQUIRED,
    'Idempotency-Key header is required for this operation',
    400,
    undefined,
    requestId
  );
}

export function providerError(
  provider: string,
  message: string,
  details?: Record<string, unknown>,
  requestId?: string
): AppError {
  return new AppError(
    ErrorCode.PROVIDER_ERROR,
    `Provider '${provider}' error: ${message}`,
    503,
    { provider, ...details },
    requestId
  );
}

export function allProvidersFailedError(
  details?: Record<string, unknown>,
  requestId?: string
): AppError {
  return new AppError(
    ErrorCode.ALL_PROVIDERS_FAILED,
    'All configured providers failed to respond',
    503,
    details,
    requestId
  );
}

export function internalError(
  message = 'Internal server error',
  details?: Record<string, unknown>,
  requestId?: string
): AppError {
  return new AppError(
    ErrorCode.INTERNAL_ERROR,
    message,
    500,
    details,
    requestId
  );
}

/**
 * Check if an error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Convert any error to an AppError for consistent handling
 */
export function toAppError(error: unknown, requestId?: string): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return internalError(error.message, { originalError: error.name }, requestId);
  }

  return internalError('An unknown error occurred', undefined, requestId);
}
