const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const requireSuperAdmin = require('../middleware/require-superadmin');
const { license } = require('../controllers')();
const licenseCtrl = license;

const router = Router();

router.get('/status', authenticate, licenseCtrl.getStatus);
router.post('/activate', authenticate, requireSuperAdmin, licenseCtrl.activate);
router.delete('/revoke', authenticate, requireSuperAdmin, licenseCtrl.revoke);

module.exports = router;
