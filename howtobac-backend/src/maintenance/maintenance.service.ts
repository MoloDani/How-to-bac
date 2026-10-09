import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';

const DAY_MS = 86_400_000;

/**
 * Revoked rows are kept for a week: `rotateRefresh` recognises token theft by
 * finding a revoked token, so deleting them immediately would blind it.
 */
const KEEP_REVOKED_DAYS = 7;

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Both token tables only ever grew; this keeps them to live rows plus a week. */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async pruneTokens(now = new Date()): Promise<{
    refreshTokens: number;
    authTokens: number;
  }> {
    const staleBefore = new Date(now.getTime() - KEEP_REVOKED_DAYS * DAY_MS);

    const [refreshTokens, authTokens] = await this.prisma.$transaction([
      this.prisma.refreshToken.deleteMany({
        where: {
          OR: [{ expiresAt: { lt: now } }, { revokedAt: { lt: staleBefore } }],
        },
      }),
      this.prisma.authToken.deleteMany({
        where: {
          OR: [{ expiresAt: { lt: now } }, { usedAt: { lt: staleBefore } }],
        },
      }),
    ]);

    const pruned = {
      refreshTokens: refreshTokens.count,
      authTokens: authTokens.count,
    };
    if (pruned.refreshTokens + pruned.authTokens > 0) {
      this.logger.log(
        `pruned ${pruned.refreshTokens} refresh tokens and ${pruned.authTokens} auth tokens`,
      );
    }
    return pruned;
  }
}
