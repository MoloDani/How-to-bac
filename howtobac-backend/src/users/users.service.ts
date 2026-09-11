import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { Prisma } from '../generated/prisma/client.js';
import { Role, type Subject } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  publicUserSelect,
  toPublicUser,
  type PublicUser,
} from './public-user.js';
import type { ListUsersQuery, UpdateMeDto } from './users.schemas.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async updateProfile(userId: string, dto: UpdateMeDto): Promise<PublicUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { userName: dto.userName },
      select: publicUserSelect,
    });
    return toPublicUser(user);
  }

  /** Regular users pick their own subjects. Everyone else's are admin-managed. */
  async setOwnSubjects(
    user: AuthUser,
    subjects: Subject[],
  ): Promise<PublicUser> {
    if (user.role !== Role.USER) {
      throw new ForbiddenException('subjects_managed_by_admin');
    }
    return this.replaceSubjects(user.id, subjects, null);
  }

  async setSubjects(
    userId: string,
    subjects: Subject[],
    adminId: string,
  ): Promise<PublicUser> {
    await this.ensureExists(userId);
    return this.replaceSubjects(userId, subjects, adminId);
  }

  async setRole(userId: string, role: Role): Promise<PublicUser> {
    const user = await this.prisma.$transaction(
      async (tx) => {
        const target = await tx.user.findUnique({
          where: { id: userId },
          select: { role: true },
        });
        if (!target) throw new NotFoundException('user_not_found');

        if (target.role !== role) {
          if (target.role === Role.ADMIN) {
            const admins = await tx.user.count({ where: { role: Role.ADMIN } });
            if (admins <= 1) throw new ConflictException('last_admin');
          }
          await tx.user.update({ where: { id: userId }, data: { role } });
          // Force a fresh login under the new role.
          await tx.refreshToken.updateMany({
            where: { userId, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }

        return tx.user.findUniqueOrThrow({
          where: { id: userId },
          select: publicUserSelect,
        });
      },
      // Two admins demoting each other at once must not leave zero admins.
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return toPublicUser(user);
  }

  async list(query: ListUsersQuery) {
    const rows = await this.prisma.user.findMany({
      where: {
        role: query.role,
        ...(query.q && {
          OR: [
            { email: { contains: query.q, mode: 'insensitive' } },
            { userName: { contains: query.q, mode: 'insensitive' } },
          ],
        }),
      },
      // uuid v7 ids are time-ordered, so this is also creation order.
      orderBy: { id: 'asc' },
      take: query.limit + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
      select: publicUserSelect,
    });

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    return {
      items: page.map(toPublicUser),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  /**
   * Makes the user's subjects exactly `subjects`. Subjects they already had
   * keep their original grant info.
   */
  private async replaceSubjects(
    userId: string,
    subjects: Subject[],
    grantedById: string | null,
  ): Promise<PublicUser> {
    const [, , user] = await this.prisma.$transaction([
      this.prisma.userSubject.deleteMany({
        where: { userId, subject: { notIn: subjects } },
      }),
      this.prisma.userSubject.createMany({
        data: subjects.map((subject) => ({ userId, subject, grantedById })),
        skipDuplicates: true,
      }),
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: publicUserSelect,
      }),
    ]);
    return toPublicUser(user);
  }

  private async ensureExists(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('user_not_found');
  }
}
