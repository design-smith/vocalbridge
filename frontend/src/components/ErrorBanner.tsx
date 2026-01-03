interface ErrorBannerProps {
  message: string
  code?: string
  onDismiss?: () => void
  className?: string
}

export function ErrorBanner({ message, code, onDismiss, className = '' }: ErrorBannerProps) {
  return (
    <div
      className={`card`}
      style={{
        backgroundColor: 'var(--color-error)',
        color: 'white',
        padding: 'var(--spacing-md)',
        marginBottom: 'var(--spacing-md)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        ...(className ? {} : {}),
      }}
    >
      <div>
        <div style={{ fontWeight: 500 }}>{message}</div>
        {code && (
          <div style={{ fontSize: '0.75rem', opacity: 0.9, marginTop: 'var(--spacing-xs)' }}>
            Code: {code}
          </div>
        )}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            fontSize: '1.25rem',
            padding: '0',
            marginLeft: 'var(--spacing-md)',
          }}
          aria-label="Dismiss error"
        >
          ×
        </button>
      )}
    </div>
  )
}
