const { app, BrowserWindow, ipcMain, clipboard, shell } = require('electron');

const path = require('path');



if (app.isPackaged) {

  app.setName('TouDev');

}



const APP_ICON = path.join(__dirname, 'icon.ico');

const QRCode = require('qrcode');

const backendManager = require('./backendManager');

const webManager = require('./webManager');

const { getLocalIPv4 } = require('./lib/network');

const { ensureApiEnv, ensureDataDir, getRuntimeInfo, isPackaged } = require('./lib/runtimeConfig');
const updateManager = require('./lib/updateManager');



let mainWindow = null;

let posWindow = null;

let cdsWindow = null;

let allowQuit = false;

let allowPosClose = false;



function createWindow() {

  mainWindow = new BrowserWindow({

    width: 520,

    height: 820,

    minWidth: 460,

    minHeight: 680,

    show: false,

    closable: false,

    webPreferences: {

      preload: path.join(__dirname, 'preload.js'),

      contextIsolation: true,

    },

    title: 'TouDev',

    icon: APP_ICON,

    autoHideMenuBar: true,

  });



  mainWindow.once('ready-to-show', () => {

    mainWindow.maximize();

    mainWindow.show();

  });



  mainWindow.on('close', (event) => {

    if (!allowQuit) event.preventDefault();

  });



  mainWindow.loadFile(path.join(__dirname, 'index.html'));

}



function gracefulExit() {

  if (allowQuit) return;

  allowQuit = true;



  sendLog({

    source: 'system',

    line: 'Arrêt du serveur, de l\'interface et fermeture…',

    level: 'info',

    at: new Date().toISOString(),

  });



  if (posWindow && !posWindow.isDestroyed()) {

    posWindow.destroy();

    posWindow = null;

  }



  webManager.stopWeb();

  backendManager.stopBackend();



  setTimeout(() => {

    if (mainWindow && !mainWindow.isDestroyed()) {

      mainWindow.destroy();

    }

    app.quit();

  }, 800);

}



function sendUpdateStatus(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-status', payload);
  }
}

function updateStatusLogLine(payload) {
  switch (payload?.type) {
    case 'checking':
      return 'Vérification des mises à jour…';
    case 'available':
      return `Mise à jour ${payload.info?.version || ''} disponible.`;
    case 'not-available':
      return 'Aucune mise à jour disponible.';
    case 'progress':
      return `Téléchargement mise à jour… ${Math.round(payload.percent || 0)}%`;
    case 'downloaded':
      return `Mise à jour ${payload.info?.version || ''} prête — redémarrer pour installer.`;
    case 'error':
      return `Mise à jour : ${payload.message || 'vérification impossible'}`;
    default:
      return null;
  }
}

function sendLog(entry) {

  if (mainWindow && !mainWindow.isDestroyed()) {

    mainWindow.webContents.send('log', entry);

  }

}



backendManager.onLog(sendLog);

webManager.onLog(sendLog);



function logRuntimeSetup() {

  if (!isPackaged()) return;



  ensureApiEnv();

  ensureDataDir();

  const info = getRuntimeInfo();

  const fs = require('fs');



  sendLog({

    source: 'system',

    line: `Mode installé — config: ${info.envFile}`,

    level: 'info',

    at: new Date().toISOString(),

  });



  sendLog({

    source: 'system',

    line: 'SQLite est utilisé en local. Éditez SQLITE_PATH dans ce fichier uniquement si vous voulez déplacer la base.',

    level: 'info',

    at: new Date().toISOString(),

  });



  if (!fs.existsSync(info.apiEntry)) {

    sendLog({

      source: 'system',

      line: `Erreur: backend introuvable (${info.apiEntry})`,

      level: 'error',

      at: new Date().toISOString(),

    });

  }

  if (!fs.existsSync(info.webDist)) {

    sendLog({

      source: 'system',

      line: `Erreur: interface introuvable (${info.webDist})`,

      level: 'error',

      at: new Date().toISOString(),

    });

  }

}



