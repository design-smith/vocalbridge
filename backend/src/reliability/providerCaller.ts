/**
 * Provider caller with retry, timeout, and fallback logic
 */

import {
  ProviderAdapter,
  ProviderRequest,
  NormalizedResponse,
  ProviderError,
} from '../providers/types';
import {
  RetryConfig,
  DEFAULT_RETRY_CONFIG,
  calculateBackoff,
  isRetryableError,
  sleep,
  withTimeout,
  getRetryAfter,
} from './retryPolicy';
import * as ProviderCallEventRepo from '../repositories/ProviderCallEventRepo';
import { generateEventId } from '../utils/ids';

/**
 * Result of a provider call attempt
 */
export interface ProviderCallResult {
  success: boolean;
  response?: NormalizedResponse;
  error?: ProviderError;
  attempts: ProviderCallAttempt[];
  providerUsed: string;
  fallbackUsed: boolean;
}

/**
 * Details of a single provider call attempt
 */
export interface ProviderCallAttempt {
  provider: string;
  status: 'success' | 'failed';
  httpStatus: number | null;
  latencyMs: number;
  retries: number;
  errorCode: string | null;
  errorMessage: string | null;
}

/**
 * Call a provider with retry logic
 *
 * @param provider - The provider adapter
 * @param request - The request
 * @param config - Retry configuration
 * @param context - Context for logging (tenantId, sessionId, agentId, requestId)
 * @returns Provider call result
 */
export async function callProviderWithRetry(
  provider: ProviderAdapter,
  request: ProviderRequest,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  context: {
    tenantId: string;
    sessionId: string;
    agentId: string;
    requestId: string;
  }
): Promise<ProviderCallResult> {
  const attempts: ProviderCallAttempt[] = [];
  let lastError: ProviderError | undefined;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    const startTime = Date.now();

    try {
      // Apply timeout wrapper
      const response = await withTimeout(
        provider.call(request),
        config.timeoutMs,
        `Provider ${provider.name} timed out after ${config.timeoutMs}ms`
      );

      const latencyMs = Date.now() - startTime;

      // Record successful attempt
      const attemptRecord: ProviderCallAttempt = {
        provider: provider.name,
        status: 'success',
        httpStatus: 200,
        latencyMs,
        retries: attempt,
        errorCode: null,
        errorMessage: null,
      };
      attempts.push(attemptRecord);

      // Persist to database
      await ProviderCallEventRepo.create({
        id: generateEventId(),
        tenantId: context.tenantId,
        sessionId: context.sessionId,
        agentId: context.agentId,
        provider: provider.name,
        status: 'success',
        httpStatus: 200,
        latencyMs,
        retries: attempt,
        requestId: context.requestId,
      });

      return {
        success: true,
        response,
        attempts,
        providerUsed: provider.name,
        fallbackUsed: false,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;

      // Convert to ProviderError if needed
      const providerError =
        error instanceof ProviderError
          ? error
          : new ProviderError('Unknown error', 500, 'UNKNOWN_ERROR');

      lastError = providerError;

      // Record failed attempt
      const attemptRecord: ProviderCallAttempt = {
        provider: provider.name,
        status: 'failed',
        httpStatus: providerError.statusCode,
        latencyMs,
        retries: attempt,
        errorCode: providerError.errorCode,
        errorMessage: providerError.message,
      };
      attempts.push(attemptRecord);

      // Persist to database
      await ProviderCallEventRepo.create({
        id: generateEventId(),
        tenantId: context.tenantId,
        sessionId: context.sessionId,
        agentId: context.agentId,
        provider: provider.name,
        status: 'failed',
        httpStatus: providerError.statusCode,
        latencyMs,
        retries: attempt,
        errorCode: providerError.errorCode,
        errorMessage: providerError.message,
        requestId: context.requestId,
      });

      // Check if we should retry
      if (attempt < config.maxRetries && isRetryableError(providerError)) {
        // Calculate backoff delay
        const retryAfterMs = getRetryAfter(providerError);
        const backoffMs = calculateBackoff(
          attempt,
          config.initialBackoffMs,
          retryAfterMs
        );

        // Wait before retrying
        await sleep(backoffMs);

        // Continue to next attempt
        continue;
      }

      // No more retries, break
      break;
    }
  }

  // All attempts failed
  return {
    success: false,
    error: lastError,
    attempts,
    providerUsed: provider.name,
    fallbackUsed: false,
  };
}

/**
 * Call provider with fallback support
 *
 * @param primaryProvider - Primary provider
 * @param fallbackProvider - Fallback provider (optional)
 * @param request - The request
 * @param config - Retry configuration
 * @param context - Context for logging
 * @returns Provider call result
 */
export async function callProviderWithFallback(
  primaryProvider: ProviderAdapter,
  fallbackProvider: ProviderAdapter | null,
  request: ProviderRequest,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  context: {
    tenantId: string;
    sessionId: string;
    agentId: string;
    requestId: string;
  }
): Promise<ProviderCallResult> {
  // Try primary provider first
  const primaryResult = await callProviderWithRetry(
    primaryProvider,
    request,
    config,
    context
  );

  if (primaryResult.success) {
    return primaryResult;
  }

  // Primary failed, try fallback if available
  if (fallbackProvider) {
    const fallbackResult = await callProviderWithRetry(
      fallbackProvider,
      request,
      config,
      context
    );

    // Combine attempts from both providers
    return {
      ...fallbackResult,
      attempts: [...primaryResult.attempts, ...fallbackResult.attempts],
      fallbackUsed: true,
    };
  }

  // No fallback available
  return primaryResult;
}
