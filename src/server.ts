// src/server.ts
import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
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

await app.register(rateLimit, {
  global: true,
  max: 100,
  timeWindow: '1 minute',
  hook: 'preHandler',
  keyGenerator: (req) => (req.headers['cf-connecting-ip'] as string) ?? req.ip,
})

await app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  // Cloudflare sets this; X-Forwarded-For is spoofable from inside the LAN.
  keyGenerator: (req) => (req.headers['cf-connecting-ip'] as string) ?? req.ip,
})

await app.register(swagger, {
  openapi: {
    info: {
      title: 'How-to-bac API',
      version: '1.0.0',
    },
    tags: [{ name: 'system' }, { name: 'auth' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
})

await app.register(swaggerUi, {
  routePrefix: '/documentation',
})

app.get('/healthz', {
  schema: {
    tags: ['system'],
    response: {
      200: {
        type: 'object',
        properties: { ok: { type: 'boolean' } },
        required: ['ok'],
      },
    },
  },
}, async () => ({ ok: true }))

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
