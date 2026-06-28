const { Order, OrderItem, Table, Establishment, User, Payment, Customer } = require('../models');
const { query, kds, orderownership, serializers, paymentaccess } = require('../utils')();
const { getEstablishmentId, baseQuery } = query;
const {
  canMarkServed,
  canKitchenDispatch,
  isKitchenAcceptRejectEnabled,
  canOverrideKitchenStaffDispatch,
  getKitchenProductType,
} = kds;
const {
  assertWaiterOrderAccess,
  resolveUpdateItemScope,
  buildOrderAccessMeta,
  isOwnOrder,
  enforcesWaiterOwnership,
  bypassesOrderOwnership,
  waiterOwnershipFilter,
  filterOrdersForWaiter,
} = orderownership;
const {
  mapList,
  serializeOrderList,
  serializeOrderDetail,
  serializeOrderItem,
  serializeOrderDetailPayload,
} = serializers;
const { canVoidPayment } = paymentaccess;
const { order: orderService, audit, notify, print, dailycode, push, auth } = require('../services')();
const { finalizeDirectPinLogout } = auth;
const {
  generateOrderNumber,
  buildOrderItemFromMenu,
  applyKitchenSendToItem,
  recalcOrderTotals,
  syncOrderStatusFromItems,
  syncTableFromOrders,
  calcLineTotal,
} = orderService;
const { logStaffActivity } = audit;
const { emitKdsChanged, emitOrderChanged, emitTablesChanged, emitServiceChanged, emitServiceItemServed } = notify;
const { notifyItemReady } = push;
const { printOnSend, printCaisseOnSend, printCaisseVoidReceipt } = print;
const { assignDailyCodeIfNeeded, printDailyCodeSlip } = dailycode;

const MANAGER_CANCEL_PIN_ROLES = ['submanager', 'manager', 'owner', 'superadmin'];
const EDITABLE_ORDER_STATUSES = ['open', 'sent', 'preparing', 'ready', 'served'];

function handleAccessError(res, err, next) {
  if (err.status) {
    return res.status(err.status).json({ success: false, message: err.message, code: err.code });
  }
  return next(err);
}

function isSentOrderItem(item) {
  return Boolean(item?.sent_to_kitchen_at) && !['cancelled', 'rejected'].includes(item?.status);
}

function assertOrderAllowsEditing(order) {
  if (!order) return 'Commande introuvable.';
  if (['cancelled', 'delivered', 'paid'].includes(order.status)) {
    return 'Cette commande ne peut plus être modifiée.';
  }
  if (['paid', 'partial'].includes(order.payment_status)) {
    return 'Paiement en cours ou effectué. Annulez le paiement avant de modifier la commande.';
  }
  if (!EDITABLE_ORDER_STATUSES.includes(order.status)) {
    return 'Cette commande ne peut plus être modifiée.';
  }
  return null;
}

async function resolveCancelApprover(req, estId) {
  const establishment = await Establishment.findById(estId).select('waiter_can_cancel_order');
  const requesterRole = req.user?.role?.role_key;
  if (!['waiter', ...MANAGER_CANCEL_PIN_ROLES].includes(requesterRole)) {
    return {
      error: { status: 403, message: 'Vous n\'êtes pas autorisé à modifier cette commande.' },
    };
  }

  let approver = req.user;
  if (requesterRole === 'waiter' && !establishment?.waiter_can_cancel_order) {
    const approverPin = (req.body?.approver_pin || '').trim();
    if (!/^\d{6}$/.test(approverPin)) {
      return {
        error: { status: 400, message: 'PIN de validation manager requis (6 chiffres).' },
      };
    }
    approver = await User.findOne({
      establishment: estId,
      pin: approverPin,
      is_deleted: false,
      is_active: true,
      status: 'actif',
    }).populate('role');
    if (!approver || !MANAGER_CANCEL_PIN_ROLES.includes(approver.role?.role_key)) {
      return {
        error: { status: 403, message: 'PIN invalide ou rôle non autorisé.' },
      };
    }
  }

  return { approver };
}

