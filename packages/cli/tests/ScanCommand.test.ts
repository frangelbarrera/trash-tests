import { describe, expect, it } from 'vitest'
import { matchesGlob, parseArgs } from '../src/commands/ScanCommand.js'

describe('ScanCommand argument parsing', () => {
  it('parses a scan command and its supported flags', () => {
    expect(
      parseArgs(['scan', '--scan-all', '--coverage', 'coverage/coverage-final.json', '--json']),
    ).toMatchObject({
      scanAll: true,
      coverage: 'coverage/coverage-final.json',
      json: true,
    })
  })

  it('rejects an unknown flag instead of silently ignoring it', () => {
    expect(() => parseArgs(['scan', '--mutate-everything'])).toThrow('Unknown argument(s)')
  })

  it('rejects a missing value without swallowing the next flag', () => {
    expect(() => parseArgs(['scan', '--coverage', '--json'])).toThrow(
      'Missing value for --coverage',
    )
  })
})

describe('ScanCommand simple glob support', () => {
  it('matches root and nested test files with a supported glob', () => {
    expect(matchesGlob('**/*.test.ts', 'auth.test.ts')).toBe(true)
    expect(matchesGlob('**/*.test.ts', 'src/auth.test.ts')).toBe(true)
    expect(matchesGlob('**/*.test.ts', 'src/auth.spec.ts')).toBe(false)
  })
})
