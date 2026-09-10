// src/auth/routes.ts
import type { FastifyPluginAsync } from 'fastify'
import argon2 from 'argon2'
import crypto from 'node:crypto'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, currentUserId } from './middleware.js'
import { sendVerificationEmail, sendPasswordResetEmail } from './mailer.js'
import {
  signAccess,
  issueRefresh,
  rotateRefresh,
  revokeByToken,
  revokeAllForUser,
  issueAuthToken,
  consumeAuthToken,
} from './tokens.js'

// Verified against on unknown-email logins so response time doesn't
// reveal whether an account exists.
const DUMMY_HASH = await argon2.hash('placeholder-for-timing-equalisation')

const emailField = z.string().email().max(255)
const passwordField = z.string().min(8).max(200)

const registerBody = z.object({
  email: emailField,
  password: passwordField,
  displayName: z.string().min(1).max(96).optional(),
})
const loginBody = z.object({ email: emailField, password: z.string().min(1).max(200) })
const refreshBody = z.object({ refresh: z.string().min(1) })
const tokenBody = z.object({ token: z.string().min(1) })
const forgotBody = z.object({ email: emailField })
const resetBody = z.object({ token: z.string().min(1), password: passwordField })

/** Derive a unique handle from the email local part. */
async function makeHandle(addr: string): Promise<string> {
  const base =
    addr.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20) || 'user'

  for (let i = 0; i < 5; i++) {
    const candidate = `${base}${crypto.randomInt(1000, 9999)}`
    const taken = await prisma.users.findUnique({
      where: { handle: candidate },
      select: { id: true },
    })
    if (!taken) return candidate
  }
  return `user${crypto.randomUUID().slice(0, 12)}`
}

const byEmail = (req: any) => {
  const email = req.body?.email?.toLowerCase()
  return email ?? (req.headers['cf-connecting-ip'] ?? req.ip)
}

// login / register / forgot: 5 attempts per account per 15 min
const strict = {
  config: { rateLimit: { max: 5, timeWindow: '15 minutes', keyGenerator: byEmail } },
}

// verify-email / reset: keyed on IP, since the body has a token not an email
const tokenLimit = {
  config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
}

