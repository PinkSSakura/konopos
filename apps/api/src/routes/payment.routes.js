const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const requirePermission = require('../middleware/require-permission');
const requireOpenShift = require('../middleware/require-open-shift');
const blockSystemposShell = require('../middleware/block-systempos-shell');
const { payment } = require('../controllers')();

const router = Router();
router.use(authenticate);
router.use(blockSystemposShell);

router.get('/ready', requirePermission('payment_process'), payment.listReady);
router.post('/batch-checkout', requirePermission('payment_process'), requireOpenShift, payment.batchCheckout);
router.get('/by-daily-code/:code', requirePermission('payment_code_lookup'), payment.lookupByDailyCode);
router.get('/history', requirePermission('payment_history'), payment.history);
router.get('/daily-summary', requirePermission('payment_day_close'), payment.dailySummary);
router.post('/daily-close', requirePermission('payment_day_close'), requireOpenShift, payment.dailyClose);
router.post('/:paymentId/void', requirePermission('payment_cancel'), requireOpenShift, payment.voidPaymentHandler);

module.exports = router;
