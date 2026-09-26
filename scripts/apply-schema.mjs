// Applies supabase/schema.sql directly via SUPABASE_DB_URL (a direct Postgres connection —
// see .env.example). Safe to re-run: schema.sql is entirely `if not exists` / drop-then-create.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error('SUPABASE_DB_URL not set — paste supabase/schema.sql into the Supabase SQL editor instead.');
  process.exit(1);
}

const sql = readFileSync(path.join(import.meta.dirname, '../supabase/schema.sql'), 'utf8');
const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

await client.connect();
try {
  await client.query(sql);
  console.log('schema.sql applied.');
} finally {
  await client.end();
}
