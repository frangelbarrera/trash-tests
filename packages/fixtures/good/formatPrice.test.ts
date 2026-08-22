import { describe, expect, it } from 'vitest'

/**
 * Format a price in cents to a currency string.
 */
function formatPrice(cents: number, currency: string): string {
  if (typeof cents !== 'number' || !Number.isFinite(cents)) {
    throw new TypeError('cents must be a finite number')
  }
  if (currency === 'JPY') return String(Math.floor(cents))
  if (currency === 'USD' || currency === 'EUR') return (cents / 100).toFixed(2)
  throw new Error(`unsupported currency: ${currency}`)
}

describe('formatPrice', () => {
  it('formats USD with 2 decimals', () => {
    expect(formatPrice(1234, 'USD')).toBe('12.34')
  })

  it('formats EUR with 2 decimals', () => {
    expect(formatPrice(99, 'EUR')).toBe('0.99')
  })

  it('formats JPY without decimals', () => {
    expect(formatPrice(1234, 'JPY')).toBe('1234')
  })

  it('throws on non-finite cents (NaN)', () => {
    expect(() => formatPrice(Number.NaN, 'USD')).toThrow(TypeError)
  })

  it('throws on non-finite cents (Infinity)', () => {
    expect(() => formatPrice(Number.POSITIVE_INFINITY, 'USD')).toThrow(TypeError)
  })

  it('throws on non-number cents', () => {
    expect(() => formatPrice('100' as unknown as number, 'USD')).toThrow(TypeError)
  })

  it('throws on unsupported currency', () => {
    expect(() => formatPrice(100, 'GBP')).toThrow('unsupported currency: GBP')
  })

  it('formats zero cents', () => {
    expect(formatPrice(0, 'USD')).toBe('0.00')
  })

  it('formats large amounts', () => {
    expect(formatPrice(100_000_000, 'USD')).toBe('1000000.00')
  })
})