function autoStart() {

  logRuntimeSetup();

  sendLog({

    source: 'system',

    line: 'Démarrage automatique backend + interface…',

    level: 'info',

    at: new Date().toISOString(),

  });

  backendManager.startBackend().then(() => {

    setTimeout(() => webManager.startWeb(), 1500);

  });

}



ipcMain.handle('backend-start', () => backendManager.startBackend());

ipcMain.handle('backend-stop', () => backendManager.stopBackend());

ipcMain.handle('web-start', () => webManager.startWeb());

ipcMain.handle('web-stop', () => webManager.stopWeb());



ipcMain.handle('get-status', async () => {

  const port = webManager.getWebPort();

  const ips = getLocalIPv4();

  const [backendHealth, webHealth] = await Promise.all([

    backendManager.checkHealth(),

    webManager.checkWebHealth(),

  ]);



  const urls = ips.map((ip) => `http://${ip}:${port}`);

  const primaryUrl = urls[0] || `http://127.0.0.1:${port}`;

  const cdsUrl = `${primaryUrl}/cds`;

  const uiReady = Boolean(webHealth.uiOk);

  const backendOk = Boolean(backendHealth.ok);



  let qrDataUrl = null;

  let cdsQrDataUrl = null;

  if (uiReady && urls.length) {

    try {

      qrDataUrl = await QRCode.toDataURL(urls[0], {

        width: 240,

        margin: 2,

        color: { dark: '#1a1a1a', light: '#ffffff' },

      });

      cdsQrDataUrl = await QRCode.toDataURL(cdsUrl, {

        width: 240,

        margin: 2,

        color: { dark: '#1a1a1a', light: '#ffffff' },

      });

    } catch {

      qrDataUrl = null;

      cdsQrDataUrl = null;

    }

  }



  return {

    backend: {

      running: backendManager.isRunning(),

      ok: backendOk,

    },

    web: {

      running: webManager.isRunning(),

      uiReady,

      apiOk: webHealth.apiOk,

      port,

    },

    urls,

    primaryUrl,

    cdsUrl,

    qrDataUrl,

    cdsQrDataUrl,

    lanIps: ips,

    ready: backendOk && uiReady,

  };

});



ipcMain.handle('open-pos', async () => {

  const port = webManager.getWebPort();

  const url = `http://127.0.0.1:${port}`;

  const [backendHealth, webHealth] = await Promise.all([

    backendManager.checkHealth(),

    webManager.checkWebHealth(),

  ]);

  if (!backendHealth.ok || !webHealth.uiOk || !webHealth.apiOk) {

    return {

      ok: false,

      message: 'Backend ou interface pas encore prêts — attendez le statut « En ligne ».',

    };

  }



  if (posWindow && !posWindow.isDestroyed()) {
    posWindow.focus();
    posWindow.loadURL(url);
    if (!posWindow.isMaximized()) posWindow.maximize();
    return { ok: true };
  }

  posWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    closable: false,
    title: 'TouDev',
    icon: APP_ICON,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'pos-preload.js'),
    },
  });

  posWindow.once('ready-to-show', () => {
    posWindow.maximize();
    posWindow.show();
  });

  posWindow.on('close', (event) => {
    if (!allowQuit && !allowPosClose) event.preventDefault();
  });

  posWindow.on('closed', () => {
    posWindow = null;
  });

  posWindow.removeMenu();

  posWindow.webContents.on('before-input-event', (event, input) => {
    if (allowQuit) return;
    const key = String(input.key || '').toLowerCase();
    if (key === 'f5') {
      posWindow.webContents.reloadIgnoringCache();
      event.preventDefault();
      return;
    }
    const isCloseShortcut =
      (input.alt && key === 'f4') ||
      ((input.control || input.meta) && (key === 'w' || key === 'q'));
    if (isCloseShortcut) event.preventDefault();
  });

  await posWindow.loadURL(url);

  return { ok: true };

});



