import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { toPage, type Page } from '../common/pagination.js';
import { FriendshipStatus } from '../generated/prisma/enums.js';
import { isUniqueViolation } from '../prisma/prisma-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { userSummarySelect, type UserSummary } from '../users/public-user.js';
import type { ListQuery } from './friends.schemas.js';
import { RelationshipState, relationshipState } from './relationship-state.js';

export interface RelationshipView {
  user: UserSummary;
  state: RelationshipState;
}

export interface FriendView {
  user: UserSummary;
  since: Date;
}

export interface RequestView {
  user: UserSummary;
  createdAt: Date;
}

/** The friendship row between two users, whichever of them sent the request. */
export const pairWhere = (a: string, b: string) => ({
  OR: [
    { requesterId: a, addresseeId: b },
    { requesterId: b, addresseeId: a },
  ],
});

const bothUsers = {
  requester: { select: userSummarySelect },
  addressee: { select: userSummarySelect },
};

@Injectable()
export class FriendsService {
  constructor(private readonly prisma: PrismaService) {}

  async listFriends(
    user: AuthUser,
    query: ListQuery,
  ): Promise<Page<FriendView>> {
    const rows = await this.prisma.friendship.findMany({
      where: {
        status: FriendshipStatus.ACCEPTED,
        OR: [{ requesterId: user.id }, { addresseeId: user.id }],
      },
      orderBy: [{ acceptedAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
      select: {
        id: true,
        requesterId: true,
        createdAt: true,
        acceptedAt: true,
        ...bothUsers,
      },
    });
    return toPage(rows, query.limit, (row) => ({
      user: row.requesterId === user.id ? row.addressee : row.requester,
      since: row.acceptedAt ?? row.createdAt,
    }));
  }

  async listRequests(
    user: AuthUser,
    direction: 'incoming' | 'outgoing',
    query: ListQuery,
  ): Promise<Page<RequestView>> {
    const incoming = direction === 'incoming';
    const rows = await this.prisma.friendship.findMany({
      where: {
        status: FriendshipStatus.PENDING,
        ...(incoming ? { addresseeId: user.id } : { requesterId: user.id }),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
      select: { id: true, createdAt: true, ...bothUsers },
    });
    return toPage(rows, query.limit, (row) => ({
      user: incoming ? row.requester : row.addressee,
      createdAt: row.createdAt,
    }));
  }

  async status(user: AuthUser, otherId: string): Promise<RelationshipView> {
    if (otherId === user.id)
      throw new BadRequestException('cannot_friend_self');
    const other = await this.findUser(otherId);

    const [row, myBlock] = await Promise.all([
      this.findPairRow(user.id, otherId),
      this.prisma.userBlock.findUnique({
        where: {
          blockerId_blockedId: { blockerId: user.id, blockedId: otherId },
        },
        select: { id: true },
      }),
    ]);
    return {
      user: other,
      state: relationshipState(user.id, row, myBlock !== null),
    };
  }

  /** `created` tells the controller whether to answer 201 (new request) or 200 (accepted theirs). */
  async sendRequest(
    user: AuthUser,
    tag: string,
  ): Promise<{ created: boolean; view: RelationshipView }> {
    const target = await this.prisma.user.findUnique({
      where: { tag },
      select: userSummarySelect,
    });
    if (!target) throw new NotFoundException('tag_not_found');
    if (target.id === user.id) {
      throw new BadRequestException('cannot_friend_self');
    }

    const blocks = await this.prisma.userBlock.findMany({
      where: {
        OR: [
          { blockerId: user.id, blockedId: target.id },
          { blockerId: target.id, blockedId: user.id },
        ],
      },
      select: { blockerId: true },
    });
    // Being blocked must look exactly like a tag that doesn't exist.
    if (blocks.some((block) => block.blockerId === target.id)) {
      throw new NotFoundException('tag_not_found');
    }
    if (blocks.length > 0) throw new ConflictException('user_blocked');

    try {
      return await this.requestOrAccept(user.id, target);
    } catch (err) {
      // They sent us a request at the same moment and the pair index rejected
      // our row: look again, which now finds (and accepts) theirs.
      if (!isUniqueViolation(err)) throw err;
      return this.requestOrAccept(user.id, target);
    }
  }

  async accept(user: AuthUser, otherId: string): Promise<RelationshipView> {
    const { count } = await this.prisma.friendship.updateMany({
      where: {
        requesterId: otherId,
        addresseeId: user.id,
        status: FriendshipStatus.PENDING,
      },
      data: { status: FriendshipStatus.ACCEPTED, acceptedAt: new Date() },
    });
    if (count === 0) throw new NotFoundException('request_not_found');

    return {
      user: await this.findUser(otherId),
      state: RelationshipState.FRIENDS,
    };
  }

  /** Decline (their request) or cancel (mine) — either way the row goes. */
  async removeRequest(user: AuthUser, otherId: string): Promise<void> {
    const { count } = await this.prisma.friendship.deleteMany({
      where: {
        status: FriendshipStatus.PENDING,
        ...pairWhere(user.id, otherId),
      },
    });
    if (count === 0) throw new NotFoundException('request_not_found');
  }

  async unfriend(user: AuthUser, otherId: string): Promise<void> {
    const { count } = await this.prisma.friendship.deleteMany({
      where: {
        status: FriendshipStatus.ACCEPTED,
        ...pairWhere(user.id, otherId),
      },
    });
    if (count === 0) throw new NotFoundException('not_friends');
  }

  async findUser(id: string): Promise<UserSummary> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userSummarySelect,
    });
    if (!user) throw new NotFoundException('user_not_found');
    return user;
  }

  private findPairRow(a: string, b: string) {
    return this.prisma.friendship.findFirst({
      where: pairWhere(a, b),
      select: { id: true, requesterId: true, status: true },
    });
  }

  private async requestOrAccept(
    meId: string,
    target: UserSummary,
  ): Promise<{ created: boolean; view: RelationshipView }> {
    const row = await this.findPairRow(meId, target.id);

    if (row?.status === FriendshipStatus.ACCEPTED) {
      throw new ConflictException('already_friends');
    }
    if (row?.requesterId === meId) {
      throw new ConflictException('request_already_sent');
    }
    if (row) {
      // They already asked us, so asking back means yes.
      await this.prisma.friendship.update({
        where: { id: row.id },
        data: { status: FriendshipStatus.ACCEPTED, acceptedAt: new Date() },
      });
      return {
        created: false,
        view: { user: target, state: RelationshipState.FRIENDS },
      };
    }

    await this.prisma.friendship.create({
      data: { requesterId: meId, addresseeId: target.id },
    });
    return {
      created: true,
      view: { user: target, state: RelationshipState.REQUEST_SENT },
    };
  }
}
