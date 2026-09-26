// Applies supabase/apply-all.sql via SUPABASE_DB_URL, in one transaction (all-or-nothing). Safe to
// re-run: apply-all.sql is entirely `if not exists` / drop-then-create. Never logs the connection
// string or any credential — only which statement failed, if any.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error('SUPABASE_DB_URL not set — paste supabase/apply-all.sql into the Supabase SQL editor instead.');
  process.exit(1);
}

const sql = readFileSync(path.join(import.meta.dirname, '../supabase/apply-all.sql'), 'utf8');
const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

await client.connect();
try {
  await client.query('begin');
  await client.query(sql);
  await client.query('commit');
  console.log('apply-all.sql applied (1 transaction).');
} catch (err) {
  await client.query('rollback').catch(() => {});
  console.error('apply-all.sql failed, rolled back:', err instanceof Error ? err.message : 'unknown error');
  process.exitCode = 1;
} finally {
  await client.end();
}
