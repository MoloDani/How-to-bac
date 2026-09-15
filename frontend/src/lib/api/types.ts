import type { Subject } from '#/lib/subjects'

export type Role = 'ADMIN' | 'CONTRIBUTOR' | 'USER'

/** GET /v1/me — the account as its owner sees it. */
export interface PublicUser {
  id: string
  email: string
  userName: string
  role: Role
  subjects: Array<Subject>
  friendCode: string
  emailVerified: boolean
  createdAt: string
}

export interface LoginResponse {
  user: PublicUser
  accessToken: string
  /** Only sent to mobile clients (X-Client-Type: mobile). */
  refreshToken?: string
}

export interface Page<T> {
  items: Array<T>
  nextCursor: string | null
}
