const { Order } = require('../models');
const { query, kds, orderownership } = require('../utils')();
const { getEstablishmentId } = query;
const { canReprintKitchenTicket } = kds;
const { assertWaiterOrderAccess } = orderownership;
const { print } = require('../services')();
const { reprintFullOrder } = print;

function handleAccessError(res, err, next) {
  if (err.status) {
    return res.status(err.status).json({ success: false, message: err.message, code: err.code });
  }
  return next(err);
}

async function printKitchen(req, res, next) {
  try {
    const roleKey = req.user.role?.role_key;
    if (!canReprintKitchenTicket(roleKey)) {
      return res.status(403).json({
        success: false,
        message: 'Seuls le serveur, le manager, le sous-manager ou le propriétaire peuvent réimprimer.',
      });
    }

    const estId = getEstablishmentId(req);
    const order = await Order.findOne({ _id: req.params.id, establishment: estId, is_deleted: false });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Commande introuvable.' });
    }

    try {
      await assertWaiterOrderAccess(req, order, 'print');
    } catch (err) {
      return handleAccessError(res, err, next);
    }

    const result = await reprintFullOrder(estId, req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    return next(err);
  }
}

module.exports = { printKitchen };
