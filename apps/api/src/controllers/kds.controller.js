const { OrderItem, Order, Establishment } = require('../models');
const { query, kds, serializers } = require('../utils')();
const { getEstablishmentId } = query;
const {
  isKitchenAcceptRejectEnabled,
  canOverrideKitchenStaffDispatch,
  getKitchenProductType,
  isKitchenStaffRole,
} = kds;
const { serializeOrderItem } = serializers;
const { order, notify, push } = require('../services')();
const { syncOrderStatusFromItems } = order;
const { emitKdsChanged, emitOrderChanged, emitServiceChanged } = notify;
const { notifyItemReady } = push;

const KDS_DISPLAY_STATUSES = ['new', 'preparing', 'ready'];

function kitchenStaffDispatchFlag(establishment, roleKey) {
  const enabled = isKitchenAcceptRejectEnabled(establishment);
  if (canOverrideKitchenStaffDispatch(roleKey)) return false;
  return enabled;
}

function resolveProductType(raw) {
  const t = String(raw || '').toLowerCase();
  return t === 'drink' ? 'DRINK' : 'FOOD';
}

const ORDER_ITEM_POPULATE = {
  path: 'order',
  select: 'order_number type table notes waiter created_by',
  populate: [
    { path: 'table', select: 'name' },
    { path: 'waiter', select: '_id fullname' },
  ],
};

async function listTickets(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const productType = resolveProductType(req.params.type);
    const establishment = await Establishment.findById(estId).select(
      'kds_kitchen_accept_reject kds_accept_required'
    );
    const kitchenStaffDispatch = kitchenStaffDispatchFlag(
      establishment,
      req.user?.role?.role_key
    );

    const items = await OrderItem.find({
      establishment: estId,
      product_type: productType,
      status: { $in: KDS_DISPLAY_STATUSES },
      sent_to_kitchen_at: { $ne: null },
    })
      .populate(ORDER_ITEM_POPULATE)
      .sort({ sent_to_kitchen_at: 1, createdAt: 1 });

    res.json({
      success: true,
      data: { items, kitchen_staff_dispatch: kitchenStaffDispatch },
    });
  } catch (err) {
    next(err);
  }
}

async function updateItemStatus(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const roleKey = req.user?.role?.role_key;
    const establishment = await Establishment.findById(estId).select(
      'kds_kitchen_accept_reject kds_accept_required'
    );

    if (!isKitchenAcceptRejectEnabled(establishment)) {
      return res.status(403).json({
        success: false,
        message: 'Validation réservée au serveur (écran Service).',
      });
    }

    if (!canOverrideKitchenStaffDispatch(roleKey) && !isKitchenStaffRole(roleKey)) {
      return res.status(403).json({
        success: false,
        message: 'Validation réservée au personnel cuisine (écran KDS).',
      });
    }

    const item = await OrderItem.findOne({ _id: req.params.itemId, establishment: estId });
    if (!item) {
      return res.status(404).json({ success: false, message: 'Article introuvable.' });
    }

    if (!canOverrideKitchenStaffDispatch(roleKey)) {
      const stationType = getKitchenProductType(roleKey);
      if (stationType && item.product_type !== stationType) {
        return res.status(403).json({
          success: false,
          message: 'Article d\'un autre poste (cuisine / bar).',
        });
      }
    }

    const orderDoc = await Order.findOne({
      _id: item.order,
      establishment: estId,
      is_deleted: false,
    });
    if (!orderDoc) {
      return res.status(404).json({ success: false, message: 'Commande introuvable.' });
    }

    const { status, rejection_reason } = req.body;

    if (!item.sent_to_kitchen_at) {
      return res.status(400).json({
        success: false,
        message: 'L\'article n\'a pas encore été envoyé en cuisine / bar.',
      });
    }

    if (status === 'rejected') {
      if (!['new', 'preparing'].includes(item.status)) {
        return res.status(400).json({
          success: false,
          message: 'Seuls les articles en attente ou en préparation peuvent être rejetés.',
        });
      }
      if (!rejection_reason?.trim()) {
        return res.status(400).json({ success: false, message: 'Motif de rejet requis.' });
      }
      item.rejection_reason = rejection_reason.trim();
      item.status = 'rejected';
    } else if (status === 'preparing') {
      if (item.status !== 'new') {
        return res.status(400).json({
          success: false,
          message: 'Seuls les articles en attente de validation peuvent être acceptés.',
        });
      }
      item.status = 'preparing';
    } else if (status === 'ready') {
      if (item.status !== 'preparing') {
        return res.status(400).json({
          success: false,
          message: 'L\'article doit être en préparation.',
        });
      }
      item.status = 'ready';
      item.prepared_at = new Date();
    } else {
      return res.status(400).json({ success: false, message: 'Statut invalide.' });
    }

    await item.save();
    await syncOrderStatusFromItems(orderDoc._id);

    emitKdsChanged(estId, item.product_type);
    emitOrderChanged(estId, orderDoc._id);
    if (status === 'ready') {
      emitServiceChanged(estId);
      notifyItemReady(estId, orderDoc._id, item, req.user._id).catch(() => {});
    }

    res.json({ success: true, data: serializeOrderItem(item) });
  } catch (err) {
    next(err);
  }
}

module.exports = { listTickets, updateItemStatus };
