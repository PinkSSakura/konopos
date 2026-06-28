const { Order } = require('../models');
const MANAGER_BYPASS_ROLES = ['superadmin', 'owner', 'manager', 'submanager'];

const ORDER_SCOPE = {
  update: 'order_update_all',
  cancel: 'order_cancel_all',
  send: 'order_send_all',
  mark_served: 'order_mark_served_all',
  payment: 'payment_process_all',
  payment_cancel: 'payment_cancel_all',
  print: 'order_print_all',
  table: 'table_manage_all',
};

function refId(ref) {
  if (!ref) return null;
  return String(ref._id || ref);
}

function isOwnOrder(order, user) {
  if (!order || !user?._id) return false;
  const uid = String(user._id);
  return refId(order.waiter) === uid || refId(order.created_by) === uid;
}

function bypassesOrderOwnership(user) {
  return MANAGER_BYPASS_ROLES.includes(user?.role?.role_key);
}

function enforcesWaiterOwnership(user) {
  return user?.role?.role_key === 'waiter';
}

function resolveUpdateItemScope(body) {
  const keys = Object.keys(body || {}).filter((key) => body[key] !== undefined);
  const serviceKeys = ['status', 'rejection_reason'];
  const isServiceUpdate = keys.length > 0 && keys.every((key) => serviceKeys.includes(key));
  if (
    isServiceUpdate
    && body.status
    && ['served', 'ready', 'preparing', 'rejected'].includes(body.status)
  ) {
    return 'mark_served';
  }
  return 'update';
}

function waiterOwnershipFilter(userId) {
  const uid = String(userId);
  return {
    $or: [{ waiter: uid }, { created_by: uid }],
  };
}

async function assertWaiterOrderAccess(req, order, scope) {
  if (!order) {
    const err = new Error('Commande introuvable.');
    err.status = 404;
    throw err;
  }
  if (!enforcesWaiterOwnership(req.user)) return;
  if (bypassesOrderOwnership(req.user)) return;

  if (isOwnOrder(order, req.user)) return;

  const err = new Error('Cette commande appartient à un autre serveur — accès refusé.');
  err.status = 403;
  err.code = 'ORDER_READONLY';
  throw err;
}

async function assertWaiterTableAccess(req, table, estId) {
  if (!enforcesWaiterOwnership(req.user)) return;
  if (bypassesOrderOwnership(req.user)) return;
  if (!table?.current_order) return;

  const order = await Order.findOne({
    _id: table.current_order,
    establishment: estId,
    is_deleted: false,
  });
  if (!order) return;
  await assertWaiterOrderAccess(req, order, 'table');
}

async function assertWaiterOrdersAccess(req, orders, scope) {
  for (const order of orders) {
    await assertWaiterOrderAccess(req, order, scope);
  }
}

async function buildOrderAccessMeta(req, order) {
  const is_own = isOwnOrder(order, req.user);
  if (!enforcesWaiterOwnership(req.user) || bypassesOrderOwnership(req.user)) {
    return { is_own, can_mutate: true, readonly: false };
  }
  if (!is_own) {
    return {
      is_own: false,
      can_mutate: false,
      readonly: true,
      readonly_reason: 'Cette commande appartient à un autre serveur — accès refusé.',
    };
  }
  return { is_own: true, can_mutate: true, readonly: false };
}

function filterOrdersForWaiter(user, orders) {
  if (!enforcesWaiterOwnership(user) || bypassesOrderOwnership(user)) return orders;
  return orders.filter((order) => isOwnOrder(order, user));
}

function filterServiceItemsForWaiter(user, items) {
  if (!enforcesWaiterOwnership(user) || bypassesOrderOwnership(user)) return items;
  return items.filter((item) => item?.order && isOwnOrder(item.order, user));
}

module.exports = {
  ORDER_SCOPE,
  isOwnOrder,
  bypassesOrderOwnership,
  enforcesWaiterOwnership,
  waiterOwnershipFilter,
  resolveUpdateItemScope,
  assertWaiterOrderAccess,
  assertWaiterTableAccess,
  assertWaiterOrdersAccess,
  buildOrderAccessMeta,
  filterOrdersForWaiter,
  filterServiceItemsForWaiter,
};
