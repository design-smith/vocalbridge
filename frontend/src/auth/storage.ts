import type { Tenant } from '@/api/types'

const API_KEY_STORAGE_KEY = 'apiKey'
const TENANT_STORAGE_KEY = 'tenant'

/**
 * API Key storage utilities
 */
export function getApiKey(): string | null {
  return localStorage.getItem(API_KEY_STORAGE_KEY)
}

export function setApiKey(apiKey: string): void {
  localStorage.setItem(API_KEY_STORAGE_KEY, apiKey)
}

export function clearApiKey(): void {
  localStorage.removeItem(API_KEY_STORAGE_KEY)
}

/**
 * Tenant storage utilities
 */
export function getTenant(): Tenant | null {
  const stored = localStorage.getItem(TENANT_STORAGE_KEY)
  if (!stored) return null
  try {
    return JSON.parse(stored) as Tenant
  } catch {
    return null
  }
}

export function setTenant(tenant: Tenant): void {
  localStorage.setItem(TENANT_STORAGE_KEY, JSON.stringify(tenant))
}

export function clearTenant(): void {
  localStorage.removeItem(TENANT_STORAGE_KEY)
}

/**
 * Clear all auth data
 */
export function clearAuth(): void {
  clearApiKey()
  clearTenant()
}
