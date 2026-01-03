import { format, parseISO, isValid, subDays, startOfDay, endOfDay } from 'date-fns'

/**
 * Format a date string to YYYY-MM-DD
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  if (!isValid(d)) return ''
  return format(d, 'yyyy-MM-dd')
}

/**
 * Format a date string to a readable format (e.g., "Jan 1, 2024")
 */
export function formatDateReadable(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  if (!isValid(d)) return ''
  return format(d, 'MMM d, yyyy')
}

/**
 * Format a date string with time (e.g., "Jan 1, 2024 3:45 PM")
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  if (!isValid(d)) return ''
  return format(d, 'MMM d, yyyy h:mm a')
}

/**
 * Get date range for last N days
 * Adds 1 day to 'to' to ensure we capture all of today's data regardless of timezone
 */
export function getDateRange(days: number): { from: string; to: string } {
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const from = subDays(today, days)
  return {
    from: formatDate(from),
    to: formatDate(tomorrow),
  }
}

/**
 * Parse a date string (YYYY-MM-DD) to Date object
 */
export function parseDate(dateString: string): Date | null {
  if (!dateString) return null
  const parsed = parseISO(dateString)
  return isValid(parsed) ? parsed : null
}

/**
 * Get start and end of day for a date string
 */
export function getDayBounds(dateString: string): { start: Date; end: Date } | null {
  const date = parseDate(dateString)
  if (!date) return null
  return {
    start: startOfDay(date),
    end: endOfDay(date),
  }
}
