import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { JWT_ISSUER } from './constants.js';
import { trackerFor } from './throttle.js';

const SECRET = 'throttle-spec-secret-at-least-32-characters';

const jwt = new JwtService({
  secret: SECRET,
  signOptions: { issuer: JWT_ISSUER, expiresIn: '15m' },
  verifyOptions: { issuer: JWT_ISSUER, algorithms: ['HS256'] },
});

const track = trackerFor(jwt);

/** Just enough of a request for the tracker. */
const request = (authorization?: string) =>
  ({
    ip: '203.0.113.7',
    get: (name: string) =>
      name.toLowerCase() === 'authorization' ? authorization : undefined,
  }) as unknown as Request;

describe('throttle tracker', () => {
  it('counts a signed-in request against the account, not the address', () => {
    const token = jwt.sign({ sub: 'user-1' });
    expect(track(request(`Bearer ${token}`))).toBe('user:user-1');
  });

  it('falls back to the IP when there is no token', () => {
    expect(track(request())).toBe('ip:203.0.113.7');
    expect(track(request('Basic abc'))).toBe('ip:203.0.113.7');
  });

  it.each([
    ['a forged signature', 'Bearer not.a.token'],
    [
      'another issuer',
      `Bearer ${new JwtService({ secret: SECRET, signOptions: { issuer: 'someone-else' } }).sign({ sub: 'user-2' })}`,
    ],
    [
      'another secret',
      `Bearer ${new JwtService({ secret: 'a-different-secret-of-at-least-32-chars', signOptions: { issuer: JWT_ISSUER } }).sign({ sub: 'user-3' })}`,
    ],
    [
      'an expired token',
      `Bearer ${jwt.sign({ sub: 'user-4' }, { expiresIn: '-1m' })}`,
    ],
  ])('refuses to take %s at its word', (_label, authorization) => {
    expect(track(request(authorization))).toBe('ip:203.0.113.7');
  });
});
