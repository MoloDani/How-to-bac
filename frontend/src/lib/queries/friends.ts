import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'
import { api } from '#/lib/api/client'
import { qs } from '#/lib/api/query-string'
import type {
  FriendView,
  Page,
  Relationship,
  RequestView,
} from '#/lib/api/types'

export type RequestDirection = 'incoming' | 'outgoing'

export const friendKeys = {
  all: ['friends'] as const,
  list: () => ['friends', 'list'] as const,
  requests: (direction: RequestDirection) =>
    ['friends', 'requests', direction] as const,
  blocks: () => ['friends', 'blocks'] as const,
  status: (userId: string) => ['friends', 'status', userId] as const,
}

const PER_PAGE = 50

export const friendsQuery = () =>
  infiniteQueryOptions({
    queryKey: friendKeys.list(),
    queryFn: ({ pageParam }) =>
      api.get<Page<FriendView>>(
        `/friends${qs({ limit: PER_PAGE, cursor: pageParam })}`,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: Page<FriendView>) => lastPage.nextCursor,
  })

export const requestsQuery = (direction: RequestDirection) =>
  infiniteQueryOptions({
    queryKey: friendKeys.requests(direction),
    queryFn: ({ pageParam }) =>
      api.get<Page<RequestView>>(
        `/friends/requests/${direction}${qs({ limit: PER_PAGE, cursor: pageParam })}`,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: Page<RequestView>) => lastPage.nextCursor,
  })

export const blocksQuery = () =>
  infiniteQueryOptions({
    queryKey: friendKeys.blocks(),
    queryFn: ({ pageParam }) =>
      api.get<Page<RequestView>>(
        `/blocks${qs({ limit: PER_PAGE, cursor: pageParam })}`,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: Page<RequestView>) => lastPage.nextCursor,
  })

/** Only fetched when an author menu opens, hence `enabled` at the call site. */
export const relationshipQuery = (userId: string) =>
  queryOptions({
    queryKey: friendKeys.status(userId),
    queryFn: () => api.get<Relationship>(`/friends/status/${userId}`),
    staleTime: 30_000,
  })

/** Requests can only be sent by friend code — never by user id. */
export const sendFriendRequest = (friendCode: string) =>
  api.post<Relationship>('/friends/requests', { friendCode })

export const acceptRequest = (userId: string) =>
  api.post<Relationship>(`/friends/requests/${userId}/accept`)

/** Declines their request, or cancels yours. */
export const removeRequest = (userId: string) =>
  api.remove<void>(`/friends/requests/${userId}`)

export const unfriend = (userId: string) =>
  api.remove<void>(`/friends/${userId}`)

export const blockUser = (userId: string) => api.put<void>(`/blocks/${userId}`)

export const unblockUser = (userId: string) =>
  api.remove<void>(`/blocks/${userId}`)