const authRoutes: FastifyPluginAsync = async (app) => {
  // ── register ────────────────────────────────────────────────────
  app.post('/register', strict, async (req, reply) => {
    const parsed = registerBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues })
    }
    const { email, password, displayName } = parsed.data

    const existing = await prisma.users.findUnique({
      where: { email },
      select: { id: true },
    })
    if (existing) {
      // Vague on purpose — don't confirm which addresses are registered.
      return reply.code(409).send({ error: 'registration_failed' })
    }

    const user = await prisma.users.create({
      data: {
        email,
        handle: await makeHandle(email),
        password_hash: await argon2.hash(password),
        display_name: displayName ?? null,
        referral_code: crypto.randomBytes(6).toString('base64url').slice(0, 8),
      },
      select: { id: true, email: true, handle: true },
    })

    await sendVerificationEmail(email, await issueAuthToken(user.id, 'email_verify'))

    return reply.code(201).send({
      user,
      emailVerified: false,
      access: signAccess(user.id),
      refresh: await issueRefresh(user.id),
    })
  })

  // ── login ───────────────────────────────────────────────────────
  app.post('/login', strict, async (req, reply) => {
    const parsed = loginBody.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' })
    const { email, password } = parsed.data

    const user = await prisma.users.findUnique({ where: { email } })

    // Always run one verify, even with no user, so both paths cost the same.
    let ok = false
    if (user?.password_hash) {
      ok = await argon2.verify(user.password_hash, password)
    } else {
      await argon2.verify(DUMMY_HASH, password)
    }

    if (!user || !ok) return reply.code(401).send({ error: 'invalid_credentials' })

    return reply.send({
      user: { id: user.id, email: user.email, handle: user.handle },
      emailVerified: user.email_verified_at !== null,
      access: signAccess(user.id),
      refresh: await issueRefresh(user.id),
    })
  })

  // ── refresh ─────────────────────────────────────────────────────
  app.post('/refresh', async (req, reply) => {
    const parsed = refreshBody.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' })

    const result = await rotateRefresh(parsed.data.refresh)
    if (!result) return reply.code(401).send({ error: 'invalid_refresh' })

    return reply.send({ access: result.access, refresh: result.refresh })
  })

  // ── logout ──────────────────────────────────────────────────────
  app.post('/logout', async (req, reply) => {
    const parsed = refreshBody.safeParse(req.body)
    if (parsed.success) await revokeByToken(parsed.data.refresh)
    return reply.code(204).send()
  })

  // ── verify email ────────────────────────────────────────────────
  app.post('/verify-email', tokenLimit, async (req, reply) => {
    const parsed = tokenBody.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' })

    const userId = await consumeAuthToken(parsed.data.token, 'email_verify')
    if (!userId) return reply.code(400).send({ error: 'invalid_or_expired_token' })

    await prisma.users.update({
      where: { id: userId },
      data: { email_verified_at: new Date() },
    })

    return reply.send({ ok: true })
  })

  // ── resend verification ─────────────────────────────────────────
  app.post(
    '/resend-verification',
    { preHandler: requireAuth, config: { rateLimit: { max: 3, timeWindow: '1 hour' } } },
    async (req, reply) => {
      const user = await prisma.users.findUnique({
        where: { id: currentUserId(req) },
        select: { id: true, email: true, email_verified_at: true },
      })
      if (!user?.email) return reply.code(400).send({ error: 'no_email' })
      if (user.email_verified_at) return reply.send({ ok: true, alreadyVerified: true })

      await sendVerificationEmail(user.email, await issueAuthToken(user.id, 'email_verify'))
      return reply.send({ ok: true })
    },
  )

  // ── forgot password ─────────────────────────────────────────────
  app.post('/forgot', strict, async (req, reply) => {
    const parsed = forgotBody.safeParse(req.body)
    // Identical response whether or not the address exists — otherwise
    // this endpoint enumerates accounts.
    if (!parsed.success) return reply.send({ ok: true })

    const user = await prisma.users.findUnique({
      where: { email: parsed.data.email },
      select: { id: true, email: true },
    })

    if (user?.email) {
      await sendPasswordResetEmail(
        user.email,
        await issueAuthToken(user.id, 'password_reset'),
      )
    }

    return reply.send({ ok: true })
  })

  // ── reset password ──────────────────────────────────────────────
  app.post('/reset', tokenLimit, async (req, reply) => {
    const parsed = resetBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body', issues: parsed.error.issues })
    }

    const userId = await consumeAuthToken(parsed.data.token, 'password_reset')
    if (!userId) return reply.code(400).send({ error: 'invalid_or_expired_token' })

    await prisma.users.update({
      where: { id: userId },
      data: {
        password_hash: await argon2.hash(parsed.data.password),
        // Whoever completed this owns the inbox, so treat it as verified.
        email_verified_at: new Date(),
      },
    })

    // Kill every existing session: if the reset happened because the
    // account was compromised, the attacker's tokens must die too.
    await revokeAllForUser(userId)

    return reply.send({ ok: true })
  })

  // ── me ──────────────────────────────────────────────────────────
  app.get('/me', { preHandler: requireAuth }, async (req, reply) => {
    const user = await prisma.users.findUnique({
      where: { id: currentUserId(req) },
      select: {
        id: true,
        email: true,
        handle: true,
        display_name: true,
        timezone: true,
        email_verified_at: true,
        created_at: true,
      },
    })
    if (!user) return reply.code(404).send({ error: 'not_found' })

    return reply.send({ ...user, emailVerified: user.email_verified_at !== null })
  })
}

export default authRoutes
