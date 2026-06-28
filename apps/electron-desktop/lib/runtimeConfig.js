const fs = require('fs');
const path = require('path');
const { getProjectRoot } = require('./projectRoot');
const { findExistingDatabase, legacyKonoPosDataDir } = require('../../api/src/db/database-path');

function isPackaged() {
  try {
    return require('electron').app.isPackaged;
  } catch {
    return false;
  }
}

function getUserDataDir() {
  const { app } = require('electron');
  return app.getPath('userData');
}

function ensureApiEnv() {
  if (!isPackaged()) {
    return path.join(getProjectRoot(), 'apps', 'api', '.env');
  }

  const userEnv = path.join(getUserDataDir(), 'api.env');
  if (fs.existsSync(userEnv)) {
    return userEnv;
  }

  const example = path.join(getProjectRoot(), 'apps', 'api', '.env.example');
  const template = fs.existsSync(example)
    ? fs.readFileSync(example, 'utf8')
    : [
      'NODE_ENV=production',
      'PORT=5000',
      'HOST=0.0.0.0',
      'TouDev_LOCAL_POS=1',
      '# TouDev_LOCAL_POS=1 autorise les cookies auth en HTTP local (pas de contournement licence).',
      '# Base SQLite locale (laisser vide : détection auto konopos.sqlite3) :',
      'SQLITE_PATH=',
      'JWT_SECRET=change-me-in-production-use-long-random-string',
      'ALLOW_LAN_CORS=true',
    ].join('\n');

  fs.mkdirSync(path.dirname(userEnv), { recursive: true });
  fs.writeFileSync(userEnv, template, 'utf8');
  return userEnv;
}

function ensureDataDir() {
  if (!isPackaged()) {
    return path.join(getProjectRoot(), 'apps', 'api', 'data');
  }

  const dataDir = path.join(getUserDataDir(), 'data');
  fs.mkdirSync(path.join(dataDir, 'uploads', 'categories'), { recursive: true });
  fs.mkdirSync(path.join(dataDir, 'uploads', 'menu-items'), { recursive: true });
  fs.mkdirSync(path.join(dataDir, 'uploads', 'extras'), { recursive: true });
  fs.mkdirSync(path.join(dataDir, 'uploads', 'establishments'), { recursive: true });
  return dataDir;
}

function resolvePackagedSqlitePath(dataDir) {
  const existing = findExistingDatabase([dataDir, legacyKonoPosDataDir()]);
  return existing || path.join(dataDir, 'konopos.sqlite3');
}

function getBackendEnv() {
  const desktopEnv = { TouDev_LOCAL_POS: '1' };

  if (!isPackaged()) {
    return desktopEnv;
  }

  const dataDir = ensureDataDir();

  return {
    ...desktopEnv,
    TouDev_ENV_FILE: ensureApiEnv(),
    TouDev_DATA_DIR: dataDir,
    SQLITE_PATH: resolvePackagedSqlitePath(dataDir),
  };
}

function getRuntimeInfo() {
  const root = getProjectRoot();
  return {
    packaged: isPackaged(),
    projectRoot: root,
    apiEntry: path.join(root, 'apps', 'api', 'src', 'index.js'),
    webDist: path.join(root, 'apps', 'web', 'dist', 'index.html'),
    envFile: isPackaged() ? ensureApiEnv() : path.join(root, 'apps', 'api', '.env'),
    dataDir: isPackaged() ? ensureDataDir() : path.join(root, 'apps', 'api', 'data'),
  };
}

module.exports = {
  ensureApiEnv,
  ensureDataDir,
  getBackendEnv,
  getRuntimeInfo,
  getUserDataDir,
  isPackaged,
};
