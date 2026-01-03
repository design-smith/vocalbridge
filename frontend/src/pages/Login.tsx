import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/context'
import { Button } from '@/components/Button'

export function Login() {
  const [apiKey, setApiKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    const result = await login(apiKey.trim())
    setIsLoading(false)

    if (result.success) {
      navigate('/agents')
    } else {
      setError(result.error || 'Invalid API key')
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
        padding: 'var(--spacing-md)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          backgroundColor: '#ffffff',
          border: '1px solid #a8d5ff',
          borderRadius: '12px',
          padding: 'var(--spacing-2xl)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--spacing-lg)',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: '1.5rem',
            fontWeight: 600,
            color: '#000000',
            textAlign: 'left',
          }}
        >
          Log in
        </h1>

        {error && (
          <div
            style={{
              padding: 'var(--spacing-md)',
              backgroundColor: '#fee2e2',
              border: '1px solid #fecaca',
              borderRadius: 'var(--border-radius)',
              color: '#dc2626',
              fontSize: '0.875rem',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
          <div>
            <input
              type="text"
              name="apiKey"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="API Key"
              required
              style={{
                width: '100%',
                padding: 'var(--spacing-md)',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                backgroundColor: '#f9fafb',
                fontSize: '1rem',
                fontFamily: 'inherit',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#a8d5ff'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e5e7eb'
              }}
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            loading={isLoading}
            style={{
              width: '100%',
              backgroundColor: '#000000',
              color: '#9ca3af',
              border: 'none',
              borderRadius: '0.75rem',
              padding: 'var(--spacing-md)',
              fontSize: '1rem',
              fontWeight: 400,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'opacity 0.2s',
            }}
          >
            Login
          </Button>
        </form>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 'var(--spacing-md)',
            fontSize: '0.875rem',
          }}
        >
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault()
              // Sign up functionality can be added later
            }}
            style={{
              color: '#a78bfa',
              textDecoration: 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.textDecoration = 'underline'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.textDecoration = 'none'
            }}
          >
            Sign Up
          </a>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault()
              // Forgot password functionality can be added later
            }}
            style={{
              color: '#a78bfa',
              textDecoration: 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.textDecoration = 'underline'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.textDecoration = 'none'
            }}
          >
            Forgot Password
          </a>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 'var(--spacing-sm)',
            fontSize: '0.75rem',
            marginTop: 'var(--spacing-md)',
            paddingTop: 'var(--spacing-md)',
            borderTop: '1px solid #e5e7eb',
          }}
        >
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault()
              // Terms of Use can be added later
            }}
            style={{
              color: '#a78bfa',
              textDecoration: 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.textDecoration = 'underline'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.textDecoration = 'none'
            }}
          >
            Terms of Use
          </a>
          <span style={{ color: '#d1d5db' }}>|</span>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault()
              // Privacy Policy can be added later
            }}
            style={{
              color: '#a78bfa',
              textDecoration: 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.textDecoration = 'underline'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.textDecoration = 'none'
            }}
          >
            Privacy Policy
          </a>
        </div>
      </div>
    </div>
  )
}
