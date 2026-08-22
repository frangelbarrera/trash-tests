import { describe, expect, it } from 'vitest'

/**
 * Get a value at a path inside an object.
 * Inspired by Lodash's _.get, simplified for illustration.
 */
function get(obj: unknown, path: string | string[], defaultValue?: unknown): unknown {
  if (obj == null) return defaultValue
  const parts = Array.isArray(path) ? path : path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current == null) return defaultValue
    current = (current as Record<string, unknown>)[part]
  }
  return current === undefined ? defaultValue : current
}

describe('get', () => {
  it('returns nested value', () => {
    expect(get({ a: { b: { c: 42 } } }, 'a.b.c')).toBe(42)
  })

  it('returns undefined when path does not exist', () => {
    expect(get({ a: 1 }, 'b')).toBeUndefined()
  })

  it('returns default value when path does not exist', () => {
    expect(get({ a: 1 }, 'b', 'default')).toBe('default')
  })

  it('returns the object itself for empty path', () => {
    const obj = { a: 1 }
    expect(get(obj, '')).toBe(obj)
  })

  it('handles null input', () => {
    expect(get(null, 'a.b.c')).toBeUndefined()
  })

  it('handles undefined input', () => {
    expect(get(undefined, 'a.b.c')).toBeUndefined()
  })

  it('returns default for null input', () => {
    expect(get(null, 'a', 'fallback')).toBe('fallback')
  })

  it('traverses arrays by index', () => {
    expect(get([10, 20, 30], '1')).toBe(20)
  })

  it('supports array path syntax', () => {
    expect(get({ a: { b: 5 } }, ['a', 'b'])).toBe(5)
  })

  it('returns undefined for intermediate null', () => {
    expect(get({ a: null }, 'a.b')).toBeUndefined()
  })
})
