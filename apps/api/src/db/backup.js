const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const config = require('../config');

function resolveDatabasePath(filePath) {
  if (!filePath || path.isAbsolute(filePath)) return filePath;
  return path.resolve(__dirname, '..', '..', filePath);
}

function getDatabasePath() {
  if (config.sqlitePath) return resolveDatabasePath(config.sqlitePath);
  const dataDir = process.env.TouDev_DATA_DIR || path.join(__dirname, '..', '..', 'data');
  return path.join(dataDir, 'TouDev.sqlite3');
}

function isDesktopPos() {
  return process.env.TouDev_LOCAL_POS === '1';
}

function getDataDir() {
  if (process.env.TouDev_DATA_DIR) return process.env.TouDev_DATA_DIR;
  return path.dirname(getDatabasePath());
}

function backupTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function sqlitePaths(dataDir) {
  const dbPath = path.join(dataDir, 'TouDev.sqlite3');
  return [dbPath, `${dbPath}-wal`, `${dbPath}-shm`].filter((filePath) => fs.existsSync(filePath));
}

function copySqliteFiles(dataDir, destDir) {
  for (const filePath of sqlitePaths(dataDir)) {
    fs.copyFileSync(filePath, path.join(destDir, path.basename(filePath)));
  }
}

function copyUploads(dataDir, destDir) {
  const uploadsSrc = path.join(dataDir, 'uploads');
  if (!fs.existsSync(uploadsSrc)) return;
  fs.cpSync(uploadsSrc, path.join(destDir, 'uploads'), { recursive: true });
}

function writeManifest(destDir, meta) {
  fs.writeFileSync(
    path.join(destDir, 'manifest.json'),
    JSON.stringify({
      createdAt: new Date().toISOString(),
      ...meta,
    }, null, 2),
    'utf8',
  );
}

function checkpointDatabase(db) {
  try {
    db.exec('PRAGMA wal_checkpoint(FULL)');
  } catch {
    // Best effort before copying the SQLite files.
  }
}

function createDataBackup(dataDir, meta = {}, db = null) {
  if (db) checkpointDatabase(db);

  const destDir = path.join(dataDir, 'backups', backupTimestamp());
  fs.mkdirSync(destDir, { recursive: true });
  copySqliteFiles(dataDir, destDir);
  copyUploads(dataDir, destDir);
  writeManifest(destDir, meta);
  return destDir;
}

function rotateBackups(dataDir, keep = 3) {
  const root = path.join(dataDir, 'backups');
  if (!fs.existsSync(root)) return;

  const entries = fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const entryPath = path.join(root, entry.name);
      return {
        path: entryPath,
        mtime: fs.statSync(entryPath).mtimeMs,
      };
    })
    .sort((a, b) => b.mtime - a.mtime);

  for (const entry of entries.slice(keep)) {
    fs.rmSync(entry.path, { recursive: true, force: true });
  }
}

function restoreDataBackup(backupDir, dataDir) {
  if (!fs.existsSync(backupDir)) {
    throw new Error(`Sauvegarde introuvable : ${backupDir}`);
  }

  for (const fileName of ['TouDev.sqlite3', 'TouDev.sqlite3-wal', 'TouDev.sqlite3-shm']) {
    const src = path.join(backupDir, fileName);
    const dest = path.join(dataDir, fileName);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      continue;
    }
    if (fs.existsSync(dest)) {
      fs.rmSync(dest, { force: true });
    }
  }

  const uploadsSrc = path.join(backupDir, 'uploads');
  const uploadsDest = path.join(dataDir, 'uploads');
  if (fs.existsSync(uploadsDest)) {
    fs.rmSync(uploadsDest, { recursive: true, force: true });
  }
  if (fs.existsSync(uploadsSrc)) {
    fs.cpSync(uploadsSrc, uploadsDest, { recursive: true });
  }
}

function zipBackupFolder(folderPath) {
  const zipPath = path.join(os.tmpdir(), `TouDev-backup-${Date.now()}.zip`);
  if (process.platform !== 'win32') {
    throw new Error('Export ZIP disponible uniquement sur Windows.');
  }

  const escapedSource = folderPath.replace(/'/g, "''");
  const escapedDest = zipPath.replace(/'/g, "''");
  execFileSync('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    `Compress-Archive -LiteralPath '${escapedSource}' -DestinationPath '${escapedDest}' -Force`,
  ], { stdio: 'pipe', windowsHide: true });

  return zipPath;
}

module.exports = {
  isDesktopPos,
  getDataDir,
  createDataBackup,
  rotateBackups,
  restoreDataBackup,
  zipBackupFolder,
};
