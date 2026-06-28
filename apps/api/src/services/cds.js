const { Order, OrderItem, Establishment } = require('../models');

const STATUS_LABELS = {
  draft: 'Commande en cours',
  pending: 'En attente',
  preparing: 'En préparation',
  ready: 'Prêt à servir',
};

const SECTION_ORDER = ['draft', 'pending', 'preparing', 'ready'];

function refId(value) {
  if (value == null) return null;
  return String(value._id ?? value);
}

function belongsToEstablishment(doc, establishmentId) {
  const estKey = refId(establishmentId);
  if (!estKey) return false;
  return refId(doc?.establishment) === estKey;
}

function isActiveItem(item) {
  return item && !item.is_deleted && !['cancelled', 'rejected'].includes(item.status);
}

function formatDailyCode(code) {
  if (code == null || code === '') return null;
  return String(code).padStart(4, '0');
}

function orderHasBeenSent(order, items) {
  if (order?.sent_to_kitchen_at) return true;
  return items.some((item) => item.sent_to_kitchen_at);
}

function computeOrderStatus(order, items) {
  const active = items.filter(isActiveItem);
  if (!active.length) return null;
  if (active.every((i) => i.status === 'served')) return null;
  if (!orderHasBeenSent(order, active)) return 'draft';
  if (active.some((i) => i.status === 'new')) return 'pending';
  if (active.some((i) => i.status === 'preparing')) return 'preparing';
  return 'ready';
}

function serializeCdsOrder(order, status) {
  return {
    id: refId(order._id),
    order_number: order.order_number,
    daily_code: formatDailyCode(order.daily_code),
    total: order.total,
    type: order.type,
    status,
    status_label: STATUS_LABELS[status] || status,
    pay_message: status === 'ready'
      && order.type === 'takeaway'
      && order.payment_status !== 'paid',
  };
}

function sortOrders(orders) {
  return orders.sort((a, b) => {
    const codeA = a.daily_code || String(a.order_number || '');
    const codeB = b.daily_code || String(b.order_number || '');
    return codeA.localeCompare(codeB);
  });
}

async function getSingleEstablishment() {
  const complete = await Establishment.findOne({
    is_deleted: false,
    is_setup_complete: true,
  });
  if (complete) return complete;
  return Establishment.findOne({ is_deleted: false });
}

async function buildCdsBoard(establishmentId) {
  const estKey = refId(establishmentId);

  const orders = (await Order.find({})).filter(
    (order) => !order.is_deleted
      && !['cancelled', 'paid'].includes(order.status)
      && belongsToEstablishment(order, estKey),
  );

  const itemsByOrder = new Map();
  for (const item of await OrderItem.find({})) {
    if (item.is_deleted || !belongsToEstablishment(item, estKey)) continue;
    const orderId = refId(item.order);
    if (!orderId) continue;
    if (!itemsByOrder.has(orderId)) itemsByOrder.set(orderId, []);
    itemsByOrder.get(orderId).push(item);
  }

  const byStatus = {
    draft: [],
    pending: [],
    preparing: [],
    ready: [],
  };

  for (const order of orders) {
    const items = itemsByOrder.get(refId(order._id)) || [];
    const status = computeOrderStatus(order, items);
    if (!status) continue;
    byStatus[status].push(serializeCdsOrder(order, status));
  }

  for (const key of SECTION_ORDER) {
    sortOrders(byStatus[key]);
  }

  const sections = SECTION_ORDER
    .map((key) => ({
      key,
      title: STATUS_LABELS[key],
      orders: byStatus[key],
    }))
    .filter((section) => section.orders.length > 0);

  return { sections, orders: SECTION_ORDER.flatMap((key) => byStatus[key]) };
}

async function isCdsUnlocked(establishmentId) {
  const { isCdsUnlockedForEstablishment } = require('./quick-waiter-session');
  return isCdsUnlockedForEstablishment(establishmentId);
}

module.exports = {
  buildCdsBoard,
  getSingleEstablishment,
  isCdsUnlocked,
  formatDailyCode,
  STATUS_LABELS,
};
