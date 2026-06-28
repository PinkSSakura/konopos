const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const requirePermission = require('../middleware/require-permission');
const { license } = require('../controllers')();
const licenseCtrl = license;

const router = Router();

router.get('/status', authenticate, licenseCtrl.getStatus);
router.post('/activate', authenticate, requirePermission('license_activate'), licenseCtrl.activate);
router.delete('/revoke', authenticate, requirePermission('license_revoke'), licenseCtrl.revoke);

module.exports = router;
