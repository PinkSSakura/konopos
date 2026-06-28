const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const blockSystemposShell = require('../middleware/block-systempos-shell');
const { push } = require('../controllers')();

const router = Router();
router.use(authenticate);
router.use(blockSystemposShell);

router.get('/vapid-public-key', push.vapidPublicKey);
router.post('/subscribe', push.subscribe);
router.post('/unsubscribe', push.unsubscribe);

module.exports = router;
