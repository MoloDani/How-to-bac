import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  canDeleteMessage,
  canEditMessage,
  canPostIn,
} from './thread-policy.js';
import {
  messageSelect,
  toMessageView,
  toPage,
  type MessageRow,
  type MessageView,
  type Page,
  type ThreadRow,
} from './thread-views.js';
import type {
  CreateMessageDto,
  ListMessagesQuery,
  UpdateMessageDto,
} from './threads.schemas.js';
import { ThreadsService } from './threads.service.js';

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly threads: ThreadsService,
  ) {}

  /** Oldest first, including placeholders for deleted messages. */
  async list(
    user: AuthUser,
    threadId: string,
    query: ListMessagesQuery,
  ): Promise<Page<MessageView>> {
    await this.threads.findLiveThread(user, threadId);

    const rows = await this.prisma.message.findMany({
      // uuid v7 ids are time-ordered, so "after this id" means "newer than it".
      where: { threadId, ...(query.after && { id: { gt: query.after } }) },
      orderBy: { id: 'asc' },
      take: query.limit + 1,
      select: messageSelect,
    });
    return toPage(rows, query.limit, toMessageView);
  }

  async create(
    user: AuthUser,
    threadId: string,
    dto: CreateMessageDto,
  ): Promise<MessageView> {
    const thread = await this.threads.findLiveThread(user, threadId);
    if (!canPostIn(user, thread)) throw new ForbiddenException('thread_locked');

    if (dto.replyToId) {
      const target = await this.prisma.message.findFirst({
        where: { id: dto.replyToId, threadId },
        select: { id: true },
      });
      if (!target) throw new BadRequestException('reply_to_not_in_thread');
    }

    const now = new Date();
    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          threadId,
          authorId: user.id,
          content: dto.content,
          replyToId: dto.replyToId,
          createdAt: now,
        },
        select: messageSelect,
      }),
      this.prisma.thread.update({
        where: { id: threadId },
        data: { lastMessageAt: now },
      }),
    ]);
    return toMessageView(message);
  }

  async update(
    user: AuthUser,
    messageId: string,
    dto: UpdateMessageDto,
  ): Promise<MessageView> {
    const { message, thread } = await this.findMessage(user, messageId);
    if (!canEditMessage(user, thread, message)) {
      throw new ForbiddenException('not_author');
    }

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { content: dto.content, editedAt: new Date() },
      select: messageSelect,
    });
    return toMessageView(updated);
  }

  /** Soft delete: the message stays as a placeholder. */
  async remove(user: AuthUser, messageId: string): Promise<void> {
    const { message, thread } = await this.findMessage(user, messageId);
    if (!canDeleteMessage(user, thread, message)) {
      throw new ForbiddenException('not_author');
    }

    await this.prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
    });
  }

  /** Loads a message through its live thread, so a deleted thread's messages stay out of reach. */
  private async findMessage(
    user: AuthUser,
    messageId: string,
  ): Promise<{ message: MessageRow; thread: ThreadRow }> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: messageSelect,
    });
    if (!message) throw new NotFoundException('message_not_found');

    const thread = await this.threads.findLiveThread(user, message.threadId);
    if (message.deletedAt) throw new NotFoundException('message_not_found');

    return { message, thread };
  }
}