function assertOrderAllowsItemCorrection(order) {
  return assertOrderAllowsEditing(order);
}

async function reverseCustomerBalance(customerId, method, amount) {
  if (!customerId) return;
  const customer = await Customer.findById(customerId);
  if (!customer) return;
  if (method === 'credit') {
    customer.balance = Math.round((customer.balance - amount) * 100) / 100;
  } else if (method === 'debit') {
    customer.balance = Math.round((customer.balance + amount) * 100) / 100;
  }
  await customer.save();
}

function approverDisplayName(user) {
  if (user?.role?.role_key === 'superadmin') return 'SYSTEMUI';
  return user?.fullname || user?.username || 'Utilisateur';
}

async function voidActivePaymentsAndCancelItems(order, estId, approver) {
  const activePayments = await Payment.find({
    order: order._id,
    establishment: estId,
    is_void: false,
  });

  for (const payment of activePayments) {
    payment.is_void = true;
    payment.voided_at = new Date();
    payment.voided_by = approver._id;
    payment.void_reason = 'Annulation commande';
    await payment.save();
    await reverseCustomerBalance(payment.customer, payment.method, payment.amount);
  }

  const now = new Date();
  const items = await OrderItem.find({ order: order._id, status: { $nin: ['cancelled', 'rejected'] } });
  for (const item of items) {
    item.status = 'cancelled';
    item.cancelled_at = now;
    item.cancelled_by = approver._id;
    item.cancellation_reason = 'Annulation commande';
    await item.save();
  }

  order.status = 'cancelled';
  order.payment_status = 'unpaid';
  order.amount_paid = 0;
  order.paid_at = undefined;
  order.receipt_number = undefined;
  await order.save();

  if (order.table) {
    await syncTableFromOrders(order.table, estId);
  }

  return items;
}

async function listOrders(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const filter = { establishment: estId, is_deleted: false };
    const roleKey = req.user?.role?.role_key;
    const kitchenProductType = getKitchenProductType(roleKey);
    if (req.query.status) {
      filter.status = req.query.status;
    } else if (req.query.include_cancelled === '1') {
      filter.status = { $ne: 'paid' };
    } else {
      filter.status = { $nin: ['cancelled', 'paid'] };
    }
    if (req.query.type) filter.type = req.query.type;
    if (req.query.table) filter.table = req.query.table;
    if (req.query.payment_status) filter.payment_status = req.query.payment_status;

    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) {
        const to = new Date(req.query.to);
        to.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = to;
      }
    }

    const q = req.query.q?.trim();
    if (q) {
      const or = [{ order_number: { $regex: q, $options: 'i' } }];
      const codeDigits = q.replace(/\D/g, '');
      if (codeDigits) {
        or.push({ daily_code: { $regex: codeDigits, $options: 'i' } });
        if (codeDigits.length <= 6) {
          or.push({ daily_code: codeDigits.padStart(6, '0') });
        }
      }
      const waiters = await User.find({
        establishment: estId,
        is_deleted: false,
        fullname: { $regex: q, $options: 'i' },
      }).select('_id');
      if (waiters.length) or.push({ waiter: { $in: waiters.map((w) => w._id) } });
      const tables = await Table.find({
        establishment: estId,
        name: { $regex: q, $options: 'i' },
      }).select('_id');
      if (tables.length) or.push({ table: { $in: tables.map((t) => t._id) } });
      filter.$or = or;
    }

    if (enforcesWaiterOwnership(req.user) && !bypassesOrderOwnership(req.user)) {
      const ownFilter = waiterOwnershipFilter(req.user._id);
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, ownFilter];
        delete filter.$or;
      } else {
        Object.assign(filter, ownFilter);
      }
    }

    if (kitchenProductType) {
      const orderIds = await OrderItem.distinct('order', {
        establishment: estId,
        product_type: kitchenProductType,
        status: { $nin: ['cancelled'] },
      });
      filter._id = { $in: orderIds };
    }

    let data = await Order.find(filter)
      .populate('table', 'name')
      .populate('waiter', 'fullname')
      .sort({ createdAt: -1 })
      .limit(Number(req.query.limit) || 200);

    data = filterOrdersForWaiter(req.user, data);

    res.json({
      success: true,
      data: mapList(data, (order) => ({
        ...serializeOrderList(order),
        is_own: isOwnOrder(order, req.user),
      })),
    });
  } catch (err) {
    next(err);
  }
}

