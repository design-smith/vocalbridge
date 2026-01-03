import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './context'
import { getApiKey } from './storage'

interface ProtectedRouteProps {
  children: React.ReactNode
}

/**
 * ProtectedRoute component that:
 * - Checks for API key in localStorage
 * - Redirects to /login if missing
 * - Validates API key and fetches tenant info on mount
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { tenant, refreshTenant } = useAuth()
  const location = useLocation()
  const [isValidating, setIsValidating] = useState(true)

  useEffect(() => {
    const validateAuth = async () => {
      const apiKey = getApiKey()
      if (!apiKey) {
        setIsValidating(false)
        return
      }

      // If we have an API key but no tenant, fetch it
      if (!tenant) {
        await refreshTenant()
      }
      setIsValidating(false)
    }

    validateAuth()
  }, [tenant, refreshTenant])

  const apiKey = getApiKey()

  // Show nothing while validating
  if (isValidating) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div className="loading-spinner" />
      </div>
    )
  }

  // Redirect to login if no API key
  if (!apiKey) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // If API key exists but tenant fetch failed, also redirect to login
  // (refreshTenant will have cleared the key if invalid)
  if (!tenant && !isValidating) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
