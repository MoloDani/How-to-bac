import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Not needed by `prisma generate`, so a missing value must not break installs.
    url: process.env.DATABASE_URL,
    // Only used by `prisma migrate dev` when creating new migrations.
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
