import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/context'

interface LogoutButtonProps {
  isCollapsed?: boolean
}

export function LogoutButton({ isCollapsed = false }: LogoutButtonProps) {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <button
      onClick={handleLogout}
      style={{
        width: '100%',
        padding: 'var(--spacing-md)',
        backgroundColor: 'transparent',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '0.75rem',
        color: '#9ca3af',
        fontSize: '0.875rem',
        fontFamily: 'inherit',
        fontWeight: 400,
        cursor: 'pointer',
        transition: 'all 0.2s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: isCollapsed ? 'center' : 'center',
        gap: isCollapsed ? '0' : 'var(--spacing-sm)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent'
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
      }}
      title={isCollapsed ? 'Logout' : undefined}
    >
      <i className="fa-solid fa-sign-out-alt" style={{ fontSize: '0.875rem' }} />
      {!isCollapsed && <span>Logout</span>}
    </button>
  )
}
