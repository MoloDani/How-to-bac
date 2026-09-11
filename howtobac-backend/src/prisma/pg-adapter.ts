import { PrismaPg } from '@prisma/adapter-pg';

/**
 * The pg driver ignores `?schema=` in the URL, so hand it to the adapter
 * explicitly — otherwise every query would go to the `public` schema.
 */
export function createPgAdapter(databaseUrl: string) {
  const url = new URL(databaseUrl);
  const schema = url.searchParams.get('schema') ?? undefined;
  url.searchParams.delete('schema');
  return new PrismaPg({ connectionString: url.toString() }, { schema });
}
