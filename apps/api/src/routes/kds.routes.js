const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const requirePermission = require('../middleware/require-permission');
const { kds } = require('../controllers')();
const requireOpenShift = require('../middleware/require-open-shift');

const router = Router();
router.use(authenticate);

function requireKdsType(req, res, next) {
  const t = String(req.params.type || '').toLowerCase();
  const perm = t === 'drink' ? 'kds_drink' : 'kds_food';
  return requirePermission(perm)(req, res, next);
}

router.get('/:type', requireKdsType, kds.listTickets);
router.patch('/items/:itemId', requireOpenShift, kds.updateItemStatus);

module.exports = router;
