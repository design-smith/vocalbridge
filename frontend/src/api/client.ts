import type { APIError, APIResponse } from './types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  headers?: Record<string, string>
  body?: unknown
  idempotencyKey?: string
}

/**
 * Base API client that handles:
 * - Adding X-API-Key header from localStorage
 * - JSON parsing
 * - Error normalization
 * - Custom headers (e.g., Idempotency-Key)
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<APIResponse<T>> {
  const { method = 'GET', headers = {}, body, idempotencyKey } = options

  // Get API key from localStorage
  const apiKey = localStorage.getItem('apiKey')
  if (!apiKey) {
    return {
      error: {
        message: 'API key not found. Please log in.',
        code: 'NO_API_KEY',
      },
    }
  }

  // Build headers
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-API-Key': apiKey,
    ...headers,
  }

  // Add idempotency key if provided
  if (idempotencyKey) {
    requestHeaders['Idempotency-Key'] = idempotencyKey
  }

  // Build request config
  const config: RequestInit = {
    method,
    headers: requestHeaders,
  }

  // Add body for non-GET requests
  if (body && method !== 'GET') {
    config.body = JSON.stringify(body)
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config)

    // Parse JSON response
    let data: T | APIError
    try {
      data = await response.json()
    } catch (parseError) {
      // If response is not JSON, create error
      return {
        error: {
          message: response.statusText || 'Invalid response format',
          code: 'INVALID_RESPONSE',
          status: response.status,
        },
      }
    }

    // Handle error responses
    if (!response.ok) {
      // Handle 401 Unauthorized - clear auth and redirect to login
      if (response.status === 401) {
        localStorage.removeItem('apiKey')
        localStorage.removeItem('tenant')
        // Redirect to login if not already there
        if (window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
      }

      const error: APIError = {
        message: (data as any)?.error?.message || (data as APIError).message || response.statusText || 'Request failed',
        code: (data as any)?.error?.code || (data as APIError).code || `HTTP_${response.status}`,
        status: response.status,
        details: (data as any)?.error?.details,
      }
      return { error }
    }

    // Success response
    return { data: data as T }
  } catch (error) {
    // Network or other errors
    const apiError: APIError = {
      message: error instanceof Error ? error.message : 'Network error occurred',
      code: 'NETWORK_ERROR',
    }
    return { error: apiError }
  }
}
