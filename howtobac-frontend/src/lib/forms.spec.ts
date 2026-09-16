import { describe, expect, it } from 'vitest'
import { isTagShaped, normalizeTag, tagField } from './forms'

describe('tag fields', () => {
  it('normalizes what people paste', () => {
    expect(normalizeTag('  @Andrei_M ')).toBe('andrei_m')
    expect(normalizeTag('@@ana.maria')).toBe('ana.maria')
  })

  it('accepts the tags the backend accepts', () => {
    for (const tag of ['andrei_m', 'ana.maria', 'b2x', 'a'.repeat(32)]) {
      expect(tagField.safeParse(tag).success).toBe(true)
    }
  })

  it.each(['ab', '_ana', 'ana_', 'a..b', 'ana maria', 'ana-maria', 'Ana'])(
    'rejects %j',
    (tag) => {
      expect(tagField.safeParse(tag).success).toBe(false)
    },
  )

  it('only asks the API about usable tags', () => {
    expect(isTagShaped('andrei_m')).toBe(true)
    expect(isTagShaped('an')).toBe(false)
  })
})
