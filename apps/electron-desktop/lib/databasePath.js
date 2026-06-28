const fs = require('fs');
const os = require('os');
const path = require('path');

const DB_NAMES = ['konopos.sqlite3', 'TouDev.sqlite3'];

function legacyKonoPosDataDir() {
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  return path.join(appData, 'KonoPOS', 'data');
}

function findExistingDatabase(dataDirs) {
  for (const dataDir of dataDirs) {
    if (!dataDir) continue;
    for (const name of DB_NAMES) {
      const candidate = path.join(dataDir, name);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
}

function resolvePackagedSqlitePath(dataDir) {
  return findExistingDatabase([dataDir, legacyKonoPosDataDir()])
    || path.join(dataDir, 'konopos.sqlite3');
}

module.exports = {
  findExistingDatabase,
  legacyKonoPosDataDir,
  resolvePackagedSqlitePath,
};