async function getOrder(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const order = await Order.findOne({ _id: req.params.id, establishment: estId, is_deleted: false })
      .populate('table', 'name room')
      .populate('waiter', 'fullname');
    if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable.' });

    if (enforcesWaiterOwnership(req.user) && !bypassesOrderOwnership(req.user) && !isOwnOrder(order, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Cette commande appartient à un autre serveur — accès refusé.',
        code: 'ORDER_READONLY',
      });
    }

    const kitchenProductType = getKitchenProductType(req.user?.role?.role_key);
    const itemFilter = { order: order._id };
    if (kitchenProductType) itemFilter.product_type = kitchenProductType;

    const items = await OrderItem.find(itemFilter).sort({ createdAt: 1 });
    const access = await buildOrderAccessMeta(req, order);
    res.json({
      success: true,
      data: {
        ...serializeOrderDetailPayload(order, items, {
          product_type_filter: kitchenProductType || null,
        }),
        access,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function createOrder(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const establishment = await Establishment.findById(estId);

    if (req.body.table && establishment?.tables_enabled === false) {
      return res.status(400).json({
        success: false,
        message: 'Le module tables est désactivé — impossible d\'assigner une table.',
      });
    }

    const orderNumber = await generateOrderNumber(estId);

    const order = await Order.create({
      establishment: estId,
      order_number: orderNumber,
      type: req.body.type || 'dine_in',
      table: req.body.table,
      room: req.body.room,
      waiter: req.user._id,
      notes: req.body.notes,
      delivery_address: req.body.delivery_address,
      created_by: req.user._id,
    });

    const { findActiveShift } = require('../services/shift');
    const activeShift = await findActiveShift(req.user._id, estId);
    if (activeShift) {
      order.shift = activeShift._id;
      await order.save();
    }

    if (req.body.table) {
      const table = await Table.findOne({ _id: req.body.table, establishment: estId, is_deleted: false });
      if (!table) {
        return res.status(404).json({ success: false, message: 'Table introuvable.' });
      }
      if (table.current_order) {
        return res.status(400).json({
          success: false,
          message: 'Cette table est déjà occupée.',
        });
      }
      if (table?.room && !order.room) {
        order.room = table.room;
        await order.save();
      }
      await Table.updateOne(
        { _id: req.body.table, establishment: estId },
        { current_order: order._id, status: 'occupee' }
      );
    }

    await logStaffActivity({
      establishment: estId,
      user: req.user,
      action: 'create',
      module: 'orders',
      resource: 'order',
      resource_id: order._id,
      description: `Commande ${order.order_number} créée`,
      req,
    });

    if (req.body.table) {
      emitTablesChanged(estId, order.room);
    }
    emitOrderChanged(estId, order._id);

    res.status(201).json({ success: true, data: serializeOrderList(order) });
  } catch (err) {
    next(err);
  }
}

async function updateOrder(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const order = await Order.findOne({ _id: req.params.id, establishment: estId, is_deleted: false });
    if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable.' });
    try {
      await assertWaiterOrderAccess(req, order, 'update');
    } catch (err) {
      return handleAccessError(res, err, next);
    }

    order.type = req.body.type ?? order.type;
    order.notes = req.body.notes ?? order.notes;
    order.delivery_address = req.body.delivery_address ?? order.delivery_address;
    order.modified_by = req.user._id;
    await order.save();

    res.json({ success: true, data: serializeOrderList(order) });
  } catch (err) {
    next(err);
  }
}

async function cancelOrder(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const authResult = await resolveCancelApprover(req, estId);
    if (authResult.error) {
      return res.status(authResult.error.status).json({
        success: false,
        message: authResult.error.message,
      });
    }
    const { approver } = authResult;

    const order = await Order.findOne({ _id: req.params.id, establishment: estId, is_deleted: false });
    if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable.' });
    try {
      await assertWaiterOrderAccess(req, order, 'cancel');
    } catch (err) {
      return handleAccessError(res, err, next);
    }

    if (['cancelled', 'delivered', 'paid'].includes(order.status)) {
      return res.status(400).json({ success: false, message: 'Cette commande ne peut plus être annulée.' });
    }

    order.modified_by = req.user._id;
    await voidActivePaymentsAndCancelItems(order, estId, approver);

    if (order.table) {
      emitTablesChanged(estId, order.room);
    }
    emitOrderChanged(estId, order._id);

    try {
      await printCaisseVoidReceipt(estId, order._id, { reason: 'Commande annulee — impayee' });
    } catch (printErr) {
      console.error('[print] VOID ticket on cancel failed:', printErr.message);
    }

    await logStaffActivity({
      establishment: estId,
      user: req.user,
      action: 'cancel',
      module: 'orders',
      resource: 'order',
      resource_id: order._id,
      description: `Commande ${order.order_number} annulée — validé par ${approverDisplayName(approver)}`,
      req,
    });

    res.json({
      success: true,
      message: 'Commande annulée.',
    });
  } catch (err) {
    next(err);
  }
}

