const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const requirePermission = require('../middleware/require-permission');
const blockSystemposShell = require('../middleware/block-systempos-shell');
const { service } = require('../controllers')();

const router = Router();
router.use(authenticate);
router.use(blockSystemposShell);

router.get('/ready', requirePermission('order_view'), service.listReadyItems);
router.get('/pending', requirePermission('order_view'), service.listPendingItems);
router.get('/preparing', requirePermission('order_view'), service.listPreparingItems);

module.exports = router;
