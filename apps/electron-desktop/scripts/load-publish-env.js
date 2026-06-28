const fs = require('fs');
const path = require('path');

function loadPublishEnv() {
  const envPath = path.join(__dirname, '..', '.env.publish.local');
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key && value && process.env[key] == null) {
      process.env[key] = value;
    }
  }
}

module.exports = { loadPublishEnv };
