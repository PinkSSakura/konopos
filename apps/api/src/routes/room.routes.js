const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const requirePermission = require('../middleware/require-permission');
const { requireTablesEnabled } = require('../middleware/require-tables-enabled');
const { room } = require('../controllers')();

const router = Router();
router.use(authenticate);
router.use(requireTablesEnabled);

router.get('/', requirePermission('floor_view'), room.listRooms);
router.post('/', requirePermission('floor_create'), room.createRoom);
router.put('/:id', requirePermission('floor_update'), room.updateRoom);
router.delete('/:id', requirePermission('floor_delete'), room.deleteRoom);

module.exports = router;
