const fs = require('fs');
const path = require('path');
const {
  isDesktopPos,
  getDataDir,
  createDataBackup,
  zipBackupFolder,
} = require('../db/backup');
const { getDb } = require('../db/sqlite');

async function exportBackup(req, res, next) {
  let snapshotDir = null;
  let zipPath = null;

  try {
    if (!isDesktopPos()) {
      return res.status(400).json({
        success: false,
        message: 'Export de sauvegarde disponible uniquement sur le poste POS desktop.',
      });
    }

    const dataDir = getDataDir();
    snapshotDir = createDataBackup(dataDir, { reason: 'manual_export' }, getDb());
    zipPath = zipBackupFolder(snapshotDir);

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const filename = `konopos-backup-${stamp}.zip`;
    res.download(zipPath, filename, () => {
      if (zipPath && fs.existsSync(zipPath)) fs.rmSync(zipPath, { force: true });
      if (snapshotDir && fs.existsSync(snapshotDir)) fs.rmSync(snapshotDir, { recursive: true, force: true });
    });
  } catch (err) {
    if (zipPath && fs.existsSync(zipPath)) fs.rmSync(zipPath, { force: true });
    if (snapshotDir && fs.existsSync(snapshotDir)) fs.rmSync(snapshotDir, { recursive: true, force: true });
    return next(err);
  }
}

module.exports = {
  exportBackup,
};
