/**
 * Security and Data Protection Utilities for Astra
 * Implements safeguards based on Gitleaks, Bearer, and ECC Production Audit standards.
 */

/**
 * Sanitizes user input: prevents runaway string lengths and neutralizes script injection patterns.
 */
export function sanitizeInput(input: string, maxLength: number = 1000): string {
  if (!input || typeof input !== 'string') return ''
  
  // Truncate to maximum allowed length to prevent memory/DOM overflow attacks
  const truncated = input.slice(0, maxLength).trim()

  // Neutralize common XSS payload characters
  return truncated
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

/**
 * Redacts PII and sensitive tokens from strings before logging or displaying.
 */
export function redactSensitiveData(text: string): string {
  if (!text || typeof text !== 'string') return ''

  return text
    // Redact emails
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]')
    // Redact Bearer / API keys
    .replace(/((bearer\s+|token\s+|key=)[a-zA-Z0-9_\-]{16,})/gi, '[REDACTED_SECRET]')
    // Redact potential passwords or secret params
    .replace(/(password|secret|apikey)=([^\s&]+)/gi, '$1=[REDACTED]')
}

/**
 * In-memory client-side rate limiter to prevent button spamming or DoS attempts.
 */
export class ClientRateLimiter {
  private timestamps: number[] = []
  private maxRequests: number
  private windowMs: number

  constructor(maxRequests: number = 5, windowMs: number = 10000) {
    this.maxRequests = maxRequests
    this.windowMs = windowMs
  }

  canExecute(): boolean {
    const now = Date.now()
    // Filter timestamps within current window
    this.timestamps = this.timestamps.filter(ts => now - ts < this.windowMs)

    if (this.timestamps.length >= this.maxRequests) {
      return false
    }

    this.timestamps.push(now)
    return true
  }

  remainingTimeMs(): number {
    if (this.timestamps.length === 0) return 0
    const oldest = this.timestamps[0]
    return Math.max(0, this.windowMs - (Date.now() - oldest))
  }
}
