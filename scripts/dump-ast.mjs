import fs from "node:fs";
import path from "node:path";
import PgQuery from "pg-query-emscripten";
const file = process.argv[2];
const parser = await new PgQuery();
const tree = parser.parse(fs.readFileSync(file, "utf8")).parse_tree;
fs.writeFileSync(path.join(process.env.CR_AST_DIR ?? ".ast", path.basename(file) + ".json"), JSON.stringify(tree));
