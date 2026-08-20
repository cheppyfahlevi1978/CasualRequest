import fs from "node:fs";
import PgQuery from "pg-query-emscripten";

const file = process.argv[2];
const sql = fs.readFileSync(file, "utf8");
const parser = await new PgQuery();
const result = parser.parse(sql);

if (result.error) {
  console.log(`FAIL ${file}`);
  console.log(`  ${result.error.message} (cursor ${result.error.cursorpos})`);
  const c = result.error.cursorpos;
  console.log("  context:", JSON.stringify(sql.slice(Math.max(0, c - 200), c + 60)));
  process.exit(1);
}
console.log(`OK   ${file.split(/[\/]/).pop()}  ${result.parse_tree?.stmts?.length ?? 0} statements`);