async function refundAndCancelOrder(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const authResult = await resolveCancelApprover(req, estId);
    if (authResult.error) {
      return res.status(authResult.error.status).json({
        success: false,
        message: authResult.error.message,
      });
    }
    const { approver } = authResult;

    const establishment = await Establishment.findById(estId).select('waiter_can_void_payment');
    if (!(await canVoidPayment(req.user, establishment))) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'êtes pas autorisé à annuler un paiement.',
      });
    }

    const order = await Order.findOne({ _id: req.params.id, establishment: estId, is_deleted: false });
    if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable.' });
    try {
      await assertWaiterOrderAccess(req, order, 'cancel');
    } catch (err) {
      return handleAccessError(res, err, next);
    }

    if (order.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Commande déjà annulée.' });
    }

    const hasPaidState = order.status === 'paid'
      || ['paid', 'partial'].includes(order.payment_status);
    if (!hasPaidState) {
      return res.status(400).json({
        success: false,
        message: 'Cette commande n\'est pas payée. Utilisez « Annuler la commande ».',
      });
    }

    order.modified_by = req.user._id;
    await voidActivePaymentsAndCancelItems(order, estId, approver);

    if (order.table) {
      emitTablesChanged(estId, order.room);
    }
    emitOrderChanged(estId, order._id);

    try {
      await printCaisseVoidReceipt(estId, order._id, { reason: 'Remboursement — commande annulee' });
    } catch (printErr) {
      console.error('[print] VOID ticket on refund-cancel failed:', printErr.message);
    }

    await logStaffActivity({
      establishment: estId,
      user: req.user,
      action: 'cancel',
      module: 'orders',
      resource: 'order',
      resource_id: order._id,
      description: `Remboursement et annulation — ${order.order_number} — validé par ${approverDisplayName(approver)}`,
      req,
    });

    res.json({
      success: true,
      message: 'Paiement annulé et commande annulée.',
    });
  } catch (err) {
    next(err);
  }
}

async function addItem(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const order = await Order.findOne({ _id: req.params.id, establishment: estId, is_deleted: false });
    if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable.' });
    try {
      await assertWaiterOrderAccess(req, order, 'update');
    } catch (err) {
      return handleAccessError(res, err, next);
    }

    const blockReason = assertOrderAllowsEditing(order);
    if (blockReason) {
      return res.status(400).json({ success: false, message: blockReason });
    }

    if (!req.body.menu_item_id) {
      return res.status(400).json({ success: false, message: 'Article menu requis.' });
    }

    const built = await buildOrderItemFromMenu(req.body.menu_item_id, req.body);
    const item = await OrderItem.create({
      ...built,
      order: order._id,
      establishment: estId,
      status: 'new',
    });

    order.modified_by = req.user._id;
    await order.save();
    await recalcOrderTotals(order._id);
    await syncOrderStatusFromItems(order._id);
    emitOrderChanged(estId, order._id);

    res.status(201).json({ success: true, data: serializeOrderItem(item) });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    return next(err);
  }
}

