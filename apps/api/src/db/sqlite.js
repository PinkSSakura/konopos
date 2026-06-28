const fs = require('fs');
const path = require('path');
const config = require('../config');
const {
  ensureSchema,
  migrateLegacyDocuments,
  listPendingSchemaMigrations,
  shouldBackupBeforeMigration,
} = require('./model-schemas');
const {
  isDesktopPos,
  getDataDir,
  createDataBackup,
  rotateBackups,
  restoreDataBackup,
} = require('./backup');

let db;

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function resolveDatabasePath(filePath) {
  if (!filePath || path.isAbsolute(filePath)) return filePath;
  return path.resolve(__dirname, '..', '..', filePath);
}

function getDatabasePath() {
  if (config.sqlitePath) return resolveDatabasePath(config.sqlitePath);
  const dataDir = process.env.TouDev_DATA_DIR || path.join(__dirname, '..', '..', 'data');
  return path.join(dataDir, 'TouDev.sqlite3');
}

function applyJournalMode(connection) {
  try {
    connection.exec('PRAGMA journal_mode = WAL');
  } catch {
    try {
      connection.exec('PRAGMA journal_mode = DELETE');
    } catch {
      // Keep startup non-fatal; SQLite can still use its current journal mode.
    }
  }
}

function connectSQLite() {
  if (db) return db;

  let DatabaseSync;
  try {
    ({ DatabaseSync } = require('node:sqlite'));
  } catch (err) {
    const message = 'SQLite requires Node.js with the built-in node:sqlite module. Use Node.js 22.17+ or 24+.';
    err.message = `${message} Original error: ${err.message}`;
    throw err;
  }

  const filename = getDatabasePath();
  ensureDir(filename);

  let connection = null;
  let backupDir = null;
  const dataDir = getDataDir();

  try {
    connection = new DatabaseSync(filename, {
      enableForeignKeyConstraints: true,
      timeout: 5000,
    });
    connection.exec('PRAGMA busy_timeout = 5000');
    applyJournalMode(connection);

    const pending = listPendingSchemaMigrations(connection);
    if (isDesktopPos() && shouldBackupBeforeMigration(connection, pending)) {
      backupDir = createDataBackup(dataDir, {
        reason: 'schema_migration',
        pending,
      }, connection);
      rotateBackups(dataDir, 3);
      console.log(`Sauvegarde automatique avant migration : ${backupDir}`);
    }

    ensureSchema(connection);
    migrateLegacyDocuments(connection);
    db = connection;
    connection = null;
    return db;
  } catch (err) {
    if (connection) {
      try {
        connection.close();
      } catch {
        // Ignore close errors while handling migration failure.
      }
      connection = null;
      db = null;
    }

    if (backupDir && isDesktopPos()) {
      try {
        restoreDataBackup(backupDir, dataDir);
        const wrapped = new Error(
          'Mise à jour de la base de données échouée. Vos données ont été restaurées depuis la sauvegarde automatique. Redémarrez l\'application ; contactez le support si le problème persiste.'
        );
        wrapped.cause = err;
        throw wrapped;
      } catch (restoreErr) {
        if (restoreErr.cause) throw restoreErr;
        const wrapped = new Error(
          `Mise à jour de la base échouée et restauration impossible. Sauvegarde conservée dans : ${backupDir}`
        );
        wrapped.cause = restoreErr;
        throw wrapped;
      }
    }

    throw err;
  } finally {
    if (connection) {
      try {
        connection.close();
      } catch {
        // Ignore duplicate close attempts.
      }
    }
  }
}

function getDb() {
  return db || connectSQLite();
}

function closeSQLite() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = {
  connectSQLite,
  closeSQLite,
  getDatabasePath,
  getDb,
};
