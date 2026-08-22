import { describe, expect, it } from 'vitest'

/**
 * Simulated function under test.
 */
function computeScore(input: { user: string; points: number }): { score: number; rank: string } {
  return { score: input.points * 2, rank: 'bronze' }
}

// Regression fixtures for low-signal assertion patterns.
// Trash Tests should report these findings.

describe('computeScore', () => {
  // Decorative fixture: tautology
  it('returns a result', () => {
    expect(true).toBe(true)
  })

  // Decorative fixture: trivial assertion only
  it('returns something', () => {
    const result = computeScore({ user: 'a', points: 10 })
    expect(result).toBeDefined()
  })

  // Decorative fixture: truthiness-only assertion
  it('returns a truthy value', () => {
    const result = computeScore({ user: 'a', points: 10 })
    expect(result).toBeTruthy()
  })

  // Decorative fixture: snapshot-only assertion
  it('matches snapshot', () => {
    const result = computeScore({ user: 'a', points: 10 })
    expect(result).toMatchSnapshot()
  })
})
