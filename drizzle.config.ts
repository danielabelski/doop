import { defineConfig } from 'drizzle-kit'

/** Migration generation only: `npx drizzle-kit generate` after editing
 *  server/db/schema.ts or auth-schema.ts. Migrations are applied at boot by
 *  server/db/index.ts (both PGlite and real Postgres), never by drizzle-kit. */
export default defineConfig({
  dialect: 'postgresql',
  schema: ['./server/db/schema.ts', './server/db/auth-schema.ts'],
  out: './server/db/migrations',
})
