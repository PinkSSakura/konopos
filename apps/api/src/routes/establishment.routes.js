const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const requireSuperAdmin = require('../middleware/require-super-admin');
const requirePermission = require('../middleware/require-permission');
const { establishment } = require('../controllers')();
const {
  getCurrent,
  getSettings,
  createCurrent,
  updateCurrent,
  uploadLogo,
  getSystemPrinters,
} = establishment;

const router = Router();

router.get('/current', authenticate, getCurrent);
router.get('/settings', authenticate, requirePermission('establishment_view'), getSettings);
router.get('/printers/system', authenticate, requirePermission('establishment_update'), getSystemPrinters);
router.post('/current', authenticate, requireSuperAdmin, createCurrent);
router.put('/current', authenticate, requirePermission('establishment_update'), updateCurrent);
router.patch('/current', authenticate, requirePermission('establishment_update'), updateCurrent);
router.post('/current/logo', authenticate, requirePermission('establishment_update'), uploadLogo);

module.exports = router;
