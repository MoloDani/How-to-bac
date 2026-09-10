// src/auth/middleware.ts
import type { FastifyReply, FastifyRequest } from 'fastify'
import { verifyAccess } from './tokens.js'

// Declaration merging: makes req.userId visible to TypeScript app-wide.
declare module 'fastify' {
  interface FastifyRequest {
    userId?: bigint
  }
}

/** Rejects the request unless a valid access token is present. */
export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const header = req.headers.authorization

  if (!header?.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'missing_token' })
  }

  try {
    req.userId = BigInt(verifyAccess(header.slice(7).trim()).sub)
  } catch (err: any) {
    // Separate code for expiry so the client knows to silently refresh
    // instead of bouncing the user to the login screen.
    return reply.code(401).send({
      error: err?.name === 'TokenExpiredError' ? 'token_expired' : 'invalid_token',
    })
  }
}

/** Same check but never rejects — for routes that vary by signed-in state. */
export async function optionalAuth(req: FastifyRequest) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return
  try {
    req.userId = BigInt(verifyAccess(header.slice(7).trim()).sub)
  } catch {
    /* treat as anonymous */
  }
}

/** Narrowing helper — req.userId is bigint|undefined in the type system. */
export function currentUserId(req: FastifyRequest): bigint {
  if (req.userId === undefined) {
    throw new Error('currentUserId called on an unauthenticated route')
  }
  return req.userId
}
