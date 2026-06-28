const { autoUpdater } = require('electron-updater');
const {
  GITHUB_OWNER,
  GITHUB_REPO,
  GITHUB_PRIVATE,
  GITHUB_UPDATE_TOKEN,
} = require('./updateConfig');

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;
const STARTUP_DELAY_MS = 30_000;

let notifyStatus = () => {};
let checkTimer = null;
let packaged = false;

function mapInfo(info) {
  if (!info) return null;
  return {
    version: info.version,
    releaseDate: info.releaseDate,
    releaseNotes: typeof info.releaseNotes === 'string'
      ? info.releaseNotes
      : Array.isArray(info.releaseNotes)
        ? info.releaseNotes.map((n) => n.note || '').filter(Boolean).join('\n')
        : '',
  };
}

function normalizeUpdateError(err) {
  const message = err?.message || String(err || '');
  const code = err?.code || '';

  if (
    code === 'ERR_UPDATER_NO_PUBLISHED_VERSIONS'
    || message.includes('No published versions on GitHub')
    || message.includes('No published releases')
  ) {
    return { type: 'not-available', info: null };
  }

  if (message.includes('404') && GITHUB_PRIVATE && !GITHUB_UPDATE_TOKEN) {
    return {
      type: 'error',
      message: 'Mise à jour indisponible (accès releases privées non configuré).',
    };
  }

  if (message.includes('HttpError') || message.includes('net::')) {
    return {
      type: 'error',
      message: 'Impossible de contacter le serveur de mise à jour. Réessayez plus tard.',
    };
  }

  return {
    type: 'error',
    message: 'Vérification de mise à jour impossible. Réessayez plus tard.',
  };
}

function initUpdateManager({ onStatus, isPackaged }) {
  packaged = Boolean(isPackaged);
  notifyStatus = typeof onStatus === 'function' ? onStatus : () => {};

  if (!packaged) {
    notifyStatus({ type: 'disabled', reason: 'dev' });
    return;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowDowngrade = false;

  const feed = {
    provider: 'github',
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    private: GITHUB_PRIVATE,
  };

  if (GITHUB_PRIVATE && GITHUB_UPDATE_TOKEN) {
    feed.token = GITHUB_UPDATE_TOKEN;
  }

  autoUpdater.setFeedURL(feed);

  autoUpdater.on('checking-for-update', () => {
    notifyStatus({ type: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    notifyStatus({ type: 'available', info: mapInfo(info) });
  });

  autoUpdater.on('update-not-available', (info) => {
    notifyStatus({ type: 'not-available', info: mapInfo(info) });
  });

  autoUpdater.on('download-progress', (progress) => {
    notifyStatus({
      type: 'progress',
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    notifyStatus({ type: 'downloaded', info: mapInfo(info) });
  });

  autoUpdater.on('error', (err) => {
    notifyStatus(normalizeUpdateError(err));
  });
}

function scheduleUpdateChecks() {
  if (!packaged) return;

  setTimeout(() => {
    checkForUpdates().catch(() => {});
  }, STARTUP_DELAY_MS);

  if (checkTimer) clearInterval(checkTimer);
  checkTimer = setInterval(() => {
    checkForUpdates().catch(() => {});
  }, CHECK_INTERVAL_MS);
}

async function checkForUpdates() {
  if (!packaged) {
    return { ok: false, message: 'Mises à jour désactivées en développement.' };
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    return { ok: true, updateInfo: mapInfo(result?.updateInfo) };
  } catch (err) {
    const normalized = normalizeUpdateError(err);
    if (normalized.type === 'not-available') {
      notifyStatus(normalized);
      return { ok: true, updateInfo: null };
    }
    notifyStatus(normalized);
    return { ok: false, message: normalized.message };
  }
}

async function downloadUpdate() {
  if (!packaged) {
    return { ok: false, message: 'Mises à jour désactivées en développement.' };
  }
  try {
    await autoUpdater.downloadUpdate();
    return { ok: true };
  } catch (err) {
    const normalized = normalizeUpdateError(err);
    return { ok: false, message: normalized.message };
  }
}

function quitAndInstall() {
  if (!packaged) return false;
  autoUpdater.quitAndInstall(false, true);
  return true;
}

function getUpdateFeed() {
  return {
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    provider: 'github',
    private: GITHUB_PRIVATE,
    hasToken: Boolean(GITHUB_UPDATE_TOKEN),
  };
}

module.exports = {
  initUpdateManager,
  scheduleUpdateChecks,
  checkForUpdates,
  downloadUpdate,
  quitAndInstall,
  getUpdateFeed,
  normalizeUpdateError,
};
