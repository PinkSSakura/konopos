const statusPill = document.getElementById('status-pill');
const backendStatus = document.getElementById('backend-status');
const webStatus = document.getElementById('web-status');
const btnBackendStart = document.getElementById('btn-backend-start');
const btnBackendStop = document.getElementById('btn-backend-stop');
const btnWebStart = document.getElementById('btn-web-start');
const btnWebStop = document.getElementById('btn-web-stop');
const btnOpenPos = document.getElementById('btn-open-pos');
const btnOpenCds = document.getElementById('btn-open-cds');
const btnCopyUrl = document.getElementById('btn-copy-url');
const btnExit = document.getElementById('btn-exit');
const btnUpdateCheck = document.getElementById('btn-update-check');
const btnUpdateDownload = document.getElementById('btn-update-download');
const btnUpdateInstall = document.getElementById('btn-update-install');
const updateVersion = document.getElementById('update-version');
const updateStatusText = document.getElementById('update-status-text');
const updateProgressWrap = document.getElementById('update-progress-wrap');
const updateProgressFill = document.getElementById('update-progress-fill');
const updateProgressLabel = document.getElementById('update-progress-label');
const qrWrap = document.getElementById('qr-wrap');
const cdsQrWrap = document.getElementById('cds-qr-wrap');
const primaryUrl = document.getElementById('primary-url');
const cdsUrlEl = document.getElementById('cds-url');
const allUrls = document.getElementById('all-urls');
const logsEl = document.getElementById('logs');

let lastPrimaryUrl = '';
let updateState = {
  availableVersion: null,
  downloaded: false,
  checking: false,
  downloading: false,
};

function setUpdateUi() {
  const { availableVersion, downloaded, checking, downloading } = updateState;

  btnUpdateCheck.disabled = checking || downloading;
  btnUpdateDownload.classList.toggle('hidden', !availableVersion || downloaded);
  btnUpdateDownload.disabled = downloading || downloaded || !availableVersion;
  btnUpdateInstall.classList.toggle('hidden', !downloaded);
  updateProgressWrap.classList.toggle('hidden', !downloading);
}

function applyUpdateStatus(payload) {
  if (!payload?.type) return;

  switch (payload.type) {
    case 'disabled':
      updateStatusText.textContent = 'Mises à jour actives uniquement sur l\'application installée.';
      break;
    case 'checking':
      updateState.checking = true;
      updateStatusText.textContent = 'Vérification des mises à jour…';
      setUpdateUi();
      break;
    case 'available':
      updateState.checking = false;
      updateState.availableVersion = payload.info?.version || null;
      updateStatusText.textContent = `Version ${payload.info?.version} disponible.`;
      setUpdateUi();
      break;
    case 'not-available':
      updateState.checking = false;
      updateState.availableVersion = null;
      updateState.downloaded = false;
      updateStatusText.textContent = 'Vous utilisez la dernière version.';
      setUpdateUi();
      break;
    case 'progress':
      updateState.downloading = true;
      updateState.checking = false;
      updateProgressFill.style.width = `${Math.round(payload.percent || 0)}%`;
      updateProgressLabel.textContent = `Téléchargement… ${Math.round(payload.percent || 0)}%`;
      updateStatusText.textContent = 'Téléchargement de la mise à jour…';
      setUpdateUi();
      break;
    case 'downloaded':
      updateState.downloading = false;
      updateState.downloaded = true;
      updateState.availableVersion = payload.info?.version || updateState.availableVersion;
      updateProgressFill.style.width = '100%';
      updateProgressLabel.textContent = 'Téléchargement terminé.';
      updateStatusText.textContent = `Version ${updateState.availableVersion} prête. Redémarrez après la fermeture pour installer.`;
      setUpdateUi();
      break;
    case 'error':
      updateState.checking = false;
      updateState.downloading = false;
      updateStatusText.textContent = payload.message || 'Vérification impossible. Réessayez plus tard.';
      setUpdateUi();
      break;
    default:
      break;
  }
}

