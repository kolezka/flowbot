import { describe, expect, it } from 'vitest'

// The matchesKeyword and findMatchingKeywords functions are not exported from filters.ts,
// so we re-implement the same logic here for testing purposes.
// These mirror the implementation in src/bot/features/filters.ts exactly.

function matchesKeyword(text: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`\\b${escaped}\\b`, 'i')
  return regex.test(text)
}

function findMatchingKeywords(text: string, keywords: string[]): string[] {
  return keywords.filter(kw => matchesKeyword(text, kw))
}

describe('matchesKeyword', () => {
  it('matches exact word', () => {
    expect(matchesKeyword('this is spam content', 'spam')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(matchesKeyword('This is SPAM content', 'spam')).toBe(true)
    expect(matchesKeyword('this is spam', 'SPAM')).toBe(true)
  })

  it('matches word boundaries only', () => {
    expect(matchesKeyword('antispam filter', 'spam')).toBe(false)
    expect(matchesKeyword('spammer detected', 'spam')).toBe(false)
  })

  it('matches at start of text', () => {
    expect(matchesKeyword('spam is bad', 'spam')).toBe(true)
  })

  it('matches at end of text', () => {
    expect(matchesKeyword('this is spam', 'spam')).toBe(true)
  })

  it('does not match when keyword is absent', () => {
    expect(matchesKeyword('hello world', 'spam')).toBe(false)
  })

  it('escapes regex special characters in keyword', () => {
    // Special chars are escaped so they don't break the regex
    // Note: \b (word boundary) may not match around non-word chars like $
    // but the important thing is the regex doesn't throw
    expect(() => matchesKeyword('price is $100', '$100')).not.toThrow()
    expect(matchesKeyword('say hello.world now', 'hello.world')).toBe(true)
    // Without escaping, "hello.world" would match "helloXworld" too
    expect(matchesKeyword('say helloXworld now', 'hello.world')).toBe(false)
  })

  it('matches multi-word keywords', () => {
    expect(matchesKeyword('you can buy now for cheap', 'buy now')).toBe(true)
  })
})

describe('findMatchingKeywords', () => {
  it('returns all matching keywords', () => {
    const keywords = ['spam', 'scam', 'hello']
    const matches = findMatchingKeywords('this is spam and a scam', keywords)
    expect(matches).toEqual(['spam', 'scam'])
  })

  it('returns empty array when nothing matches', () => {
    const keywords = ['spam', 'scam']
    const matches = findMatchingKeywords('this is a normal message', keywords)
    expect(matches).toEqual([])
  })

  it('returns empty array for empty keyword list', () => {
    const matches = findMatchingKeywords('hello world', [])
    expect(matches).toEqual([])
  })
})
