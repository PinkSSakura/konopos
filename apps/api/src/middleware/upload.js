const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const apiRoot = process.env.KONOPOS_DATA_DIR || path.join(__dirname, '../..');
const uploadsRoot = path.join(apiRoot, 'uploads');

const categoryUploadDir = path.join(uploadsRoot, 'categories');
const menuItemUploadDir = path.join(uploadsRoot, 'menu-items');
const extraUploadDir = path.join(uploadsRoot, 'extras');
const establishmentUploadDir = path.join(uploadsRoot, 'establishments');
fs.mkdirSync(categoryUploadDir, { recursive: true });
fs.mkdirSync(menuItemUploadDir, { recursive: true });
fs.mkdirSync(extraUploadDir, { recursive: true });
fs.mkdirSync(establishmentUploadDir, { recursive: true });

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

function createImageUpload(destination) {
  const storage = multer.diskStorage({
    destination,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
    },
  });

  return multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (IMAGE_EXT.has(ext)) cb(null, true);
      else cb(new Error('Format image non supporté (jpg, png, webp, gif).'));
    },
  });
}

const categoryImageUpload = createImageUpload(categoryUploadDir);
const menuItemImageUpload = createImageUpload(menuItemUploadDir);
const extraImageUpload = createImageUpload(extraUploadDir);
const establishmentLogoUpload = createImageUpload(establishmentUploadDir);

module.exports = {
  categoryImageUpload,
  menuItemImageUpload,
  extraImageUpload,
  establishmentLogoUpload,
  categoryUploadDir,
  menuItemUploadDir,
  extraUploadDir,
  establishmentUploadDir,
};
