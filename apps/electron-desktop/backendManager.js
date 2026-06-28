const { spawn } = require('child_process');
const { spawnBackend } = require('./lib/runProcess');
const { isPortInUse } = require('./lib/portCheck');

const SOURCE = 'backend';
const BACKEND_PORT = Number(process.env.API_PORT) || 5000;

let backendProcess = null;
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
      .forEach((line) => {
        emitLog(line, level);
        if (level === 'error' && /SQLITE_|sqlite|database/i.test(line)) {
          emitLog('Erreur SQLite — vérifiez SQLITE_PATH et les droits d\'écriture du dossier de données.', 'error');
        }
      });
  });
}

function isRunning() {
  return Boolean(backendProcess) || usingExternal;
}

async function startBackend() {
  if (backendProcess) {
    return { ok: false, message: 'Le serveur tourne déjà.' };
  }

  if (await isPortInUse(BACKEND_PORT)) {
    usingExternal = true;
    emitLog(`Port ${BACKEND_PORT} déjà utilisé — serveur existant (npm run dev ?).`, 'info');
    return { ok: true, message: `Serveur déjà actif sur le port ${BACKEND_PORT}.` };
  }

  usingExternal = false;
  try {
    backendProcess = spawnBackend({ PORT: String(BACKEND_PORT) });

    pipeOutput(backendProcess.stdout, 'info');
    pipeOutput(backendProcess.stderr, 'error');

    backendProcess.on('exit', (code) => {
      emitLog(`Processus terminé (code ${code ?? '?'}).`, code === 0 ? 'info' : 'error');
      backendProcess = null;
    });

    backendProcess.on('error', (err) => {
      emitLog(`Erreur : ${err.message}`, 'error');
      backendProcess = null;
    });

    emitLog(`Démarrage API (port ${BACKEND_PORT})…`, 'info');
    return { ok: true, message: 'Démarrage backend…' };
  } catch (err) {
    backendProcess = null;
    emitLog(`Échec : ${err.message}`, 'error');
    return { ok: false, message: err.message };
  }
}

function stopBackend() {
  if (backendProcess) {
    const pid = backendProcess.pid;
    backendProcess = null;

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
    return { ok: true, message: 'Arrêt backend…' };
  }

  if (usingExternal) {
    usingExternal = false;
    return { ok: false, message: 'Serveur externe — arrêtez npm run dev si besoin.' };
  }

  return { ok: false, message: 'Le serveur n\'est pas démarré.' };
}

async function checkHealth() {
  try {
    const res = await fetch(`http://127.0.0.1:${BACKEND_PORT}/api/health`, {
      signal: AbortSignal.timeout(4000),
    });
    const data = await res.json();
    return { ok: res.ok && data.success, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = {
  onLog,
  isRunning,
  startBackend,
  stopBackend,
  checkHealth,
};
