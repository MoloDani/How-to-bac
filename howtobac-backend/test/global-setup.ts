import { execFileSync } from 'node:child_process';

/** Wipes the test database and applies all migrations before the e2e run. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      'Set TEST_DATABASE_URL in .env — a database the e2e tests are allowed to wipe.',
    );
  }
  if (url === process.env.DATABASE_URL) {
    throw new Error(
      'TEST_DATABASE_URL must differ from DATABASE_URL: the e2e run wipes it.',
    );
  }

  execFileSync('node_modules/.bin/prisma', ['migrate', 'reset', '--force'], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });
}
