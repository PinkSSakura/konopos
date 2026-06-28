const { DatabaseSync } = require('node:sqlite');
const path = require('path');

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
    const count = db.prepare(`SELECT COUNT(*) as n FROM ${quoted}`).get().n;
    out[name] = { cols, count };
  }
  db.close();
  return out;
}

const oldPath = path.join(__dirname, '../databases/konoposold.sqlite3');
const newPath = path.join(__dirname, '../databases/konoposnew.sqlite3');
const oldDb = inspect(oldPath);
const newDb = inspect(newPath);
const allTables = new Set([...Object.keys(oldDb), ...Object.keys(newDb)]);

console.log('=== TABLE ROW COUNTS (differences) ===');
for (const t of [...allTables].sort()) {
  const o = oldDb[t]?.count ?? '-';
  const n = newDb[t]?.count ?? '-';
  if (o !== n) console.log(`${t}: old=${o} new=${n}`);
}

console.log('\n=== SCHEMA DIFFS ===');
for (const t of [...allTables].sort()) {
  const oc = new Set(oldDb[t]?.cols || []);
  const nc = new Set(newDb[t]?.cols || []);
  const onlyOld = [...oc].filter((c) => !nc.has(c));
  const onlyNew = [...nc].filter((c) => !oc.has(c));
  if (onlyOld.length || onlyNew.length) {
    console.log(`\n${t}:`);
    if (onlyOld.length) console.log(`  only in OLD: ${onlyOld.join(', ')}`);
    if (onlyNew.length) console.log(`  only in NEW: ${onlyNew.join(', ')}`);
  }
}

const onlyOldTables = [...allTables].filter((t) => oldDb[t] && !newDb[t]);
const onlyNewTables = [...allTables].filter((t) => newDb[t] && !oldDb[t]);
if (onlyOldTables.length) console.log(`\nTables only in OLD: ${onlyOldTables.join(', ')}`);
if (onlyNewTables.length) console.log(`Tables only in NEW: ${onlyNewTables.join(', ')}`);
