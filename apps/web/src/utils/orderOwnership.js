const MANAGER_BYPASS_ROLES = ['superadmin', 'owner', 'manager', 'submanager'];
export const ORDER_SCOPE = {
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

export function isOwnOrder(order, user) {
  if (!order || !user?._id) return false;
  const uid = String(user._id);
  return refId(order.waiter) === uid || refId(order.created_by) === uid;
}

export function isWaiterRole(user) {
  return user?.role?.role_key === 'waiter';
}

export function bypassesOrderOwnership(user) {
  return MANAGER_BYPASS_ROLES.includes(user?.role?.role_key);
}

export function canMutateOrder(user, order, scope = 'update') {
  if (!order || !user) return false;
  if (bypassesOrderOwnership(user)) return true;
  if (!isWaiterRole(user)) return true;
  return isOwnOrder(order, user);
}

export function isOrderReadOnly(user, order, scope = 'update') {
  if (!order || !user) return false;
  if (!isWaiterRole(user)) return false;
  return !canMutateOrder(user, order, scope);
}

export function orderOwnerLabel(order) {
  return order?.waiter?.fullname || '—';
}
