// Creates the first admin, or promotes an existing account. Run: pnpm db:seed
import 'dotenv/config';
import argon2 from 'argon2';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { Role } from '../src/generated/prisma/enums.js';
import { createPgAdapter } from '../src/prisma/pg-adapter.js';

const databaseUrl = process.env.DATABASE_URL;
const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.SEED_ADMIN_PASSWORD;

if (!databaseUrl || !email || !password || password.length < 8) {
  console.error(
    'Set DATABASE_URL, SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (min 8 characters) in .env',
  );
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: createPgAdapter(databaseUrl) });

try {
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { emailVerifiedAt: true },
  });

  if (existing) {
    // The existing password is left untouched.
    await prisma.user.update({
      where: { email },
      data: {
        role: Role.ADMIN,
        emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
      },
    });
    console.log(`Promoted ${email} to ADMIN`);
  } else {
    await prisma.user.create({
      data: {
        email,
        passwordHash: await argon2.hash(password),
        userName: 'Admin',
        role: Role.ADMIN,
        emailVerifiedAt: new Date(),
      },
    });
    console.log(`Created admin ${email}`);
  }
} finally {
  await prisma.$disconnect();
}
