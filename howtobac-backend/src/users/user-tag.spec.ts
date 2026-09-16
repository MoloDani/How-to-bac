import { suggestTag, tagSchema, TAG_MAX } from './user-tag.js';

describe('user tags', () => {
  it('normalizes what people type', () => {
    expect(tagSchema.parse('@Andrei_M')).toBe('andrei_m');
    expect(tagSchema.parse('  ana.maria  ')).toBe('ana.maria');
    expect(tagSchema.parse('B2x')).toBe('b2x');
  });

  it.each([
    'ab', // too short
    '_ana', // leading separator
    'ana_', // trailing separator
    'a..b', // doubled separator
    'Ana Maria', // spaces
    'ana-maria', // dash isn't allowed
    'ana@maria',
    'ană',
    '',
    'a'.repeat(TAG_MAX + 1),
  ])('rejects %j', (input) => {
    expect(tagSchema.safeParse(input).success).toBe(false);
  });

  it.each(['admin', 'HowToBac', '@me'])('rejects the reserved %j', (input) => {
    expect(tagSchema.safeParse(input).success).toBe(false);
  });

  describe('suggestTag', () => {
    it('folds diacritics and separators', () => {
      expect(suggestTag('Andrei Mihai')).toBe('andrei_mihai');
      expect(suggestTag('Ștefan Țârlea')).toBe('stefan_tarlea');
      expect(suggestTag('  Ana-Maria!! ')).toBe('ana_maria');
    });

    it('always returns something a tag schema accepts', () => {
      for (const name of ['', '!!!', 'x', 'Ab', 'é', 'A'.repeat(80)]) {
        expect(tagSchema.safeParse(suggestTag(name)).success).toBe(true);
      }
    });

    it('stays within the column length', () => {
      expect(suggestTag('Maria '.repeat(20)).length).toBeLessThanOrEqual(
        TAG_MAX,
      );
    });
  });
});
