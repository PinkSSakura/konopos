require('./loadenv');

const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const app = require('./app');
const config = require('./config');
const connectDB = require('./db/connect');
const { initWebSocket } = require('./websocket');
const { ensureBootstrapData } = require('./seeds/bootstrap');
const { lan } = require('./utils')();
const { getLocalIPv4 } = lan;

function ensureLanFirewall() {
  if (process.platform !== 'win32') return;
  const script = path.join(__dirname, '..', '..', 'electron-desktop', 'scripts', 'open-firewall.ps1');
  spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  }).unref();
}

async function start() {
  await connectDB();
  await ensureBootstrapData();
  console.log('Bootstrap auto: superadmin prêt.');

  const server = http.createServer(app);
  initWebSocket(server);

  server.listen(config.port, config.host, () => {
    const addresses = getLocalIPv4().map((ip) => `http://${ip}:${config.port}`);
    console.log(`API : http://localhost:${config.port}`);
    if (addresses.length) {
      console.log(`API (réseau local) : ${addresses.join(', ')}`);
    }
    if (config.allowLanCors) {
      console.log('CORS : origines réseau local autorisées (192.168.x.x, 10.x.x.x, …)');
    }
    ensureLanFirewall();
  });
}

start().catch((err) => {
  console.error('Échec démarrage API:', err);
  process.exit(1);
});
