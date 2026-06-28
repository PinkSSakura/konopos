const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const requirePermission = require('../middleware/require-permission');
const { shift } = require('../controllers')();

const router = Router();
router.use(authenticate);

router.get('/open', requirePermission('shift_manage'), shift.listOpenShifts);
router.post('/start-for-user', requirePermission('shift_manage'), shift.startShiftForUserHandler);
router.post('/close-for-user', shift.closeShiftForUserHandler);
router.get('/current', requirePermission('shift_view_own'), shift.getCurrentShift);
router.post('/start', requirePermission('shift_view_own'), shift.startShift);
router.post('/close', requirePermission('shift_view_own'), shift.closeShift);
router.get('/history/me', requirePermission('shift_view_own'), shift.listMyShiftHistory);
router.get('/daily-summary/me', requirePermission('shift_view_own'), shift.getMyDailySummary);
router.get('/waiter-daily-close/me', requirePermission('shift_view_own'), shift.getMyWaiterDailyClose);
router.post('/waiter-daily-close/me/print', requirePermission('shift_view_own'), shift.printMyWaiterDailyClose);
router.get('/waiter-daily-close', requirePermission('shift_view_own'), shift.getWaiterDailyClose);
router.post('/waiter-daily-close/print', requirePermission('shift_view_own'), shift.printWaiterDailyClose);
router.get('/waiter-daily-close.pdf', requirePermission('shift_view_own'), shift.exportWaiterDailyClosePdf);

module.exports = router;
