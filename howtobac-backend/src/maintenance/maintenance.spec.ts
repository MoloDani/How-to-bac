import { MaintenanceService } from './maintenance.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

describe('MaintenanceService', () => {
  const now = new Date('2026-10-06T03:00:00.000Z');
  const weekAgo = new Date('2026-09-29T03:00:00.000Z');

  const run = async (counts = [{ count: 3 }, { count: 4 }]) => {
    const deleteMany = vi.fn((args: unknown) => args);
    const prisma = {
      refreshToken: { deleteMany },
      authToken: { deleteMany },
      $transaction: vi.fn().mockResolvedValue(counts),
    } as unknown as PrismaService;

    const pruned = await new MaintenanceService(prisma).pruneTokens(now);
    return { pruned, args: deleteMany.mock.calls.map(([arg]) => arg) };
  };

  it('deletes expired tokens and revoked ones older than a week', async () => {
    const { args } = await run();

    expect(args[0]).toEqual({
      where: {
        OR: [{ expiresAt: { lt: now } }, { revokedAt: { lt: weekAgo } }],
      },
    });
    expect(args[1]).toEqual({
      where: { OR: [{ expiresAt: { lt: now } }, { usedAt: { lt: weekAgo } }] },
    });
  });

  it('reports what it removed', async () => {
    const { pruned } = await run([{ count: 3 }, { count: 4 }]);
    expect(pruned).toEqual({ refreshTokens: 3, authTokens: 4 });
  });
});
