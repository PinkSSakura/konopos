const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const requirePermission = require('../middleware/require-permission');
const { expense } = require('../controllers')();

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('expense_view'), expense.list);
router.get('/summary', requirePermission('expense_view'), expense.summary);
router.get('/:id', requirePermission('expense_view'), expense.getOne);
router.post('/', requirePermission('expense_create'), expense.create);
router.put('/:id', requirePermission('expense_update'), expense.update);
router.delete('/:id', requirePermission('expense_softdelete'), expense.remove);

module.exports = router;
