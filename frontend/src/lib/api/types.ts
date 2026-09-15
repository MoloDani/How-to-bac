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

/** All anyone else sees of a user: thread authors, friends, requests. */
export interface UserSummary {
  id: string
  userName: string
  role: Role
}

export interface Thread {
  id: string
  subject: Subject
  title: string
  /** null once the author's account is removed. */
  author: UserSummary | null
  pinned: boolean
  locked: boolean
  messageCount: number
  lastMessageAt: string
  createdAt: string
}

export interface Message {
  id: string
  threadId: string
  author: UserSummary | null
  /** null once deleted; the placeholder stays so replies still make sense. */
  content: string | null
  replyToId: string | null
  edited: boolean
  deleted: boolean
  createdAt: string
}

/** How the signed-in user relates to someone else. */
export type RelationshipState =
  'NONE' | 'REQUEST_SENT' | 'REQUEST_RECEIVED' | 'FRIENDS' | 'BLOCKED'

export interface Relationship {
  user: UserSummary
  state: RelationshipState
}

export interface FriendView {
  user: UserSummary
  since: string
}

export interface RequestView {
  user: UserSummary
  createdAt: string
}
