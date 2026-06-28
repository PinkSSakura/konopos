const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const requirePermission = require('../middleware/require-permission');
const requireAnyPermission = require('../middleware/require-any-permission');
const { analytics } = require('../controllers')();

const router = Router();
router.use(authenticate);

router.get('/dashboard', requirePermission('view_dashboard'), analytics.dashboard);
router.get('/export/business.pdf', requirePermission('export_pdf'), analytics.exportBusinessPdf);
router.get(
  '/export/staff.pdf',
  requireAnyPermission(['report_export_staff', 'report_self_export']),
  analytics.exportStaffPdf
);
router.get(
  '/staff-report/users',
  requirePermission('report_export_staff'),
  analytics.listStaffReportUsers
);

module.exports = router;
