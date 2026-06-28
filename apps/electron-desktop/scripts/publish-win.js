const { spawnSync } = require('child_process');
const path = require('path');
const { loadPublishEnv } = require('./load-publish-env');

loadPublishEnv();
require('./embed-update-token');

const electronDesktopRoot = path.join(__dirname, '..');
const args = ['electron-builder', '--config', 'electron-builder.config.js', '--win', '--publish', 'always'];

const result = spawnSync('npx', args, {
  cwd: electronDesktopRoot,
  stdio: 'inherit',
  env: process.env,
  shell: true,
});

process.exit(result.status ?? 1);
