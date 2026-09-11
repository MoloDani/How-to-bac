import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import { API_PREFIX } from '../common/constants.js';
import type { Env } from '../config/env.js';

const REFRESH_COOKIE = 'rt';

/**
 * Where the refresh token travels.
 * Web: httpOnly cookie scoped to the auth routes, so page JS never sees it.
 * Mobile (`X-Client-Type: mobile`): JSON body, since apps keep it in secure storage.
 */
@Injectable()
export class RefreshTokenTransport {
  private readonly cookieOptions: CookieOptions;
  private readonly maxAgeMs: number;

  constructor(config: ConfigService<Env, true>) {
    this.cookieOptions = {
      httpOnly: true,
      secure: config.get('COOKIE_SECURE', { infer: true }),
      sameSite: config.get('COOKIE_SAMESITE', { infer: true }),
      path: `/${API_PREFIX}/auth`,
    };
    this.maxAgeMs =
      config.get('REFRESH_TOKEN_DAYS', { infer: true }) * 86_400_000;
  }

  /** Cookie first (web), then body (mobile). */
  read(req: Request): string | null {
    const fromCookie: unknown = req.cookies?.[REFRESH_COOKIE];
    if (typeof fromCookie === 'string' && fromCookie) return fromCookie;

    const fromBody: unknown = req.body?.refreshToken;
    return typeof fromBody === 'string' && fromBody ? fromBody : null;
  }

  /** Hands the token to the client. Returns extra response-body fields. */
  send(req: Request, res: Response, refreshToken: string) {
    if (isMobile(req)) return { refreshToken };

    res.cookie(REFRESH_COOKIE, refreshToken, {
      ...this.cookieOptions,
      maxAge: this.maxAgeMs,
    });
    return {};
  }

  clear(res: Response) {
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions);
  }
}

const isMobile = (req: Request) =>
  req.get('x-client-type')?.toLowerCase() === 'mobile';