async function updateItem(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const item = await OrderItem.findOne({
      _id: req.params.itemId,
      order: req.params.id,
      establishment: estId,
    });
    if (!item) return res.status(404).json({ success: false, message: 'Article introuvable.' });

    const order = await Order.findOne({ _id: req.params.id, establishment: estId, is_deleted: false });
    if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable.' });

    try {
      await assertWaiterOrderAccess(req, order, resolveUpdateItemScope(req.body));
    } catch (err) {
      return handleAccessError(res, err, next);
    }

    const statusChanged = Boolean(req.body.status);

    if (statusChanged) {
      const establishment = await Establishment.findById(estId);
      const roleKey = req.user?.role?.role_key;
      const { status, rejection_reason } = req.body;

      if (!item.sent_to_kitchen_at) {
        return res.status(400).json({
          success: false,
          message: 'L\'article n\'a pas encore été envoyé en cuisine / bar.',
        });
      }

      const kitchenStaffDispatch = isKitchenAcceptRejectEnabled(establishment);

      if (status === 'served') {
        if (!canMarkServed(roleKey)) {
          return res.status(403).json({
            success: false,
            message: 'Vous n\'êtes pas autorisé à marquer un article servi.',
          });
        }
        if (item.status !== 'ready') {
          return res.status(400).json({
            success: false,
            message: 'L\'article doit être prêt.',
          });
        }
        item.status = 'served';
        item.served_at = new Date();
      } else if (['preparing', 'ready', 'rejected'].includes(status)) {
        if (!canKitchenDispatch(roleKey)) {
          return res.status(403).json({
            success: false,
            message: 'Validation réservée au serveur (écran Service).',
          });
        }
        if (establishment?.waiter_service_served_only && roleKey === 'waiter') {
          return res.status(403).json({
            success: false,
            message: 'Validation réservée au manager ou au personnel cuisine.',
          });
        }
        if (kitchenStaffDispatch && !canOverrideKitchenStaffDispatch(roleKey)) {
          return res.status(403).json({
            success: false,
            message: 'Validation réservée au personnel cuisine (écran KDS).',
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
        }
      } else {
        return res.status(400).json({ success: false, message: 'Statut invalide.' });
      }

      await item.save();
      await syncOrderStatusFromItems(order._id);

      emitKdsChanged(estId, item.product_type);
      emitOrderChanged(estId, order._id);
      if (['ready', 'served'].includes(status)) emitServiceChanged(estId);
      if (status === 'ready') {
        notifyItemReady(estId, order._id, item, req.user._id).catch(() => {});
      }
      if (status === 'served') {
        const ownerId = order.created_by?._id || order.created_by;
        if (ownerId) {
          emitServiceItemServed(String(ownerId), {
            itemId: String(item._id),
            orderId: String(order._id),
          });
        }
      }

      return res.json({ success: true, data: serializeOrderItem(item) });
    }

    const blockReason = assertOrderAllowsEditing(order);
    if (blockReason) {
      return res.status(400).json({ success: false, message: blockReason });
    }

    if (item.status !== 'new' || item.sent_to_kitchen_at) {
      return res.status(400).json({
        success: false,
        message: 'Cet article ne peut plus être modifié. Utilisez retirer ou remplacer.',
      });
    }

    if (req.body.quantity !== undefined) {
      const qty = Number(req.body.quantity);
      if (!Number.isFinite(qty) || qty < 1) {
        return res.status(400).json({ success: false, message: 'Quantité invalide.' });
      }
      const variantAdj = item.variant?.price_adjustment || 0;
      const modifiersAdj = (item.modifiers || []).reduce(
        (sum, modifier) => sum + (modifier.price_adjustment || 0),
        0
      );
      item.quantity = qty;
      item.line_total = calcLineTotal(item.unit_price, qty, variantAdj, modifiersAdj);
    }

    if (req.body.notes !== undefined) {
      item.notes = req.body.notes;
    }

    await item.save();
    await recalcOrderTotals(order._id);
    emitOrderChanged(estId, order._id);

    res.json({ success: true, data: serializeOrderItem(item) });
  } catch (err) {
    next(err);
  }
}

async function removeItem(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const item = await OrderItem.findOne({
      _id: req.params.itemId,
      order: req.params.id,
      establishment: estId,
    });
    if (!item) return res.status(404).json({ success: false, message: 'Article introuvable.' });

    const order = await Order.findOne({ _id: req.params.id, establishment: estId, is_deleted: false });
    if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable.' });
    try {
      await assertWaiterOrderAccess(req, order, 'update');
    } catch (err) {
      return handleAccessError(res, err, next);
    }

    const blockReason = assertOrderAllowsEditing(order);
    if (blockReason) {
      return res.status(400).json({ success: false, message: blockReason });
    }

    if (item.status !== 'new' || item.sent_to_kitchen_at) {
      return res.status(400).json({
        success: false,
        message: 'Seuls les articles non envoyés peuvent être supprimés.',
      });
    }

    await OrderItem.deleteOne({ _id: item._id });
    order.modified_by = req.user._id;
    await order.save();
    await recalcOrderTotals(order._id);
    await syncOrderStatusFromItems(order._id);
    emitOrderChanged(estId, order._id);

    res.json({ success: true, message: 'Article supprimé.' });
  } catch (err) {
    next(err);
  }
}

