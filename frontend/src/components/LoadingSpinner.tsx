interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  const sizeClass = {
    sm: '0.75rem',
    md: '1rem',
    lg: '1.5rem',
  }[size]

  return (
    <div
      className={`loading-spinner ${className}`}
      style={{ width: sizeClass, height: sizeClass, display: 'inline-block' }}
      aria-label="Loading"
    />
  )
}
