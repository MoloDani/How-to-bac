import { BadRequestException, Injectable } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { toPage, type Page } from '../common/pagination.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { userSummarySelect } from '../users/public-user.js';
import type { ListQuery } from './friends.schemas.js';
import {
  FriendsService,
  pairWhere,
  type RequestView,
} from './friends.service.js';

@Injectable()
export class BlocksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly friends: FriendsService,
  ) {}

  /** The people I blocked, most recent first. */
  async list(user: AuthUser, query: ListQuery): Promise<Page<RequestView>> {
    const rows = await this.prisma.userBlock.findMany({
      where: { blockerId: user.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
      select: {
        id: true,
        createdAt: true,
        blocked: { select: userSummarySelect },
      },
    });
    return toPage(rows, query.limit, (row) => ({
      user: row.blocked,
      createdAt: row.createdAt,
    }));
  }

  /** Ends any friendship or request between the two. Blocking twice is harmless. */
  async block(user: AuthUser, otherId: string): Promise<void> {
    if (otherId === user.id) throw new BadRequestException('cannot_block_self');
    await this.friends.findUser(otherId);

    await this.prisma.$transaction([
      this.prisma.userBlock.createMany({
        data: [{ blockerId: user.id, blockedId: otherId }],
        skipDuplicates: true,
      }),
      this.prisma.friendship.deleteMany({ where: pairWhere(user.id, otherId) }),
    ]);
  }

  /** Doesn't bring a previous friendship back. Unblocking twice is harmless. */
  async unblock(user: AuthUser, otherId: string): Promise<void> {
    await this.prisma.userBlock.deleteMany({
      where: { blockerId: user.id, blockedId: otherId },
    });
  }
}
