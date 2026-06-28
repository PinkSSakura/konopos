const { OrderItem, Establishment } = require('../models');
const { query, kds, orderownership } = require('../utils')();
const { getEstablishmentId } = query;
const { isKitchenAcceptRejectEnabled, canOverrideKitchenStaffDispatch } = kds;
const { filterServiceItemsForWaiter } = orderownership;

function kitchenStaffDispatchFlag(establishment, roleKey) {
  const enabled = isKitchenAcceptRejectEnabled(establishment);
  if (canOverrideKitchenStaffDispatch(roleKey)) return false;
  return enabled;
}

function waiterServeOnlyFlag(establishment, roleKey) {
  if (roleKey !== 'waiter') return false;
  return Boolean(establishment?.waiter_service_served_only);
}

function serviceReadyOnSendFlag(establishment) {
  return Boolean(establishment?.service_ready_on_send);
}

function shouldHideServiceDispatch(establishment, roleKey) {
  return kitchenStaffDispatchFlag(establishment, roleKey)
    || waiterServeOnlyFlag(establishment, roleKey)
    || serviceReadyOnSendFlag(establishment);
}

const ORDER_POPULATE_SELECT = 'order_number type table notes waiter created_by daily_code';

async function listReadyItems(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const items = await OrderItem.find({
      establishment: estId,
      status: 'ready',
    })
      .populate({
        path: 'order',
        select: ORDER_POPULATE_SELECT,
        populate: [
          { path: 'table', select: 'name' },
          { path: 'waiter', select: '_id fullname' },
        ],
      })
      .sort({ prepared_at: 1, createdAt: 1 });

    res.json({ success: true, data: filterServiceItemsForWaiter(req.user, items) });
  } catch (err) {
    next(err);
  }
}

async function listPendingItems(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const establishment = await Establishment.findById(estId).select(
      'kds_kitchen_accept_reject kds_accept_required waiter_service_served_only service_ready_on_send'
    );
    const kitchenStaffDispatch = kitchenStaffDispatchFlag(
      establishment,
      req.user?.role?.role_key
    );
    const hideDispatch = shouldHideServiceDispatch(
      establishment,
      req.user?.role?.role_key
    );

    if (hideDispatch) {
      return res.json({
        success: true,
        data: { items: [], kitchen_staff_dispatch: kitchenStaffDispatch || hideDispatch },
      });
    }

    const items = await OrderItem.find({
      establishment: estId,
      status: 'new',
      sent_to_kitchen_at: { $ne: null },
    })
      .populate({
        path: 'order',
        select: ORDER_POPULATE_SELECT,
        populate: [
          { path: 'table', select: 'name' },
          { path: 'waiter', select: '_id fullname' },
        ],
      })
      .sort({ sent_to_kitchen_at: 1, createdAt: 1 });

    res.json({
      success: true,
      data: {
        items: filterServiceItemsForWaiter(req.user, items),
        kitchen_staff_dispatch: false,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function listPreparingItems(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const establishment = await Establishment.findById(estId).select(
      'kds_kitchen_accept_reject kds_accept_required waiter_service_served_only service_ready_on_send'
    );
    const kitchenStaffDispatch = kitchenStaffDispatchFlag(
      establishment,
      req.user?.role?.role_key
    );
    const hideDispatch = shouldHideServiceDispatch(
      establishment,
      req.user?.role?.role_key
    );

    if (hideDispatch) {
      return res.json({
        success: true,
        data: { items: [], kitchen_staff_dispatch: kitchenStaffDispatch || hideDispatch },
      });
    }

    const items = await OrderItem.find({
      establishment: estId,
      status: 'preparing',
      sent_to_kitchen_at: { $ne: null },
    })
      .populate({
        path: 'order',
        select: ORDER_POPULATE_SELECT,
        populate: [
          { path: 'table', select: 'name' },
          { path: 'waiter', select: '_id fullname' },
        ],
      })
      .sort({ sent_to_kitchen_at: 1, createdAt: 1 });

    res.json({
      success: true,
      data: {
        items: filterServiceItemsForWaiter(req.user, items),
        kitchen_staff_dispatch: false,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { listReadyItems, listPendingItems, listPreparingItems };
