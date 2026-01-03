import { LoadingSpinner } from './LoadingSpinner'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger'
  loading?: boolean
  children: React.ReactNode
}

export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  const variantClass = {
    primary: 'btn-primary',
    secondary: 'btn',
    danger: 'btn-danger',
  }[variant]

  return (
    <button
      className={`btn ${variantClass} ${className}`}
      disabled={disabled || loading}
      style={{
        ...(props.style || {}),
      }}
      {...props}
    >
      {loading && (
        <span style={{ marginRight: '0.5rem', display: 'inline-flex', alignItems: 'center' }}>
          <LoadingSpinner size="sm" />
        </span>
      )}
      {children}
    </button>
  )
}
