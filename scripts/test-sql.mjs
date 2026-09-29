#!/usr/bin/env node
// Runs every SQL check in supabase/tests/ against a database with all migrations applied — the
// local Supabase by default (`npm run db:start`), or SUPABASE_DB_URL. Each file runs in its own
// transaction and rolls back, so the database is left as it was. Needs `psql` on the PATH.
//
//   npm run test:sql

import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";

const DEFAULT_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const dbUrl = process.env.SUPABASE_DB_URL || DEFAULT_URL;
const testsDir = path.resolve(import.meta.dirname, "..", "supabase", "tests");
const files = readdirSync(testsDir).filter((name) => name.endsWith(".sql")).sort();

let failed = 0;
for (const file of files) {
  const result = spawnSync("psql", [dbUrl, "-X", "-q", "-v", "ON_ERROR_STOP=1", "-f", path.join(testsDir, file)], {
    encoding: "utf8",
  });
  if (result.error) {
    console.error(`Couldn't run psql: ${result.error.message}. Install the PostgreSQL client.`);
    process.exit(1);
  }
  if (result.status === 0) {
    console.log(`✓ ${file}`);
  } else {
    failed++;
    console.error(`✗ ${file}\n${(result.stderr || result.stdout).trim()}`);
  }
}

console.log(`\n${files.length - failed} of ${files.length} SQL test files passed.`);
process.exit(failed > 0 ? 1 : 0);
