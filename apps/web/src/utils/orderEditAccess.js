export const EDITABLE_ORDER_STATUSES = ['open', 'sent', 'preparing', 'ready', 'served'];

export function canEditOrderInPos(order) {
  if (!order) return false;
  if (!EDITABLE_ORDER_STATUSES.includes(order.status)) return false;
  if (['paid', 'partial'].includes(order.payment_status)) return false;
  return true;
}

export function isSentOrderItem(item) {
  if (!item) return false;
  return Boolean(item.sent_to_kitchen_at) && !['cancelled', 'rejected'].includes(item.status);
}

export function canVoidOrderItem(order, item) {
  return canEditOrderInPos(order) && isSentOrderItem(item);
}

export function canEditUnsentItem(order, item) {
  return canEditOrderInPos(order) && item.status === 'new' && !item.sent_to_kitchen_at;
}