async function loadAppInfo() {
  const info = await window.posDesktop.getAppInfo();
  if (!info) return;
  updateVersion.textContent = `Version installée : ${info.version}`;
  if (!info.updatesEnabled) {
    updateStatusText.textContent = 'Mises à jour actives uniquement sur l\'application installée.';
    btnUpdateCheck.disabled = true;
  }
}

function setPill(mode, label) {
  statusPill.className = `status-pill status-${mode}`;
  statusPill.textContent = label;
}

function setChip(el, mode, label) {
  el.className = `chip chip-${mode}`;
  el.textContent = label;
}

function appendLog(entry) {
  if (!logsEl) return;
  const line = document.createElement('div');
  const sourceClass = entry.source === 'backend' ? 'log-backend'
    : entry.source === 'web' ? 'log-web' : 'log-system';
  line.className = `${sourceClass}${entry.level === 'error' ? ' log-error' : ''}`;
  const prefix = entry.source ? `[${entry.source}] ` : '';
  line.textContent = `[${new Date(entry.at).toLocaleTimeString('fr-FR')}] ${prefix}${entry.line}`;
  logsEl.appendChild(line);
  logsEl.scrollTop = logsEl.scrollHeight;
}

function renderQr(status) {
  qrWrap.innerHTML = '';
  allUrls.innerHTML = '';
  if (cdsQrWrap) cdsQrWrap.innerHTML = '';

  if (status.ready && status.primaryUrl) {
    if (status.qrDataUrl) {
      const img = document.createElement('img');
      img.src = status.qrDataUrl;
      img.alt = 'QR code POS';
      qrWrap.appendChild(img);
    }
    primaryUrl.textContent = status.primaryUrl;
    lastPrimaryUrl = status.primaryUrl;
    status.urls.forEach((url) => {
      const li = document.createElement('li');
      li.textContent = url;
      allUrls.appendChild(li);
    });
    btnOpenPos.disabled = false;
    btnCopyUrl.disabled = false;
    if (btnOpenCds) btnOpenCds.disabled = false;

    if (cdsQrWrap && status.cdsUrl) {
      if (status.cdsQrDataUrl) {
        const cdsImg = document.createElement('img');
        cdsImg.src = status.cdsQrDataUrl;
        cdsImg.alt = 'QR code écran client';
        cdsQrWrap.appendChild(cdsImg);
      }
      if (cdsUrlEl) cdsUrlEl.textContent = status.cdsUrl;
    }
  } else {
    qrWrap.innerHTML = '<div class="qr-placeholder">Interface en cours de démarrage…</div>';
    primaryUrl.textContent = '';
    lastPrimaryUrl = '';
    btnOpenPos.disabled = true;
    btnCopyUrl.disabled = true;
    if (btnOpenCds) btnOpenCds.disabled = true;
    if (cdsQrWrap) {
      cdsQrWrap.innerHTML = '<div class="qr-placeholder">Interface en cours de démarrage…</div>';
    }
    if (cdsUrlEl) cdsUrlEl.textContent = '';
  }
}

async function refresh() {
  const status = await window.posDesktop.getStatus();

  if (status.backend.ok) {
    setChip(backendStatus, 'on', 'Backend en ligne');
    btnBackendStart.disabled = true;
    btnBackendStop.disabled = !status.backend.running;
  } else if (status.backend.running) {
    setChip(backendStatus, 'starting', 'Démarrage…');
    btnBackendStart.disabled = true;
    btnBackendStop.disabled = false;
  } else {
    setChip(backendStatus, 'off', 'Arrêté');
    btnBackendStart.disabled = false;
    btnBackendStop.disabled = true;
  }

  if (status.web.uiReady) {
    setChip(webStatus, 'on', 'Interface en ligne');
    btnWebStart.disabled = true;
    btnWebStop.disabled = !status.web.running;
  } else if (status.web.running) {
    setChip(webStatus, 'starting', 'Démarrage…');
    btnWebStart.disabled = true;
    btnWebStop.disabled = false;
  } else {
    setChip(webStatus, 'off', 'Arrêtée');
    btnWebStart.disabled = false;
    btnWebStop.disabled = true;
  }

  if (status.ready) {
    setPill('running', 'En ligne');
  } else if (status.backend.running || status.web.running) {
    setPill('partial', 'Démarrage…');
  } else {
    setPill('stopped', 'Arrêté');
  }

  renderQr(status);
}

