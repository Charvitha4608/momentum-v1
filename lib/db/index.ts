import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema"

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export const db = drizzle(pool, { schema })

// Exported so lib helpers that accept `db` as a parameter can type it correctly
// without pulling in drizzle internals directly.
export type DbType = typeof db

