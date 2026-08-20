import fs from "node:fs";
import PgQuery from "pg-query-emscripten";

const file = process.argv[2];
const sql = fs.readFileSync(file, "utf8");

// Only files that actually declare plpgsql functions are worth running.
if (!/language\s+plpgsql/i.test(sql)) {
  console.log(`skip ${file.split(/[\/]/).pop()} (no plpgsql)`);
  process.exit(0);
}

const parser = await new PgQuery();
const result = parser.parsePlpgsql(sql);

if (result.error) {
  console.log(`FAIL ${file}`);
  console.log(`  ${result.error.message}`);
  process.exit(1);
}

const n = (result.plpgsql_funcs ?? []).length;
console.log(`OK   ${file.split(/[\/]/).pop()}  ${n} plpgsql function(s) validated`);
