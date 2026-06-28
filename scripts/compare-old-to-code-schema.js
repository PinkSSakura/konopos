const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const { MODEL_SCHEMAS } = require('../apps/api/src/db/model-schemas');

function inspect(dbPath) {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all();
  const out = {};
  for (const { name } of tables) {
    const quoted = `"${String(name).replace(/"/g, '""')}"`;
    const cols = db.prepare(`PRAGMA table_info(${quoted})`).all().map((c) => c.name);
    out[name] = cols;
  }
  db.close();
  return out;
}

const oldPath = path.join(__dirname, '../databases/konoposold.sqlite3');
const oldDb = inspect(oldPath);

console.log('=== OLD DB vs CURRENT CODE SCHEMA ===');
for (const [modelName, schema] of Object.entries(MODEL_SCHEMAS)) {
  const table = schema.table;
  const codeCols = Object.keys(schema.columns);
  const dbCols = oldDb[table];
  if (!dbCols) {
    console.log(`\n${table}: MISSING TABLE in old DB`);
    continue;
  }
  const dbSet = new Set(dbCols);
  const codeSet = new Set(codeCols);
  const missingInDb = codeCols.filter((c) => !dbSet.has(c));
  const extraInDb = dbCols.filter((c) => !codeSet.has(c));
  if (missingInDb.length || extraInDb.length) {
    console.log(`\n${table}:`);
    if (missingInDb.length) console.log(`  missing in OLD (will be added): ${missingInDb.join(', ')}`);
    if (extraInDb.length) console.log(`  extra in OLD (ignored): ${extraInDb.join(', ')}`);
  }
}

const modelTables = new Set(Object.values(MODEL_SCHEMAS).map((s) => s.table));
const extraTables = Object.keys(oldDb).filter((t) => !modelTables.has(t) && t !== 'schema_migrations');
if (extraTables.length) console.log(`\nExtra tables in OLD: ${extraTables.join(', ')}`);
