/**
 * Validate that a string is not empty
 */
export function isRequired(value: string | undefined | null): boolean {
  return value !== undefined && value !== null && value.trim().length > 0
}

/**
 * Get error message for required field
 */
export function getRequiredError(fieldName: string): string {
  return `${fieldName} is required`
}

/**
 * Validate email format (basic)
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate that primary and fallback providers are different
 */
export function validateProviders(
  primary: string,
  fallback: string
): { valid: boolean; error?: string } {
  if (fallback === 'none') {
    return { valid: true }
  }
  if (primary === fallback) {
    return {
      valid: false,
      error: 'Fallback provider must be different from primary provider',
    }
  }
  return { valid: true }
}
