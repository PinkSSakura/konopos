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
const allTables = [...new Set([...Object.keys(oldDb), ...Object.keys(newDb)])].sort();

console.log('=== ALL TABLE ROW COUNTS ===');
for (const t of allTables) {
  console.log(`${t}: old=${oldDb[t]?.count ?? '-'} new=${newDb[t]?.count ?? '-'}`);
}
