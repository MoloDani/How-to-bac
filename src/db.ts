// src/db.ts
import { PrismaClient } from './generated/prisma/client.js'

// Single instance for the whole process. tsx watch reloads modules on
// every save, so constructing a client per import would exhaust the
// connection pool within a few minutes of editing.
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'],
})
