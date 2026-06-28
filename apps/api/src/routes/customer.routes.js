const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const requirePermission = require('../middleware/require-permission');
const requireAnyPermission = require('../middleware/require-any-permission');
const { customer } = require('../controllers')();

const router = Router();
router.use(authenticate);

const canView = requireAnyPermission(['client_view', 'payment_process']);

router.get('/', canView, customer.list);
router.get('/:id', requirePermission('client_view'), customer.getOne);
router.post('/', requirePermission('client_create'), customer.create);
router.put('/:id', requirePermission('client_update'), customer.update);
router.delete('/:id', requirePermission('client_softdelete'), customer.remove);

module.exports = router;
