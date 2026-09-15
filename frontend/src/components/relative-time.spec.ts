import { describe, expect, it } from 'vitest'
import { formatRelative } from './relative-time'

const now = new Date('2026-09-15T12:00:00Z')
const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000)

describe('formatRelative', () => {
  it.each([
    [30, 'en', '30 seconds ago'],
    [5 * 60, 'en', '5 minutes ago'],
    [3 * 3600, 'en', '3 hours ago'],
    [2 * 86_400, 'en', '2 days ago'],
  ])('%s seconds in %s -> %s', (seconds, locale, expected) => {
    expect(formatRelative(ago(seconds), locale, now)).toBe(expected)
  })

  it('speaks Romanian too', () => {
    expect(formatRelative(ago(5 * 60), 'ro', now)).toMatch(/minute/)
    expect(formatRelative(ago(86_400), 'ro', now)).toBe('ieri')
  })

  it('handles the future and just-now', () => {
    expect(formatRelative(new Date(now.getTime() + 3600_000), 'en', now)).toBe(
      'in 1 hour',
    )
    expect(formatRelative(now, 'en', now)).toBe('now')
  })
})
