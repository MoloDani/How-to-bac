import { infiniteQueryOptions } from '@tanstack/react-query'
import { api } from '#/lib/api/client'
import { qs } from '#/lib/api/query-string'
import type { Page, PublicUser, Role } from '#/lib/api/types'
import type { Subject } from '#/lib/subjects'

export const adminKeys = {
  all: ['admin'] as const,
  users: (search: string) => ['admin', 'users', search] as const,
}

const PER_PAGE = 25

/** Admin-only listing; `search` matches an email or a display name. */
export const adminUsersQuery = (search: string) =>
  infiniteQueryOptions({
    queryKey: adminKeys.users(search),
    queryFn: ({ pageParam }) =>
      api.get<Page<PublicUser>>(
        `/admin/users${qs({ limit: PER_PAGE, q: search, cursor: pageParam })}`,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: Page<PublicUser>) => lastPage.nextCursor,
  })

export const setUserRole = (userId: string, role: Role) =>
  api.patch<PublicUser>(`/admin/users/${userId}/role`, { role })

/** Admin-assigned subjects aren't capped the way self-picked ones are. */
export const setUserSubjects = (userId: string, subjects: Array<Subject>) =>
  api.put<PublicUser>(`/admin/users/${userId}/subjects`, { subjects })
