import { describe, expect, it } from 'vitest'
import {
  canDeleteMessage,
  canEditMessage,
  canEditThread,
  canModerate,
  canOpenSubject,
  canPost,
  visibleSubjects,
} from './permissions'
import { SUBJECTS } from './subjects'
import type { Message, PublicUser, Thread } from './api/types'

const MATH = 'MATHEMATICS'
const viewer = (
  id: string,
  role: PublicUser['role'],
  subjects: Array<'MATHEMATICS' | 'PHYSICS'> = [],
) => ({ id, role, subjects })

const author = viewer('author', 'USER', [MATH])
const reader = viewer('reader', 'USER', [MATH])
const outsider = viewer('outsider', 'USER', ['PHYSICS'])
const mathMod = viewer('math-mod', 'CONTRIBUTOR', [MATH])
const physicsMod = viewer('physics-mod', 'CONTRIBUTOR', ['PHYSICS'])
const admin = viewer('admin', 'ADMIN')

const thread = {
  id: 't1',
  subject: MATH,
  title: 'Derivatives',
  author: { id: author.id, userName: 'Ana', role: 'USER' },
  pinned: false,
  locked: false,
  messageCount: 2,
  lastMessageAt: '',
  createdAt: '',
} as Thread

const message = {
  id: 'm1',
  threadId: 't1',
  author: { id: author.id, userName: 'Ana', role: 'USER' },
  content: 'hello',
  replyToId: null,
  edited: false,
  deleted: false,
  createdAt: '',
} as Message

describe('permissions', () => {
  it('shows admins every subject, others only theirs', () => {
    expect(visibleSubjects(admin)).toHaveLength(SUBJECTS.length)
    expect(visibleSubjects(reader)).toEqual([MATH])
    expect(canOpenSubject(outsider, MATH)).toBe(false)
    expect(canOpenSubject(admin, MATH)).toBe(true)
  })

  it.each([
    ['author', author, false],
    ['reader', reader, false],
    ['math contributor', mathMod, true],
    ['physics contributor', physicsMod, false],
    ['admin', admin, true],
  ])('moderation: %s -> %s', (_, user, allowed) => {
    expect(canModerate(user, MATH)).toBe(allowed)
  })

  it('locks the composer for everyone but moderators', () => {
    const locked = { ...thread, locked: true }
    expect(canPost(reader, thread)).toBe(true)
    expect(canPost(reader, locked)).toBe(false)
    expect(canPost(mathMod, locked)).toBe(true)
    expect(canPost(admin, locked)).toBe(true)
  })

  it('lets only the author edit, but moderators delete', () => {
    expect(canEditMessage(author, message)).toBe(true)
    expect(canEditMessage(mathMod, message)).toBe(false)
    expect(canDeleteMessage(reader, MATH, message)).toBe(false)
    expect(canDeleteMessage(author, MATH, message)).toBe(true)
    expect(canDeleteMessage(mathMod, MATH, message)).toBe(true)
  })

  it('offers nothing on a deleted message', () => {
    const deleted = { ...message, deleted: true, content: null }
    expect(canEditMessage(author, deleted)).toBe(false)
    expect(canDeleteMessage(admin, MATH, deleted)).toBe(false)
  })

  it('lets the thread author or a moderator rename and delete it', () => {
    expect(canEditThread(author, thread)).toBe(true)
    expect(canEditThread(reader, thread)).toBe(false)
    expect(canEditThread(mathMod, thread)).toBe(true)
  })

  it('treats content from removed accounts as nobody’s', () => {
    expect(canEditMessage(author, { ...message, author: null })).toBe(false)
    expect(canEditThread(author, { ...thread, author: null })).toBe(false)
  })
})
