import { randomInt } from 'node:crypto';
import { z } from 'zod';

/** No 0/O or 1/I/L: codes get read out loud and typed by hand. */
export const FRIEND_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const FRIEND_CODE_LENGTH = 8;

/** 31^8 ≈ 8.5·10¹¹ codes; the unique index on users.friend_code is the guarantee. */
export function generateFriendCode(): string {
  let code = '';
  for (let i = 0; i < FRIEND_CODE_LENGTH; i++) {
    code += FRIEND_CODE_ALPHABET[randomInt(FRIEND_CODE_ALPHABET.length)];
  }
  return code;
}

const friendCodePattern = new RegExp(
  `^[${FRIEND_CODE_ALPHABET}]{${FRIEND_CODE_LENGTH}}$`,
);

/** Accepts codes the way people type them: lowercase, spaces, a dash in the middle. */
export const friendCodeSchema = z
  .string()
  .transform((value) => value.replace(/[\s-]/g, '').toUpperCase())
  .pipe(z.string().regex(friendCodePattern, 'invalid friend code'));
