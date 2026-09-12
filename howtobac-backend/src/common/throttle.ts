import { SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Throttle, type ThrottlerOptions } from '@nestjs/throttler';

const MINUTE = 60_000;
const ACCOUNT_THROTTLE_KEY = 'accountThrottle';
const reflector = new Reflector();

export const throttlers: ThrottlerOptions[] = [
  // Per IP, per route.
  { name: 'default', ttl: MINUTE, limit: 100 },
  {
    // Per account, for credential and email-sending routes. Keyed on the
    // submitted email so guesses against one account can't be spread across
    // many IPs. Only active on handlers marked with @AccountThrottle().
    name: 'account',
    ttl: 15 * MINUTE,
    limit: 5,
    skipIf: (context) =>
      !reflector.get<boolean | undefined>(
        ACCOUNT_THROTTLE_KEY,
        context.getHandler(),
      ),
    getTracker: (req) => {
      const email: unknown = req.body?.email;
      return typeof email === 'string' && email.trim()
        ? email.trim().toLowerCase()
        : req.ip;
    },
  },
];

export const AccountThrottle = () => SetMetadata(ACCOUNT_THROTTLE_KEY, true);

/** Token-bearing routes have no email to key on, so tighten the per-IP limit. */
export const TokenThrottle = () =>
  Throttle({ default: { limit: 10, ttl: 15 * MINUTE } });

/**
 * Posting limit per IP per route. Per IP because ThrottlerGuard runs before
 * JwtAuthGuard, so the user isn't known yet.
 */
export const PostThrottle = (perMinute: number) =>
  Throttle({ default: { limit: perMinute, ttl: MINUTE } });
