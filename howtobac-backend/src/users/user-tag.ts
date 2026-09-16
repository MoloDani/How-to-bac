import { z } from 'zod';

export const TAG_MIN = 3;
export const TAG_MAX = 32;

/** No leading, trailing or doubled separators, so tags stay readable. */
const TAG_PATTERN = /^[a-z0-9](?:[._]?[a-z0-9]+)*$/;

/** Names that would let someone pass for the site itself. */
export const RESERVED_TAGS = new Set([
  'admin',
  'administrator',
  'root',
  'system',
  'support',
  'help',
  'staff',
  'moderator',
  'mod',
  'official',
  'howtobac',
  'bac',
  'me',
]);

/** Accepts tags the way people paste them: "@Andrei_M " -> "andrei_m". */
export const tagSchema = z
  .string()
  .transform((value) => value.trim().replace(/^@/, '').toLowerCase())
  .pipe(
    z
      .string()
      .min(TAG_MIN, 'invalid_tag')
      .max(TAG_MAX, 'invalid_tag')
      .regex(TAG_PATTERN, 'invalid_tag'),
  )
  .refine((tag) => !RESERVED_TAGS.has(tag), 'tag_reserved');

/** Romanian names carry diacritics; tags are plain ASCII. */
const DIACRITICS = 'ăâîșşțţàáäèéëìíïòóöùúü';
const PLAIN = 'aaissttaaaeeeiiiooouuu';

/**
 * A tag suggestion from a display name: "Andrei Mihai" -> "andrei_mihai".
 * Used to seed accounts and to backfill existing ones; never unique on its
 * own, so callers still handle a clash.
 */
export function suggestTag(userName: string): string {
  const base = userName
    .toLowerCase()
    .split('')
    .map((char) => {
      const index = DIACRITICS.indexOf(char);
      return index === -1 ? char : PLAIN[index];
    })
    .join('')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, TAG_MAX)
    // Slicing can leave a trailing separator behind.
    .replace(/_$/, '');

  if (base.length >= TAG_MIN) return base;
  return base.length === 0 ? 'user' : base.padEnd(TAG_MIN, '0');
}
