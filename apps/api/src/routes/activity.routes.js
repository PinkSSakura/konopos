const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const requirePermission = require('../middleware/require-permission');
const { audit } = require('../controllers')();

const router = Router();
router.use(authenticate);

router.get('/staff', requirePermission('activity_view'), audit.listStaffActivity);

module.exports = router;
