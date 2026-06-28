const path = require('path');

function getProjectRoot() {
  try {
    const { app } = require('electron');
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'bundle');
    }
  } catch {
    // Outside Electron main process
  }
  return path.join(__dirname, '..', '..', '..');
}

module.exports = { getProjectRoot };
