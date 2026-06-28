const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const requirePermission = require('../middleware/require-permission');
const { admin } = require('../controllers')();

const router = Router();
router.use(authenticate);

router.get('/shifts', requirePermission('shift_view_all'), admin.shiftAdmin.listShifts);
router.get('/staff', requirePermission('shift_plan_view'), admin.shiftAdmin.listStaff);
router.get('/plans', requirePermission('shift_plan_view'), admin.shiftAdmin.listPlans);
router.post('/plans', requirePermission('shift_plan_create'), admin.shiftAdmin.createPlan);
router.put('/plans/:id', requirePermission('shift_plan_update'), admin.shiftAdmin.updatePlan);
router.delete('/plans/:id', requirePermission('shift_plan_delete'), admin.shiftAdmin.deletePlan);

module.exports = router;
