import { useEffect } from 'react'

export type ToastType = 'success' | 'error' | 'info'

interface ToastProps {
  message: string
  type?: ToastType
  duration?: number
  onClose: () => void
}

export function Toast({ message, type = 'info', duration = 3000, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose()
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onClose])

  const backgroundColor = {
    success: 'var(--color-success)',
    error: 'var(--color-error)',
    info: 'var(--color-primary)',
  }[type]

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'var(--spacing-lg)',
        right: 'var(--spacing-lg)',
        backgroundColor,
        color: 'white',
        padding: 'var(--spacing-md)',
        borderRadius: 'var(--border-radius)',
        boxShadow: 'var(--shadow-lg)',
        zIndex: 1000,
        minWidth: '200px',
        maxWidth: '400px',
      }}
    >
      {message}
    </div>
  )
}
