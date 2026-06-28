const { setup } = require('../controllers')();
const { Router } = require('express');
const { getSetupStatus, completeSetup } = setup;
const { authenticate } = require('../middleware/auth');
const requireSuperAdmin = require('../middleware/require-super-admin');

const router = Router();

router.get('/status', getSetupStatus);
router.post('/complete', authenticate, requireSuperAdmin, completeSetup);

module.exports = router;
