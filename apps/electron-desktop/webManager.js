const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { spawnWeb, isPackaged } = require('./lib/runProcess');
const { getProjectRoot } = require('./lib/projectRoot');
const { isPortInUse } = require('./lib/portCheck');

const WEB_DIST = path.join(getProjectRoot(), 'apps', 'web', 'dist', 'index.html');
const WEB_PORT = Number(process.env.WEB_PORT) || 5173;
const API_PORT = Number(process.env.API_PORT) || 5000;
const SOURCE = 'web';

let webProcess = null;
let usingExternal = false;
let logListeners = [];

function onLog(listener) {
  logListeners.push(listener);
  return () => {
    logListeners = logListeners.filter((l) => l !== listener);
  };
}

function emitLog(line, level = 'info') {
  logListeners.forEach((l) => l({ source: SOURCE, line, level, at: new Date().toISOString() }));
}

function pipeOutput(stream, level) {
  if (!stream) return;
  stream.on('data', (chunk) => {
    String(chunk)
      .split(/\r?\n/)
      .filter(Boolean)
      .forEach((line) => emitLog(line, level));
  });
}

function isRunning() {
  return Boolean(webProcess) || usingExternal;
}

function getWebPort() {
  return WEB_PORT;
}

async function startWeb() {
  if (webProcess) {
    return { ok: false, message: 'L\'interface tourne déjà.' };
  }

  if (await isPortInUse(WEB_PORT)) {
    usingExternal = true;
    emitLog(`Port ${WEB_PORT} déjà utilisé — interface existante (npm run dev ?).`, 'info');
    return { ok: true, message: `Interface déjà active sur le port ${WEB_PORT}.` };
  }

  usingExternal = false;
  const hasBuild = fs.existsSync(WEB_DIST) || isPackaged();

  emitLog(
    isPackaged() ? 'Mode statique (build existant).' : hasBuild ? 'Mode preview (build existant).' : 'Mode développement Vite.',
    'info'
  );

  try {
    webProcess = spawnWeb({
      PORT: String(WEB_PORT),
      API_PORT: String(API_PORT),
    });

    pipeOutput(webProcess.stdout, 'info');
    pipeOutput(webProcess.stderr, 'error');

    webProcess.on('exit', (code) => {
      emitLog(`Processus terminé (code ${code ?? '?'}).`, code === 0 ? 'info' : 'error');
      webProcess = null;
    });

    webProcess.on('error', (err) => {
      emitLog(`Erreur : ${err.message}`, 'error');
      webProcess = null;
    });

    emitLog(`Démarrage interface sur le port ${WEB_PORT}…`, 'info');
    return { ok: true, message: 'Démarrage interface…', port: WEB_PORT };
  } catch (err) {
    webProcess = null;
    emitLog(`Échec : ${err.message}`, 'error');
    return { ok: false, message: err.message };
  }
}

function stopWeb() {
  if (webProcess) {
    const pid = webProcess.pid;
    webProcess = null;

    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(pid), '/f', '/t'], { shell: true, windowsHide: true });
    } else {
      try {
        process.kill(-pid, 'SIGTERM');
      } catch {
        try { process.kill(pid, 'SIGTERM'); } catch { /* ignore */ }
      }
    }

    emitLog('Arrêt demandé.', 'info');
    return { ok: true, message: 'Arrêt interface…' };
  }

  if (usingExternal) {
    usingExternal = false;
    return { ok: false, message: 'Interface externe — arrêtez npm run dev si besoin.' };
  }

  return { ok: false, message: 'L\'interface n\'est pas démarrée.' };
}

async function fetchOk(url, timeoutMs = 3000) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return { ok: res.ok };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function checkWebHealth() {
  const ui = await fetchOk(`http://127.0.0.1:${WEB_PORT}/`, 3000);
  const api = ui.ok
    ? await fetchOk(`http://127.0.0.1:${WEB_PORT}/api/health`, 5000)
    : { ok: false };

  return { uiOk: ui.ok, apiOk: api.ok };
}

module.exports = {
  onLog,
  isRunning,
  getWebPort,
  startWeb,
  stopWeb,
  checkWebHealth,
};
