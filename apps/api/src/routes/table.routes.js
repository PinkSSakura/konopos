const { Router } = require('express');

const { authenticate } = require('../middleware/auth');

const requirePermission = require('../middleware/require-permission');
const blockSystemposShell = require('../middleware/block-systempos-shell');
const { requireTablesEnabled } = require('../middleware/require-tables-enabled');

const { table } = require('../controllers')();



const router = Router();

router.use(authenticate);
router.use(blockSystemposShell);
router.use(requireTablesEnabled);



router.get('/', requirePermission('table_view'), table.listTables);

router.post('/merge', requirePermission('table_merge'), table.mergeTables);

router.post('/orders/merge', requirePermission('table_merge'), table.mergeOrders);

router.post('/', requirePermission('table_create'), table.createTable);

router.put('/:id', requirePermission('table_update'), table.updateTable);

router.patch('/:id/status', requirePermission('table_update'), table.updateTableStatus);

router.delete('/:id', requirePermission('table_delete'), table.deleteTable);

router.post('/:id/assign', requirePermission('table_assign'), table.assignOrder);

router.post('/:id/unassign', requirePermission('table_assign'), table.unassignOrder);

router.post('/:id/split', requirePermission('table_split'), table.splitTables);



module.exports = router;

