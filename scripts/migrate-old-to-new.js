/**
 * Migrate konoposold.sqlite3 → konoposnew.sqlite3 with current schema.
 * Strategy: copy the data-rich old file, run ensureSchema, apply defaults for new columns.
 */
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { ensureSchema } = require('../apps/api/src/db/model-schemas');

const ROOT = path.join(__dirname, '..');
const OLD_PATH = path.join(ROOT, 'databases', 'konoposold.sqlite3');
const NEW_PATH = path.join(ROOT, 'databases', 'konoposnew.sqlite3');
const BACKUP_PATH = path.join(ROOT, 'databases', `konoposnew.sqlite3.backup-${Date.now()}`);

const COLUMN_DEFAULTS = {
  establishments: {
    checkout_ui_mode: 'modal',
  },
};

const TABLES_TO_COUNT = [
  'establishments',
  'users',
  'roles',
  'permissions',
  'role_permissions',
  'orders',
  'order_items',
  'payments',
  'shifts',
  'user_sessions',
  'audit_logs',
  'installation_licenses',
  'daily_closings',
  'menu_items',
  'categories',
  'extras',
];

function countRows(db, table) {
  const quoted = `"${table.replace(/"/g, '""')}"`;
  try {
    return db.prepare(`SELECT COUNT(*) as n FROM ${quoted}`).get().n;
  } catch {
    return null;
  }
}

function countAll(db) {
  const out = {};
  for (const table of TABLES_TO_COUNT) {
    out[table] = countRows(db, table);
  }
  return out;
}

function assertFileExists(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} not found: ${filePath}`);
  }
}

function applyColumnDefaults(db) {
  for (const [table, defaults] of Object.entries(COLUMN_DEFAULTS)) {
    const quoted = `"${table.replace(/"/g, '""')}"`;
    for (const [column, value] of Object.entries(defaults)) {
      const colQuoted = `"${column.replace(/"/g, '""')}"`;
      db.prepare(
        `UPDATE ${quoted} SET ${colQuoted} = ? WHERE ${colQuoted} IS NULL OR ${colQuoted} = ''`,
      ).run(value);
    }
  }
}

function main() {
  assertFileExists(OLD_PATH, 'Source database');

  const oldCounts = (() => {
    const db = new DatabaseSync(OLD_PATH, { readOnly: true });
    const counts = countAll(db);
    db.close();
    return counts;
  })();

  if (fs.existsSync(NEW_PATH)) {
    fs.copyFileSync(NEW_PATH, BACKUP_PATH);
    console.log(`Backed up existing new DB → ${path.basename(BACKUP_PATH)}`);
  }

  fs.copyFileSync(OLD_PATH, NEW_PATH);
  console.log(`Copied ${path.basename(OLD_PATH)} → ${path.basename(NEW_PATH)}`);

  const db = new DatabaseSync(NEW_PATH);
  db.exec('PRAGMA foreign_keys = OFF');
  ensureSchema(db);
  applyColumnDefaults(db);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA user_version = 4');

  const newCounts = countAll(db);

  const checkoutMode = db
    .prepare('SELECT checkout_ui_mode FROM establishments LIMIT 1')
    .get();
  const hasPushTable = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='push_subscriptions'")
    .get();

  db.close();

  console.log('\nRow counts (old → migrated):');
  let ok = true;
  for (const table of TABLES_TO_COUNT) {
    const before = oldCounts[table];
    const after = newCounts[table];
    const match = before === after;
    if (!match) ok = false;
    console.log(`  ${table}: ${before} → ${after}${match ? '' : '  *** MISMATCH ***'}`);
  }

  console.log(`\ncheckout_ui_mode sample: ${checkoutMode?.checkout_ui_mode ?? '(none)'}`);
  console.log(`push_subscriptions table: ${hasPushTable ? 'yes' : 'no'}`);

  if (!ok) {
    throw new Error('Migration verification failed — row counts differ.');
  }

  console.log(`\nDone. Migrated database: ${NEW_PATH}`);
}

main();
