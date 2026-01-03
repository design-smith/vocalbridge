import { useAuth } from '@/auth/context'

export function TenantBadge() {
  const { tenant } = useAuth()

  if (!tenant) {
    return null
  }

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: 'var(--spacing-xs) var(--spacing-md)',
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--border-radius)',
        fontSize: '0.875rem',
        color: 'var(--color-text)',
      }}
    >
      <span style={{ fontWeight: 500, fontFamily: 'inherit' }}>{tenant.name || tenant.id}</span>
    </div>
  )
}
