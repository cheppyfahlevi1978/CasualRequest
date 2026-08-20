/**
 * One command that proves the SQL is real SQL and that the app agrees with it:
 *
 *   1. every migration parses with the actual PostgreSQL grammar,
 *   2. every PL/pgSQL function body parses with the actual PL/pgSQL parser,
 *   3. every table, view, column and RPC the application queries exists.
 *
 * Each parse runs in its own process: the WASM parser is not safe to reuse
 * across many large inputs in a single process.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const migDir = "supabase/migrations";
const files = fs
  .readdirSync(migDir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => path.join(migDir, f));

if (fs.existsSync("supabase/seed.sql")) files.push("supabase/seed.sql");

const astDir = fs.mkdtempSync(path.join(os.tmpdir(), "cr-ast-"));
const run = (script, arg, env = {}) =>
  execFileSync(process.execPath, [script, arg], {
    stdio: "inherit",
    env: { ...process.env, ...env },
  });

try {
  console.log("\n== 1. SQL syntax ==");
  for (const f of files) run("scripts/check-sql-syntax.mjs", f);

  console.log("\n== 2. PL/pgSQL bodies ==");
  for (const f of files) run("scripts/check-plpgsql.mjs", f);

  console.log("\n== 3. Application queries vs schema ==");
  for (const f of files) run("scripts/dump-ast.mjs", f, { CR_AST_DIR: astDir });
  run("scripts/check-schema.mjs", "", { CR_AST_DIR: astDir });

  console.log("\nAll SQL checks passed.");
} finally {
  fs.rmSync(astDir, { recursive: true, force: true });
}
