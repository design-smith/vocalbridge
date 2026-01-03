import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'
import type { Tenant } from '@/api/types'
import { getApiKey, setApiKey, clearApiKey, getTenant, setTenant, clearTenant } from './storage'
import { getMe } from '@/api/endpoints'

interface AuthContextType {
  apiKey: string | null
  tenant: Tenant | null
  isLoading: boolean
  login: (apiKey: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  refreshTenant: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKeyState] = useState<string | null>(() => getApiKey())
  const [tenant, setTenantState] = useState<Tenant | null>(() => getTenant())
  const [isLoading, setIsLoading] = useState(false)
  const [initialLoad, setInitialLoad] = useState(true)

  const refreshTenant = useCallback(async () => {
    const currentApiKey = getApiKey()
    if (!currentApiKey) {
      setTenantState(null)
      return
    }

    setIsLoading(true)
    try {
      // Call real API to validate API key and get tenant info
      const response = await getMe()

      if (response.error) {
        // API key is invalid or network error
        console.error('Failed to refresh tenant:', response.error)
        clearApiKey()
        clearTenant()
        setApiKeyState(null)
        setTenantState(null)
        return
      }

      // Store tenant info
      const tenantData = response.data!.tenant
      setTenantState(tenantData)
      setTenant(tenantData)
    } catch (error) {
      console.error('Error refreshing tenant:', error)
      clearApiKey()
      clearTenant()
      setApiKeyState(null)
      setTenantState(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const login = useCallback(
    async (key: string): Promise<{ success: boolean; error?: string }> => {
      setIsLoading(true)

      if (!key.trim()) {
        setIsLoading(false)
        return {
          success: false,
          error: 'Please enter an API key',
        }
      }

      try {
        // Temporarily store API key so the API client can use it
        setApiKey(key.trim())
        setApiKeyState(key.trim())

        // Validate API key by calling /v1/me
        const response = await getMe()

        if (response.error) {
          // Clear the temporarily stored key
          clearApiKey()
          setApiKeyState(null)
          setIsLoading(false)

          return {
            success: false,
            error: response.error.message || 'Invalid API key',
          }
        }

        // Store tenant info
        const tenantData = response.data!.tenant
        setTenant(tenantData)
        setTenantState(tenantData)

        setIsLoading(false)
        return { success: true }
      } catch (error) {
        // Clear the temporarily stored key
        clearApiKey()
        setApiKeyState(null)
        setIsLoading(false)

        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to validate API key',
        }
      }
    },
    []
  )

  const logout = useCallback(() => {
    clearApiKey()
    clearTenant()
    setApiKeyState(null)
    setTenantState(null)
  }, [])

  // On mount, validate API key if present
  useEffect(() => {
    const init = async () => {
      if (apiKey) {
        await refreshTenant()
      }
      setInitialLoad(false)
    }
    init()
  }, []) // Only run once on mount

  return (
    <AuthContext.Provider
      value={{
        apiKey,
        tenant,
        isLoading: isLoading || initialLoad,
        login,
        logout,
        refreshTenant,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
