// src/server.ts
import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import { env } from './env.js'
import { prisma } from './db.js'
import authRoutes from './auth/routes.js'

// users.id is BIGINT and JSON.stringify throws on BigInt. Fix once, globally.
// @ts-expect-error augmenting a builtin prototype
BigInt.prototype.toJSON = function () {
  return this.toString()
}

const app = Fastify({
  logger: env.NODE_ENV === 'production' ? true : { transport: { target: 'pino-pretty' } },
  // Requests arrive Cloudflare -> NPM -> here, so req.ip would otherwise be
  // 192.168.3.100 for every user and rate limits would apply globally.
  trustProxy: true,
})

await app.register(cors, {
  origin: [env.APP_BASE_URL],
  credentials: false, // bearer tokens, not cookies
})

await app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  // Cloudflare sets this; X-Forwarded-For is spoofable from inside the LAN.
  keyGenerator: (req) => (req.headers['cf-connecting-ip'] as string) ?? req.ip,
})

app.get('/healthz', async () => ({ ok: true }))

await app.register(authRoutes, { prefix: '/v1/auth' })

const shutdown = async () => {
  await app.close()
  await prisma.$disconnect()
  process.exit(0)
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

try {
  await app.listen({ port: env.PORT, host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
