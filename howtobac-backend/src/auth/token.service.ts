import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Env } from '../config/env.js';
import { AuthTokenPurpose } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

const AUTH_TOKEN_TTL_MS: Record<AuthTokenPurpose, number> = {
  [AuthTokenPurpose.EMAIL_VERIFY]: 24 * HOUR_MS,
  [AuthTokenPurpose.PASSWORD_RESET]: HOUR_MS,
};

export interface AccessPayload {
  sub: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

const randomToken = () => randomBytes(32).toString('base64url');

@Injectable()
export class TokenService {
  private readonly refreshTtlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    config: ConfigService<Env, true>,
  ) {
    this.refreshTtlMs =
      config.get('REFRESH_TOKEN_DAYS', { infer: true }) * DAY_MS;
  }

  // ---------- access tokens (stateless JWT) ----------

  verifyAccess(token: string): Promise<AccessPayload> {
    return this.jwt.verifyAsync<AccessPayload>(token);
  }

  async issuePair(userId: string, familyId?: string): Promise<TokenPair> {
    return {
      accessToken: await this.jwt.signAsync({ sub: userId }),
      refreshToken: await this.issueRefresh(userId, familyId),
    };
  }

  // ---------- refresh tokens (opaque, rotating) ----------

  private async issueRefresh(userId: string, familyId: string = randomUUID()) {
    const token = randomToken();
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: sha256(token),
        familyId,
        expiresAt: new Date(Date.now() + this.refreshTtlMs),
      },
    });
    return token;
  }

  /**
   * Exchange a refresh token for a new pair.
   * A revoked token presented again means someone has a copy they shouldn't,
   * so the whole family is revoked — attacker and legitimate user both get
   * logged out.
   */
  async rotateRefresh(token: string): Promise<TokenPair | null> {
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(token) },
    });
    if (!row) return null;

    if (row.revokedAt !== null) {
      await this.revokeFamily(row.familyId);
      return null;
    }
    if (row.expiresAt < new Date()) return null;

    // Conditional update: if two requests race with the same token (e.g. two
    // browser tabs), only one wins. The loser just fails — not treated as theft.
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id: row.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count === 0) return null;

    return this.issuePair(row.userId, row.familyId);
  }

  async revokeByToken(token: string) {
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(token) },
      select: { familyId: true },
    });
    if (row) await this.revokeFamily(row.familyId);
  }

  private async revokeFamily(familyId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Log the user out everywhere. */
  async revokeAllForUser(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ---------- single-use tokens (verify / reset) ----------

  /**
   * Issues a raw token (emailed to the user) and stores only its hash.
   * Any previous unused token for the same purpose is burned, so an old link
   * sitting in the inbox stops working once a new one is sent.
   */
  async issueAuthToken(
    userId: string,
    purpose: AuthTokenPurpose,
  ): Promise<string> {
    const raw = randomToken();

    await this.prisma.$transaction([
      this.prisma.authToken.updateMany({
        where: { userId, purpose, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.authToken.create({
        data: {
          userId,
          purpose,
          tokenHash: sha256(raw),
          expiresAt: new Date(Date.now() + AUTH_TOKEN_TTL_MS[purpose]),
        },
      }),
    ]);

    return raw;
  }

  /** Validates and burns a single-use token. Returns the user id or null. */
  async consumeAuthToken(
    raw: string,
    purpose: AuthTokenPurpose,
  ): Promise<string | null> {
    const row = await this.prisma.authToken.findUnique({
      where: { tokenHash: sha256(raw) },
    });

    if (!row) return null;
    if (row.purpose !== purpose) return null;
    if (row.usedAt !== null) return null;
    if (row.expiresAt < new Date()) return null;

    // Conditional update: if two requests race, only one flips usedAt.
    const { count } = await this.prisma.authToken.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (count === 0) return null;

    return row.userId;
  }
}
