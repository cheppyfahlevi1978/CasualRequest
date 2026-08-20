/**
 * Cross-checks the application code against the SQL schema.
 * Uses the real PostgreSQL parser AST, so table/view/column names come from the
 * migrations themselves rather than from a hand-maintained list.
 */
import fs from "node:fs";
import path from "node:path";

const astDir = process.env.CR_AST_DIR ?? ".ast";

const tables = new Map();   // name -> Set(columns)
const functions = new Map(); // name -> [argNames]

function addCol(table, col) {
  if (!tables.has(table)) tables.set(table, new Set());
  tables.get(table).add(col);
}

for (const f of fs.readdirSync(astDir).sort()) {
  const tree = JSON.parse(fs.readFileSync(path.join(astDir, f), "utf8"));
  for (const { stmt } of tree.stmts ?? []) {
    if (stmt.CreateStmt) {
      const name = stmt.CreateStmt.relation.relname;
      for (const el of stmt.CreateStmt.tableElts ?? []) {
        if (el.ColumnDef?.colname) addCol(name, el.ColumnDef.colname);
      }
    }
    if (stmt.ViewStmt) {
      const name = stmt.ViewStmt.view.relname;
      for (const t of stmt.ViewStmt.query?.SelectStmt?.targetList ?? []) {
        const res = t.ResTarget;
        if (res?.name) addCol(name, res.name);
        else {
          const fields = res?.val?.ColumnRef?.fields ?? [];
          const last = fields[fields.length - 1];
          if (last?.String?.sval) addCol(name, last.String.sval);
        }
      }
    }
    if (stmt.CreateFunctionStmt) {
      const names = stmt.CreateFunctionStmt.funcname.map((n) => n.String?.sval);
      if (names[0] === "public" || names.length === 1) {
        const fn = names[names.length - 1];
        const args = (stmt.CreateFunctionStmt.parameters ?? [])
          .filter((p) => (p.FunctionParameter?.mode ?? "FUNC_PARAM_DEFAULT") !== "FUNC_PARAM_TABLE")
          .map((p) => p.FunctionParameter?.name)
          .filter(Boolean);
        functions.set(fn, args);
      }
    }
  }
}

// Columns PostgREST synthesises for embedded resources.
const EMBED_OK = new Set(["casual_workers", "casual_requests", "departments", "roles", "permissions", "role_permissions"]);

const srcFiles = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.tsx?$/.test(e.name)) srcFiles.push(p);
  }
})("src");

const problems = [];

for (const file of srcFiles) {
  const code = fs.readFileSync(file, "utf8");

  const usedTables = [...code.matchAll(/\.from\(\s*"([a-z_0-9]+)"/g)].map((m) => m[1]);
  for (const t of new Set(usedTables)) {
    if (!tables.has(t)) problems.push(`${file}: unknown table/view "${t}"`);
  }

  for (const m of code.matchAll(/\.rpc\(\s*"([a-z_0-9]+)"\s*,\s*\{/g)) {
    const fn = m[1];
    if (!functions.has(fn)) {
      problems.push(`${file}: unknown RPC "${fn}"`);
      continue;
    }
    // Walk the argument object so nested values do not leak into the key list.
    const open = m.index + m[0].length - 1;
    let depth = 0;
    const topKeys = [];
    let buf = "";
    for (let i = open; i < code.length; i++) {
      const ch = code[i];
      if (ch === "{") { depth++; if (depth === 1) buf = ""; continue; }
      if (ch === "}") { depth--; if (depth === 0) break; continue; }
      if (depth === 1) buf += ch;
    }
    let nest = 0;
    let key = "";
    for (const ch of buf) {
      if ("{[(".includes(ch)) nest++;
      else if ("}])".includes(ch)) nest--;
      else if (nest === 0 && ch === ",") key = "";
      else if (nest === 0 && ch === ":") { topKeys.push(key.trim()); key = ""; }
      else if (nest === 0) key += ch;
    }
    const passed = topKeys.filter((k) => /^[a-z_0-9]+$/.test(k));
    const declared = functions.get(fn);
    for (const a of passed) {
      if (!declared.includes(a)) {
        problems.push(`${file}: RPC ${fn}() has no parameter "${a}" (declared: ${declared.join(", ")})`);
      }
    }
  }

  const known = new Set();
  for (const t of usedTables) for (const c of tables.get(t) ?? []) known.add(c);
  for (const t of EMBED_OK) for (const c of tables.get(t) ?? []) known.add(c);
  if (known.size === 0) continue;

  const refs = new Set();
  for (const m of code.matchAll(/\.(?:eq|neq|gt|gte|lt|lte|like|ilike|is|in|not|order|contains)\(\s*"([a-z_0-9]+)"/g)) {
    refs.add(m[1]);
  }
  for (const m of code.matchAll(/\.select\(\s*"([^"]+)"/g)) {
    // Strip PostgREST embedded resources — "casual_workers(a, b)" names a
    // relationship, not a column of the parent table.
    const flat = m[1].replace(/[a-z_0-9]+\s*\([^)]*\)/g, "");
    for (const piece of flat.split(",")) {
      const col = piece.trim();
      if (/^[a-z_0-9]+$/.test(col) && col !== "*") refs.add(col);
    }
  }
  for (const c of refs) {
    if (tables.has(c)) continue;   // relationship name, already handled above
    if (!known.has(c)) {
      problems.push(`${file}: column "${c}" not found on ${[...new Set(usedTables)].join(", ")}`);
    }
  }
}

console.log(`Schema: ${tables.size} tables/views, ${functions.size} public functions.`);
if (problems.length === 0) {
  console.log("No mismatches between application queries and the SQL schema.");
} else {
  console.log(`\n${problems.length} potential mismatch(es):`);
  for (const p of problems) console.log("  -", p);
}
process.exit(problems.length ? 1 : 0);
