import type { Prisma } from '../generated/prisma/client.js';
import type { Role, Subject } from '../generated/prisma/enums.js';

/** All other users ever see of an author — never their email. */
export const authorSelect = {
  id: true,
  userName: true,
  role: true,
} satisfies Prisma.UserSelect;

export interface Author {
  id: string;
  userName: string;
  role: Role;
}

export const threadSelect = {
  id: true,
  subject: true,
  title: true,
  authorId: true,
  pinned: true,
  locked: true,
  lastMessageAt: true,
  createdAt: true,
  author: { select: authorSelect },
  _count: { select: { messages: { where: { deletedAt: null } } } },
} satisfies Prisma.ThreadSelect;

export type ThreadRow = Prisma.ThreadGetPayload<{
  select: typeof threadSelect;
}>;

export interface ThreadSummary {
  id: string;
  subject: Subject;
  title: string;
  author: Author | null;
  pinned: boolean;
  locked: boolean;
  messageCount: number;
  lastMessageAt: Date;
  createdAt: Date;
}

export const toThreadSummary = (row: ThreadRow): ThreadSummary => ({
  id: row.id,
  subject: row.subject,
  title: row.title,
  author: row.author,
  pinned: row.pinned,
  locked: row.locked,
  messageCount: row._count.messages,
  lastMessageAt: row.lastMessageAt,
  createdAt: row.createdAt,
});

export const messageSelect = {
  id: true,
  threadId: true,
  authorId: true,
  content: true,
  replyToId: true,
  editedAt: true,
  deletedAt: true,
  createdAt: true,
  author: { select: authorSelect },
} satisfies Prisma.MessageSelect;

export type MessageRow = Prisma.MessageGetPayload<{
  select: typeof messageSelect;
}>;

export interface MessageView {
  id: string;
  threadId: string;
  author: Author | null;
  /** null once deleted — the message stays as a placeholder so replies still make sense. */
  content: string | null;
  replyToId: string | null;
  edited: boolean;
  deleted: boolean;
  createdAt: Date;
}

export const toMessageView = (row: MessageRow): MessageView => {
  const deleted = row.deletedAt !== null;
  return {
    id: row.id,
    threadId: row.threadId,
    author: row.author,
    content: deleted ? null : row.content,
    replyToId: row.replyToId,
    edited: row.editedAt !== null,
    deleted,
    createdAt: row.createdAt,
  };
};

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/** Rows were fetched with `take: limit + 1`; the extra one only signals another page. */
export const toPage = <Row extends { id: string }, T>(
  rows: Row[],
  limit: number,
  map: (row: Row) => T,
): Page<T> => {
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return {
    items: page.map(map),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
};
