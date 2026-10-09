import { SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Throttle, type ThrottlerOptions } from '@nestjs/throttler';
import type { Request } from 'express';
import { JWT_ISSUER } from './constants.js';

const MINUTE = 60_000;
const ACCOUNT_THROTTLE_KEY = 'accountThrottle';
const reflector = new Reflector();

/**
 * Who a request counts against. ThrottlerGuard runs before JwtAuthGuard, so
 * `req.user` isn't set yet — but the token can be verified here, which is what
 * lets a whole school behind one IP share the site without sharing a quota.
 * The signature has to be checked: an unverified `sub` would let anyone mint
 * themselves a fresh bucket.
 */
export const trackerFor = (jwt: JwtService) => (req: Request) => {
  const header = req.get('authorization');
  if (header?.startsWith('Bearer ')) {
    try {
      const { sub } = jwt.verify<{ sub: string }>(header.slice(7).trim());
      return `user:${sub}`;
    } catch {
      // Expired or forged: fall through to the IP.
    }
  }
  return `ip:${req.ip}`;
};

export function buildThrottlers(secret: string): ThrottlerOptions[] {
  const jwt = new JwtService({
    secret,
    verifyOptions: { issuer: JWT_ISSUER, algorithms: ['HS256'] },
  });
  const track = trackerFor(jwt);

  return [
    // Per account where we know it, per IP otherwise. Per route either way.
    {
      name: 'default',
      ttl: MINUTE,
      limit: 100,
      // The library types the request loosely; it is an express one.
      getTracker: (req) => track(req as Request),
    },
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
}

export const AccountThrottle = () => SetMetadata(ACCOUNT_THROTTLE_KEY, true);

/** Token-bearing routes have no account to key on, so tighten the per-IP limit. */
export const TokenThrottle = () =>
  Throttle({ default: { limit: 10, ttl: 15 * MINUTE } });

/** Posting limit per account (per IP while signed out), per route. */
export const PostThrottle = (perMinute: number) =>
  Throttle({ default: { limit: perMinute, ttl: MINUTE } });