ipcMain.handle('open-cds', async () => {

  const port = webManager.getWebPort();

  const url = `http://127.0.0.1:${port}/cds`;

  const [backendHealth, webHealth] = await Promise.all([

    backendManager.checkHealth(),

    webManager.checkWebHealth(),

  ]);

  if (!backendHealth.ok || !webHealth.uiOk || !webHealth.apiOk) {

    return {

      ok: false,

      message: 'Backend ou interface pas encore prêts — attendez le statut « En ligne ».',

    };

  }



  if (cdsWindow && !cdsWindow.isDestroyed()) {

    cdsWindow.focus();

    cdsWindow.loadURL(url);

    return { ok: true };

  }



  cdsWindow = new BrowserWindow({

    width: 960,

    height: 720,

    minWidth: 640,

    minHeight: 480,

    show: false,

    title: 'TouDev — Écran client',

    icon: APP_ICON,

    autoHideMenuBar: true,

    webPreferences: {

      contextIsolation: true,

    },

  });



  cdsWindow.once('ready-to-show', () => {

    cdsWindow.show();

  });



  cdsWindow.on('closed', () => {

    cdsWindow = null;

  });



  cdsWindow.removeMenu();

  await cdsWindow.loadURL(url);

  return { ok: true };

});



ipcMain.handle('copy-url', (_event, url) => {

  clipboard.writeText(url);

  return { ok: true };

});



ipcMain.handle('open-browser', (_event, url) => shell.openExternal(url));

ipcMain.handle('pos-reload', () => {
  if (!posWindow || posWindow.isDestroyed()) {
    return { ok: false, message: 'Fenêtre POS fermée.' };
  }
  posWindow.webContents.reloadIgnoringCache();
  return { ok: true };
});

ipcMain.handle('pos-close', () => {
  if (!posWindow || posWindow.isDestroyed()) {
    return { ok: false, message: 'Fenêtre POS déjà fermée.' };
  }
  allowPosClose = true;
  posWindow.close();
  allowPosClose = false;
  return { ok: true };
});

ipcMain.handle('app-exit', () => {

  gracefulExit();

  return { ok: true };

});

ipcMain.handle('get-app-info', () => ({
  version: app.getVersion(),
  feed: updateManager.getUpdateFeed(),
  updatesEnabled: app.isPackaged,
}));

ipcMain.handle('update-check', () => updateManager.checkForUpdates());

ipcMain.handle('update-download', () => updateManager.downloadUpdate());

ipcMain.handle('update-quit-and-install', async () => {
  allowQuit = true;

  if (posWindow && !posWindow.isDestroyed()) {
    posWindow.destroy();
    posWindow = null;
  }

  if (cdsWindow && !cdsWindow.isDestroyed()) {
    cdsWindow.destroy();
    cdsWindow = null;
  }

  webManager.stopWeb();
  backendManager.stopBackend();

  sendLog({
    source: 'system',
    line: 'Installation de la mise à jour — redémarrage…',
    level: 'info',
    at: new Date().toISOString(),
  });

  setTimeout(() => {
    updateManager.quitAndInstall();
  }, 600);

  return { ok: true };
});



app.whenReady().then(() => {

  createWindow();

  updateManager.initUpdateManager({
    isPackaged: app.isPackaged,
    onStatus: (payload) => {
      sendUpdateStatus(payload);
      const line = updateStatusLogLine(payload);
      if (line) {
        sendLog({
          source: 'system',
          line,
          level: payload.type === 'error' ? 'error' : 'info',
          at: new Date().toISOString(),
        });
      }
    },
  });

  updateManager.scheduleUpdateChecks();

  autoStart();

});



app.on('window-all-closed', () => {

  if (allowQuit && process.platform !== 'darwin') app.quit();

});



app.on('before-quit', (event) => {

  if (!allowQuit) {

    event.preventDefault();

    return;

  }

  webManager.stopWeb();

  backendManager.stopBackend();

});


