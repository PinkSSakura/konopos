const { Order, OrderItem, MenuItem, Extra, Table } = require('../models');
const { generateOrderNumber } = require('../utils/codes');

function calcLineTotal(unitPrice, quantity, variantAdj = 0, modifiersAdj = 0) {
  const unit = unitPrice + variantAdj + modifiersAdj;
  return Math.round(unit * quantity * 100) / 100;
}

async function recalcOrderTotals(orderId) {
  const items = await OrderItem.find({
    order: orderId,
    status: { $nin: ['cancelled', 'rejected'] },
  });
  const subtotal = items.reduce((s, i) => s + i.line_total, 0);
  const total = Math.round(subtotal * 100) / 100;
  await Order.updateOne({ _id: orderId }, { subtotal, total });
  return { subtotal, total };
}

async function buildOrderItemFromMenu(menuItemId, payload) {
  const menu = await MenuItem.findById(menuItemId).populate('category', 'extra_ids');
  if (!menu || menu.is_deleted) {
    const err = new Error('Article menu introuvable.');
    err.status = 404;
    throw err;
  }

  const { resolveMenuItemExtraIds } = require('../utils/menu-extras');
  const allowedExtraIds = new Set(resolveMenuItemExtraIds(menu));

  let variantAdj = 0;
  let variantSnap = null;
  if (payload.variant_id) {
    const v = menu.variants.id(payload.variant_id);
    if (!v) {
      const err = new Error('Variante invalide.');
      err.status = 400;
      throw err;
    }
    variantAdj = v.price_adjustment || 0;
    variantSnap = {
      variant_id: v._id,
      name: v.name,
      price_adjustment: variantAdj,
    };
  }

  let modifiersAdj = 0;
  const modifiersSnap = [];
  for (const sel of payload.modifiers || []) {
    let found = null;
    for (const g of menu.modifier_groups) {
      const m = g.modifiers.id(sel.modifier_id);
      if (m) {
        found = { group: g, modifier: m };
        break;
      }
    }
    if (!found) continue;
    modifiersAdj += found.modifier.price_adjustment || 0;
    modifiersSnap.push({
      group_name: found.group.name,
      modifier_id: found.modifier._id,
      name: found.modifier.name,
      price_adjustment: found.modifier.price_adjustment || 0,
    });
  }

  for (const sel of payload.extras || []) {
    if (!allowedExtraIds.has(String(sel.extra_id))) {
      const err = new Error('Extra non autorisé pour cet article.');
      err.status = 400;
      throw err;
    }
    const extra = await Extra.findOne({
      _id: sel.extra_id,
      establishment: menu.establishment,
      is_deleted: false,
      is_active: true,
    });
    if (!extra) continue;
    modifiersAdj += extra.price || 0;
    modifiersSnap.push({
      group_name: 'Extra',
      modifier_id: extra._id,
      name: extra.name,
      price_adjustment: extra.price || 0,
    });
  }

  const qty = payload.quantity || 1;
  const lineTotal = calcLineTotal(menu.price, qty, variantAdj, modifiersAdj);

  return {
    menu_item: menu._id,
    name: menu.name,
    product_type: menu.product_type,
    quantity: qty,
    unit_price: menu.price,
    line_total: lineTotal,
    variant: variantSnap,
    modifiers: modifiersSnap,
    notes: payload.notes,
  };
}

function applyKitchenSendToItem(item, sentAt, serviceReadyOnSend) {
  item.sent_to_kitchen_at = sentAt;
  if (serviceReadyOnSend) {
    item.status = 'ready';
    item.prepared_at = sentAt;
  }
}

async function syncOrderStatusFromItems(orderId) {
  const order = await Order.findById(orderId).select('status');
  if (order?.status === 'paid') return;

  const items = await OrderItem.find({ order: orderId, status: { $nin: ['cancelled', 'rejected'] } });
  if (!items.length) return;

  const statuses = items.map((i) => i.status);
  const hasSentToKitchen = items.some((i) => i.sent_to_kitchen_at);
  let orderStatus = 'open';
  if (statuses.every((s) => s === 'served')) orderStatus = 'served';
  else if (statuses.every((s) => s === 'ready' || s === 'served')) orderStatus = 'ready';
  else if (statuses.some((s) => ['preparing', 'ready', 'served'].includes(s))) orderStatus = 'preparing';
  else if (hasSentToKitchen || statuses.some((s) => s !== 'new')) orderStatus = 'sent';

  await Order.updateOne({ _id: orderId }, { status: orderStatus });
}

const ACTIVE_TABLE_ORDER_STATUSES = ['open', 'sent', 'preparing', 'ready', 'served'];

async function syncTableFromOrders(tableId, establishmentId) {
  const activeOrders = await Order.find({
    table: tableId,
    establishment: establishmentId,
    is_deleted: false,
    status: { $in: ACTIVE_TABLE_ORDER_STATUSES },
  }).sort({ createdAt: -1 });

  if (!activeOrders.length) {
    await Table.updateOne(
      { _id: tableId, establishment: establishmentId },
      { current_order: null, status: 'libre' }
    );
    return;
  }

  await Table.updateOne(
    { _id: tableId, establishment: establishmentId },
    { current_order: activeOrders[0]._id, status: 'occupee' }
  );
}

module.exports = {
  calcLineTotal,
  recalcOrderTotals,
  generateOrderNumber,
  buildOrderItemFromMenu,
  applyKitchenSendToItem,
  syncOrderStatusFromItems,
  syncTableFromOrders,
};
