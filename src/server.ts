import Fastify from 'fastify'

const app = Fastify({ logger: true, trustProxy: true })

app.get('/healthz', async () => ({ ok: true }))

app.listen({ port: 7500, host: '0.0.0.0' })
  .catch(err => { app.log.error(err); process.exit(1) })