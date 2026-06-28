const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const requirePermission = require('../middleware/require-permission');
const { session } = require('../controllers')();
const sessionCtrl = session;

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('user_view_sessions'), sessionCtrl.list);
router.post('/:id/force-logout', requirePermission('user_force_logout'), sessionCtrl.forceLogout);

module.exports = router;
