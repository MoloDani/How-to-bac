import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import type { Subject } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  canDeleteThread,
  canEditThread,
  canModerate,
  canReadThreads,
} from './thread-policy.js';
import {
  threadSelect,
  toPage,
  toThreadSummary,
  type Page,
  type ThreadRow,
  type ThreadSummary,
} from './thread-views.js';
import type {
  CreateThreadDto,
  ListThreadsQuery,
  ModerateThreadDto,
  UpdateThreadDto,
} from './threads.schemas.js';

@Injectable()
export class ThreadsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Subject access is checked by @SubjectAccess on the route. */
  async list(
    subject: Subject,
    query: ListThreadsQuery,
  ): Promise<Page<ThreadSummary>> {
    const rows = await this.prisma.thread.findMany({
      where: { subject, deletedAt: null },
      orderBy: [{ pinned: 'desc' }, { lastMessageAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
      select: threadSelect,
    });
    return toPage(rows, query.limit, toThreadSummary);
  }

  /** Creates the thread and its opening message together. */
  async create(
    user: AuthUser,
    subject: Subject,
    dto: CreateThreadDto,
  ): Promise<ThreadSummary> {
    const thread = await this.prisma.thread.create({
      data: {
        subject,
        title: dto.title,
        authorId: user.id,
        messages: { create: { authorId: user.id, content: dto.content } },
      },
      select: threadSelect,
    });
    return toThreadSummary(thread);
  }

  /**
   * The only way to load a thread for anything that happens in it. A deleted
   * thread doesn't exist here, so nothing under it can be read or changed.
   */
  async findLiveThread(user: AuthUser, threadId: string): Promise<ThreadRow> {
    const thread = await this.prisma.thread.findFirst({
      where: { id: threadId, deletedAt: null },
      select: threadSelect,
    });
    if (!thread) throw new NotFoundException('thread_not_found');
    if (!canReadThreads(user, thread.subject)) {
      throw new ForbiddenException('subject_access_denied');
    }
    return thread;
  }

  async get(user: AuthUser, threadId: string): Promise<ThreadSummary> {
    return toThreadSummary(await this.findLiveThread(user, threadId));
  }

  async rename(
    user: AuthUser,
    threadId: string,
    dto: UpdateThreadDto,
  ): Promise<ThreadSummary> {
    const thread = await this.findLiveThread(user, threadId);
    if (!canEditThread(user, thread))
      throw new ForbiddenException('not_author');

    const updated = await this.prisma.thread.update({
      where: { id: threadId },
      data: { title: dto.title },
      select: threadSelect,
    });
    return toThreadSummary(updated);
  }

  async moderate(
    user: AuthUser,
    threadId: string,
    dto: ModerateThreadDto,
  ): Promise<ThreadSummary> {
    const thread = await this.findLiveThread(user, threadId);
    if (!canModerate(user, thread.subject)) {
      throw new ForbiddenException('not_moderator');
    }

    const updated = await this.prisma.thread.update({
      where: { id: threadId },
      data: { pinned: dto.pinned, locked: dto.locked },
      select: threadSelect,
    });
    return toThreadSummary(updated);
  }

  /** Soft delete: the thread and all its messages stay in the database. */
  async remove(user: AuthUser, threadId: string): Promise<void> {
    const thread = await this.findLiveThread(user, threadId);
    if (!canDeleteThread(user, thread)) {
      throw new ForbiddenException('not_author');
    }

    await this.prisma.thread.update({
      where: { id: threadId },
      data: { deletedAt: new Date() },
    });
  }
}