async function voidServedItem(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const authResult = await resolveCancelApprover(req, estId);
    if (authResult.error) {
      return res.status(authResult.error.status).json({
        success: false,
        message: authResult.error.message,
      });
    }
    const { approver } = authResult;

    const item = await OrderItem.findOne({
      _id: req.params.itemId,
      order: req.params.id,
      establishment: estId,
    });
    if (!item) return res.status(404).json({ success: false, message: 'Article introuvable.' });

    const order = await Order.findOne({ _id: req.params.id, establishment: estId, is_deleted: false });
    if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable.' });
    try {
      await assertWaiterOrderAccess(req, order, 'update');
    } catch (err) {
      return handleAccessError(res, err, next);
    }

    const blockReason = assertOrderAllowsItemCorrection(order);
    if (blockReason) {
      return res.status(400).json({ success: false, message: blockReason });
    }

    if (!isSentOrderItem(item)) {
      return res.status(400).json({
        success: false,
        message: 'Seuls les articles envoyés en cuisine / bar peuvent être retirés.',
      });
    }

    const reason = (req.body.reason || '').trim();
    if (!reason) {
      return res.status(400).json({ success: false, message: 'Motif requis.' });
    }

    const now = new Date();
    item.status = 'cancelled';
    item.cancellation_reason = reason;
    item.cancelled_at = now;
    item.cancelled_by = approver._id;
    await item.save();

    order.modified_by = req.user._id;
    await order.save();
    await recalcOrderTotals(order._id);
    await syncOrderStatusFromItems(order._id);

    emitKdsChanged(estId, item.product_type);
    emitOrderChanged(estId, order._id);

    await logStaffActivity({
      establishment: estId,
      user: req.user,
      action: 'void_item',
      module: 'orders',
      resource: 'order_item',
      resource_id: item._id,
      description: `Article retiré (${item.name}) — ${reason}`,
      req,
    });

    res.json({
      success: true,
      message: 'Article retiré.',
      data: { item: serializeOrderItem(item) },
    });
  } catch (err) {
    next(err);
  }
}

