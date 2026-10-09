import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'
import { api } from '#/lib/api/client'
import { qs } from '#/lib/api/query-string'
import type { Message, Page, Thread } from '#/lib/api/types'
import type { Subject } from '#/lib/subjects'

export const threadKeys = {
  all: ['threads'] as const,
  list: (subject: Subject) => ['threads', 'list', subject] as const,
  detail: (threadId: string) => ['threads', 'detail', threadId] as const,
  messages: (threadId: string) => ['threads', 'messages', threadId] as const,
}

const THREADS_PER_PAGE = 20
const MESSAGES_PER_PAGE = 50

/** Pinned first, then by most recent message. */
export const threadListQuery = (subject: Subject) =>
  infiniteQueryOptions({
    queryKey: threadKeys.list(subject),
    queryFn: ({ pageParam }) =>
      api.get<Page<Thread>>(
        `/subjects/${subject}/threads${qs({ limit: THREADS_PER_PAGE, cursor: pageParam })}`,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: Page<Thread>) => lastPage.nextCursor,
  })

export const threadQuery = (threadId: string) =>
  queryOptions({
    queryKey: threadKeys.detail(threadId),
    queryFn: () => api.get<Thread>(`/threads/${threadId}`),
  })

/**
 * Oldest first, paging forward with `after`. Deliberately not polled: a
 * refetchInterval here would re-request every page that's been loaded, so a
 * long thread would make several calls per tick. `newMessagesQuery` below
 * watches the end of the thread instead.
 */
export const messagesQuery = (threadId: string) =>
  infiniteQueryOptions({
    queryKey: threadKeys.messages(threadId),
    queryFn: ({ pageParam }) =>
      api.get<Page<Message>>(
        `/threads/${threadId}/messages${qs({ limit: MESSAGES_PER_PAGE, after: pageParam })}`,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: Page<Message>) => lastPage.nextCursor,
  })

/**
 * What arrived after the newest message on screen: one request every ten
 * seconds however much history is loaded. The key moves on by itself once the
 * replies are appended, because `afterId` becomes the new newest id.
 */
export const newMessagesQuery = (threadId: string, afterId: string | null) =>
  queryOptions({
    queryKey: [...threadKeys.messages(threadId), 'after', afterId] as const,
    queryFn: () =>
      api.get<Page<Message>>(
        `/threads/${threadId}/messages${qs({ limit: MESSAGES_PER_PAGE, after: afterId })}`,
      ),
    enabled: afterId !== null,
    refetchInterval: 10_000,
    // The tail is only interesting while it's fresh.
    gcTime: 30_000,
  })

/** Adds polled messages to the last loaded page, skipping any already there. */
export const appendMessages = (
  data: { pages: Array<Page<Message>>; pageParams: Array<string | null> },
  arrivals: Array<Message>,
) => {
  const known = new Set(
    data.pages.flatMap((page) => page.items.map((item) => item.id)),
  )
  const fresh = arrivals.filter((message) => !known.has(message.id))
  if (fresh.length === 0) return data

  const pages = [...data.pages]
  const last = pages[pages.length - 1]
  pages[pages.length - 1] = { ...last, items: [...last.items, ...fresh] }
  return { ...data, pages }
}

export const createThread = (
  subject: Subject,
  body: { title: string; content: string },
) => api.post<Thread>(`/subjects/${subject}/threads`, body)

export const renameThread = (threadId: string, title: string) =>
  api.patch<Thread>(`/threads/${threadId}`, { title })

export const moderateThread = (
  threadId: string,
  body: { pinned?: boolean; locked?: boolean },
) => api.patch<Thread>(`/threads/${threadId}/moderation`, body)

export const deleteThread = (threadId: string) =>
  api.remove<void>(`/threads/${threadId}`)

export const postMessage = (
  threadId: string,
  body: { content: string; replyToId?: string },
) => api.post<Message>(`/threads/${threadId}/messages`, body)

export const editMessage = (messageId: string, content: string) =>
  api.patch<Message>(`/messages/${messageId}`, { content })

export const deleteMessage = (messageId: string) =>
  api.remove<void>(`/messages/${messageId}`)
