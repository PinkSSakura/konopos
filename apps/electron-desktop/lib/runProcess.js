const path = require('path');
const { spawn } = require('child_process');
const { getProjectRoot } = require('./projectRoot');
const { getBackendEnv, isPackaged } = require('./runtimeConfig');

function getNodeCommand() {
  return isPackaged() ? process.execPath : 'node';
}

function spawnManagedProcess(options) {
  const packaged = isPackaged();
  const env = {
    ...process.env,
    FORCE_COLOR: '0',
    ...options.env,
  };

  if (packaged) {
    env.ELECTRON_RUN_AS_NODE = '1';
  }

  return spawn(options.command, options.args, {
    cwd: options.cwd,
    shell: !packaged,
    env,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function spawnBackend(extraEnv = {}) {
  const root = getProjectRoot();
  const apiDir = path.join(root, 'apps', 'api');
  const port = String(extraEnv.PORT || process.env.API_PORT || 5000);

  return spawnManagedProcess({
    command: getNodeCommand(),
    args: ['src/index.js'],
    cwd: apiDir,
    env: {
      ...getBackendEnv(),
      PORT: port,
      ...extraEnv,
    },
  });
}

function spawnWeb(env = {}) {
  const fs = require('fs');
  const root = getProjectRoot();
  const port = String(env.PORT || process.env.WEB_PORT || 5173);
  const apiPort = String(env.API_PORT || process.env.API_PORT || 5000);
  const webDir = path.join(root, 'apps', 'web');
  const distDir = path.join(webDir, 'dist');
  const hasDist = fs.existsSync(path.join(distDir, 'index.html'));

  if (isPackaged() || hasDist) {
    return spawnManagedProcess({
      command: getNodeCommand(),
      args: [path.join(__dirname, 'staticWebServer.js')],
      cwd: webDir,
      env: {
        ...env,
        PORT: port,
        WEB_DIST_DIR: distDir,
        KONOPOS_STATIC_NO_CACHE: isPackaged() ? '1' : '',
        API_HOST: '127.0.0.1',
        API_PORT: apiPort,
      },
    });
  }

  return spawnManagedProcess({
    command: 'npm',
    args: ['run', 'start:web:lan'],
    cwd: root,
    env: { ...env, PORT: port },
  });
}

module.exports = { spawnBackend, spawnWeb, isPackaged };