async function replaceServedItem(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const authResult = await resolveCancelApprover(req, estId);
    if (authResult.error) {
      return res.status(authResult.error.status).json({
        success: false,
        message: authResult.error.message,
      });
    }
    const { approver } = authResult;

    const item = await OrderItem.findOne({
      _id: req.params.itemId,
      order: req.params.id,
      establishment: estId,
    });
    if (!item) return res.status(404).json({ success: false, message: 'Article introuvable.' });

    const order = await Order.findOne({ _id: req.params.id, establishment: estId, is_deleted: false });
    if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable.' });
    try {
      await assertWaiterOrderAccess(req, order, 'update');
    } catch (err) {
      return handleAccessError(res, err, next);
    }

    const blockReason = assertOrderAllowsItemCorrection(order);
    if (blockReason) {
      return res.status(400).json({ success: false, message: blockReason });
    }

    if (!isSentOrderItem(item)) {
      return res.status(400).json({
        success: false,
        message: 'Seuls les articles envoyés en cuisine / bar peuvent être remplacés.',
      });
    }

    const reason = (req.body.reason || '').trim();
    if (!reason) {
      return res.status(400).json({ success: false, message: 'Motif requis.' });
    }
    if (!req.body.menu_item_id) {
      return res.status(400).json({ success: false, message: 'Nouvel article menu requis.' });
    }

    const built = await buildOrderItemFromMenu(req.body.menu_item_id, req.body);
    const now = new Date();
    const sendToKitchen = Boolean(req.body.send_to_kitchen);
    let serviceReadyOnSend = false;
    if (sendToKitchen) {
      const establishment = await Establishment.findById(estId).select('service_ready_on_send');
      serviceReadyOnSend = Boolean(establishment?.service_ready_on_send);
    }

    const replacementPayload = {
      ...built,
      order: order._id,
      establishment: estId,
      status: 'new',
      replaces: item._id,
    };
    if (sendToKitchen) {
      applyKitchenSendToItem(replacementPayload, now, serviceReadyOnSend);
    }

    const replacement = await OrderItem.create(replacementPayload);

    item.status = 'cancelled';
    item.cancellation_reason = reason;
    item.cancelled_at = now;
    item.cancelled_by = approver._id;
    item.replaced_by = replacement._id;
    await item.save();

    order.modified_by = req.user._id;
    await order.save();
    await recalcOrderTotals(order._id);
    await syncOrderStatusFromItems(order._id);

    emitKdsChanged(estId, item.product_type);
    emitKdsChanged(estId, replacement.product_type);
    emitOrderChanged(estId, order._id);
    if (sendToKitchen && serviceReadyOnSend) {
      emitServiceChanged(estId);
      notifyItemReady(estId, order._id, replacement, req.user._id).catch(() => {});
    }

    await logStaffActivity({
      establishment: estId,
      user: req.user,
      action: 'replace_item',
      module: 'orders',
      resource: 'order_item',
      resource_id: replacement._id,
      description: `Remplacement ${item.name} → ${replacement.name}`,
      req,
    });

    res.json({
      success: true,
      message: 'Article remplacé.',
      data: {
        item: serializeOrderItem(replacement),
        replaced_item: serializeOrderItem(item),
      },
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    return next(err);
  }
}

async function markDelivered(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const order = await Order.findOne({ _id: req.params.id, establishment: estId, is_deleted: false });
    if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable.' });
    try {
      await assertWaiterOrderAccess(req, order, 'mark_served');
    } catch (err) {
      return handleAccessError(res, err, next);
    }

    if (order.type !== 'delivery') {
      return res.status(400).json({
        success: false,
        message: 'Action réservée aux commandes livraison.',
      });
    }

    if (['cancelled', 'delivered', 'paid'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cette commande ne peut plus être marquée livrée.',
      });
    }

    const items = await OrderItem.find({ order: order._id });
    const billable = items.filter((i) => !['cancelled', 'rejected'].includes(i.status));
    if (!billable.length) {
      return res.status(400).json({
        success: false,
        message: 'Aucun article actif sur cette commande.',
      });
    }
    if (!billable.every((i) => ['ready', 'served'].includes(i.status))) {
      return res.status(400).json({
        success: false,
        message: 'Tous les articles doivent être prêts ou servis.',
      });
    }

    order.status = 'delivered';
    order.delivered_at = new Date();
    order.modified_by = req.user._id;
    await order.save();
    emitOrderChanged(estId, order._id);

    await logStaffActivity({
      establishment: estId,
      user: req.user,
      action: 'mark_delivered',
      module: 'orders',
      resource: 'order',
      resource_id: order._id,
      description: `Livraison — commande ${order.order_number}`,
      req,
    });

    res.json({
      success: true,
      message: 'Commande marquée comme livrée.',
      data: serializeOrderList(order),
    });
  } catch (err) {
    next(err);
  }
}