btnBackendStart.addEventListener('click', async () => {
  const res = await window.posDesktop.startBackend();
  appendLog({ source: 'system', line: res.message, level: res.ok ? 'info' : 'error', at: new Date().toISOString() });
  refresh();
});

btnBackendStop.addEventListener('click', async () => {
  const res = await window.posDesktop.stopBackend();
  appendLog({ source: 'system', line: res.message, level: 'info', at: new Date().toISOString() });
  refresh();
});

btnWebStart.addEventListener('click', async () => {
  const res = await window.posDesktop.startWeb();
  appendLog({ source: 'system', line: res.message, level: res.ok ? 'info' : 'error', at: new Date().toISOString() });
  refresh();
});

btnWebStop.addEventListener('click', async () => {
  const res = await window.posDesktop.stopWeb();
  appendLog({ source: 'system', line: res.message, level: 'info', at: new Date().toISOString() });
  refresh();
});

btnOpenPos.addEventListener('click', async () => {
  btnOpenPos.disabled = true;
  const res = await window.posDesktop.openPos();
  if (!res?.ok) {
    appendLog({
      source: 'system',
      line: res?.message || 'Impossible d\'ouvrir le POS — attendez que backend et interface soient prêts.',
      level: 'error',
      at: new Date().toISOString(),
    });
  }
  refresh();
});

if (btnOpenCds) {
  btnOpenCds.addEventListener('click', async () => {
    btnOpenCds.disabled = true;
    const res = await window.posDesktop.openCds();
    if (!res?.ok) {
      appendLog({
        source: 'system',
        line: res?.message || 'Impossible d\'ouvrir l\'écran client — attendez que backend et interface soient prêts.',
        level: 'error',
        at: new Date().toISOString(),
      });
    }
    refresh();
  });
}

btnCopyUrl.addEventListener('click', () => {
  if (lastPrimaryUrl) window.posDesktop.copyUrl(lastPrimaryUrl);
});

btnExit.addEventListener('click', async () => {
  btnExit.disabled = true;
  btnExit.textContent = 'EXIT…';
  appendLog({
    source: 'system',
    line: 'EXIT — arrêt en cours…',
    level: 'info',
    at: new Date().toISOString(),
  });
  await window.posDesktop.exit();
});

btnUpdateCheck.addEventListener('click', async () => {
  updateState.checking = true;
  updateStatusText.textContent = 'Vérification des mises à jour…';
  setUpdateUi();
  const res = await window.posDesktop.checkForUpdates();
  if (!res?.ok && res?.message) {
    updateState.checking = false;
    updateStatusText.textContent = res.message;
    setUpdateUi();
  } else if (res?.ok && !res?.updateInfo) {
    updateState.checking = false;
    updateStatusText.textContent = 'Vous utilisez la dernière version.';
    setUpdateUi();
  }
});

btnUpdateDownload.addEventListener('click', async () => {
  updateState.downloading = true;
  setUpdateUi();
  const res = await window.posDesktop.downloadUpdate();
  if (!res?.ok) {
    updateState.downloading = false;
    updateStatusText.textContent = res?.message || 'Téléchargement impossible.';
    setUpdateUi();
  }
});

btnUpdateInstall.addEventListener('click', async () => {
  btnUpdateInstall.disabled = true;
  btnUpdateInstall.textContent = 'Redémarrage…';
  appendLog({
    source: 'system',
    line: 'Installation de la mise à jour — fermeture…',
    level: 'info',
    at: new Date().toISOString(),
  });
  await window.posDesktop.quitAndInstall();
});

window.posDesktop.onLog(appendLog);
window.posDesktop.onUpdateStatus(applyUpdateStatus);

loadAppInfo();
setUpdateUi();
setInterval(refresh, 2000);
refresh();
