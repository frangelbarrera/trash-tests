import { describe, expect, it } from 'vitest'

// Simulated generated config — snapshot test is legitimate here.
function generateConfig(env: 'dev' | 'prod'): Record<string, unknown> {
  return {
    env,
    api: { url: env === 'prod' ? 'https://api.example.com' : 'http://localhost:3000' },
    features: { auth: true, cache: env === 'prod' },
  }
}

describe('generateConfig', () => {
  // This is a legitimate snapshot test — Trash Tests should emit as `info`.
  it('generates dev config', () => {
    expect(generateConfig('dev')).toMatchSnapshot()
  })

  it('generates prod config', () => {
    expect(generateConfig('prod')).toMatchSnapshot()
  })
})
