const { Router } = require('express');
const setupRoutes = require('./setup.routes');
const authRoutes = require('./auth.routes');
const establishmentRoutes = require('./establishment.routes');
const healthRoutes = require('./health.routes');
const licenseRoutes = require('./license.routes');
const menuRoutes = require('./menu.routes');
const roomRoutes = require('./room.routes');
const tableRoutes = require('./table.routes');
const orderRoutes = require('./order.routes');
const paymentRoutes = require('./payment.routes');
const pushRoutes = require('./push.routes');
const customerRoutes = require('./customer.routes');
const expenseRoutes = require('./expense.routes');
const kdsRoutes = require('./kds.routes');
const serviceRoutes = require('./service.routes');
const shiftRoutes = require('./shift.routes');
const cdsRoutes = require('./cds.routes');
const shiftAdminRoutes = require('./shift-admin.routes');
const adminRoutes = require('./admin.routes');
const sessionRoutes = require('./session.routes');
const activityRoutes = require('./activity.routes');
const analyticsRoutes = require('./analytics.routes');
const requireValidLicense = require('../middleware/require-valid-license');

const router = Router();

router.use('/health', healthRoutes);
router.use('/setup', setupRoutes);
router.use('/auth', authRoutes);
router.use('/license', licenseRoutes);

router.use(requireValidLicense);

router.use('/establishment', establishmentRoutes);
router.use('/menu', menuRoutes);
router.use('/rooms', roomRoutes);
router.use('/tables', tableRoutes);
router.use('/orders', orderRoutes);
router.use('/payments', paymentRoutes);
router.use('/push', pushRoutes);
router.use('/customers', customerRoutes);
router.use('/expenses', expenseRoutes);
router.use('/kds', kdsRoutes);
router.use('/service', serviceRoutes);
router.use('/cds', cdsRoutes);
router.use('/shifts', shiftRoutes);
router.use('/shift-admin', shiftAdminRoutes);
router.use('/admin', adminRoutes);
router.use('/sessions', sessionRoutes);
router.use('/activity', activityRoutes);
router.use('/analytics', analyticsRoutes);

module.exports = router;