async function sendToKitchen(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const establishment = await Establishment.findById(estId).select(
      'auto_print_on_send printers caisse_printer tables_enabled daily_order_counter daily_order_session name service_ready_on_send'
    );
    const order = await Order.findOne({ _id: req.params.id, establishment: estId, is_deleted: false });
    if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable.' });
    try {
      await assertWaiterOrderAccess(req, order, 'send');
    } catch (err) {
      return handleAccessError(res, err, next);
    }

    const blockReason = assertOrderAllowsEditing(order);
    if (blockReason) {
      return res.status(400).json({ success: false, message: blockReason });
    }

    const now = new Date();
    const items = await OrderItem.find({
      order: order._id,
      status: 'new',
      $or: [{ sent_to_kitchen_at: null }, { sent_to_kitchen_at: { $exists: false } }],
    });

    if (!items.length) {
      return res.status(400).json({
        success: false,
        message: 'Aucun article en attente d\'envoi en cuisine / bar.',
      });
    }

    const serviceReadyOnSend = Boolean(establishment?.service_ready_on_send);

    for (const item of items) {
      applyKitchenSendToItem(item, now, serviceReadyOnSend);
      await item.save();
    }

    if (!order.sent_to_kitchen_at) {
      order.sent_to_kitchen_at = now;
    }
    order.modified_by = req.user._id;

    const { code: dailyCode, isNew: dailyCodeIsNew } = await assignDailyCodeIfNeeded(order, establishment);
    await order.save();
    await syncOrderStatusFromItems(order._id);

    const productTypes = [...new Set(items.map((i) => i.product_type))];
    productTypes.forEach((type) => emitKdsChanged(estId, type));
    emitOrderChanged(estId, order._id);
    if (serviceReadyOnSend) {
      emitServiceChanged(estId);
      for (const item of items) {
        notifyItemReady(estId, order._id, item, req.user._id).catch(() => {});
      }
    }

    const sentItemIds = items.map((i) => i._id);
    printOnSend(estId, order._id, sentItemIds).catch((err) => {
      console.error('Auto-impression cuisine/bar:', err.message);
    });
    printCaisseOnSend(estId, order._id, sentItemIds).catch((err) => {
      console.error('Auto-impression caisse a l\'envoi:', err.message);
    });
    if (dailyCodeIsNew) {
      printDailyCodeSlip(estId, order._id, dailyCode).catch((err) => {
        console.error('Impression code du jour:', err.message);
      });
    }

    await logStaffActivity({
      establishment: estId,
      user: req.user,
      action: 'send_kitchen',
      module: 'orders',
      resource: 'order',
      resource_id: order._id,
      description: `Envoi cuisine/bar — ${order.order_number}${dailyCode ? ` — code ${dailyCode}` : ''} (${items.length} article(s))`,
      req,
    });

    res.json({
      success: true,
      message: 'Envoyé en cuisine / bar.',
      data: {
        sent_count: items.length,
        daily_code: dailyCode,
        daily_code_printed: dailyCodeIsNew,
        end_quick_waiter_session: await finalizeDirectPinLogout(req, res, 'order_sent'),
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listOrders,
  getOrder,
  createOrder,
  updateOrder,
  cancelOrder,
  refundAndCancelOrder,
  addItem,
  updateItem,
  removeItem,
  voidServedItem,
  replaceServedItem,
  markDelivered,
  sendToKitchen,
};
