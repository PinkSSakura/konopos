const fs = require('fs');
const path = require('path');
const { getProjectRoot } = require('./projectRoot');

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
      'KONOPOS_LOCAL_POS=1',
      '# Base SQLite locale (laisser vide pour utiliser KONOPOS_DATA_DIR/konopos.sqlite3) :',
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

function getBackendEnv() {
  const localPos = { KONOPOS_LOCAL_POS: '1' };

  if (!isPackaged()) {
    return localPos;
  }

  return {
    ...localPos,
    KONOPOS_ENV_FILE: ensureApiEnv(),
    KONOPOS_DATA_DIR: ensureDataDir(),
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
