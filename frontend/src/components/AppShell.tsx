import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/auth/context'
import { LogoutButton } from './LogoutButton'

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const location = useLocation()
  const [isMenuCollapsed, setIsMenuCollapsed] = useState(false)
  const { tenant } = useAuth()

  const navItems = [
    { path: '/agents', label: 'Agents', icon: 'fa-solid fa-robot' },
    { path: '/try', label: 'Try It', icon: 'fa-solid fa-comments' },
    { path: '/usage', label: 'Usage', icon: 'fa-solid fa-chart-bar' },
  ]

  // Get user initial from tenant name
  const getUserInitial = () => {
    if (!tenant) return 'U'
    const name = tenant.name || tenant.id
    return name.charAt(0).toUpperCase()
  }

  const userName = tenant?.name || tenant?.id || 'User'

  return (
    <div style={{ minHeight: '100vh', display: 'flex' }}>
      {/* Left Sidebar Menu */}
      <aside
        style={{
          width: isMenuCollapsed ? '60px' : '240px',
          backgroundColor: '#000000',
          color: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.3s ease',
          borderRight: '1px solid var(--color-border)',
        }}
      >
        {/* Top Section - Title with Collapse Button */}
        <div
          style={{
            padding: 'var(--spacing-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--spacing-sm)',
          }}
        >
          {!isMenuCollapsed && (
            <img
              src="/logo.png"
              alt="VocalBridge Ops"
              style={{
                height: '24px',
                width: 'auto',
                objectFit: 'contain',
              }}
            />
          )}
          {isMenuCollapsed && (
            <img
              src="/icon.png"
              alt="VocalBridge Ops"
              style={{
                height: '24px',
                width: 'auto',
                objectFit: 'contain',
              }}
            />
          )}
          <button
            onClick={() => setIsMenuCollapsed(!isMenuCollapsed)}
            style={{
              padding: 'var(--spacing-xs)',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#9ca3af',
              cursor: 'pointer',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'inherit',
              fontWeight: 400,
              marginLeft: isMenuCollapsed ? '0' : 'auto',
            }}
            aria-label={isMenuCollapsed ? 'Expand menu' : 'Collapse menu'}
          >
            <i className={isMenuCollapsed ? 'fa-solid fa-chevron-right' : 'fa-solid fa-chevron-left'} />
          </button>
        </div>

        {/* Profile Section */}
        {!isMenuCollapsed && (
          <div
            style={{
              padding: 'var(--spacing-md)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--spacing-sm)',
            }}
          >
            {/* Profile Circle */}
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: '#9ca3af',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#000000',
                fontSize: '1.25rem',
                fontWeight: 600,
                fontFamily: 'inherit',
              }}
            >
              {getUserInitial()}
            </div>
            {/* User Name */}
            <div
              style={{
                fontSize: '0.875rem',
                color: '#ffffff',
                fontWeight: 400,
                fontFamily: 'inherit',
                textAlign: 'center',
              }}
            >
              {userName}
            </div>
          </div>
        )}

        {/* Navigation Items */}
        <nav style={{ flex: 1, padding: 'var(--spacing-sm)', overflowY: 'auto' }}>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-md)',
                  padding: 'var(--spacing-md)',
                  textDecoration: 'none',
                  color: isActive ? '#ffffff' : '#9ca3af',
                  backgroundColor: isActive ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                  borderRadius: 'var(--border-radius)',
                  marginBottom: 'var(--spacing-xs)',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit',
                  fontWeight: 400,
                  transition: 'all 0.2s',
                  justifyContent: isMenuCollapsed ? 'center' : 'flex-start',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }
                }}
                title={isMenuCollapsed ? item.label : undefined}
              >
                <i className={item.icon} style={{ fontSize: '1rem', width: '20px', textAlign: 'center' }} />
                {!isMenuCollapsed && <span>{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Logout Button at Bottom */}
        <div
          style={{
            padding: 'var(--spacing-sm)',
          }}
        >
          <LogoutButton isCollapsed={isMenuCollapsed} />
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, padding: 'var(--spacing-lg)', overflow: 'auto' }}>{children}</main>
    </div>
  )
}
