import { hasAnyPermission, hasPermission } from './permissions';
import { hasEstablishmentCapability, ESTABLISHMENT_CAP } from './establishmentCapabilities';
import { canMutateOrder } from './orderOwnership';

export function canProcessPayment(user) {
  return hasPermission(user, 'payment_process');
}

export const canProcessPayments = canProcessPayment;

export function canViewPaymentHistory(user) {
  return hasPermission(user, 'payment_history');
}

export function canDailyClose(user) {
  return hasPermission(user, 'payment_day_close');
}

export function canVoidPayment(user, capabilities) {
  if (hasPermission(user, 'payment_cancel')) return true;
  if (!hasEstablishmentCapability(capabilities, ESTABLISHMENT_CAP.WAITER_VOID_PAYMENT)) {
    return false;
  }
  return user?.role?.role_key === 'waiter' && hasPermission(user, 'payment_process');
}

export function canReprintReceipt(user) {
  return hasAnyPermission(user, ['print_receipt', 'print_reprint', 'payment_process']);
}

export function canMarkDelivered(user, order) {
  if (!hasPermission(user, 'order_mark_served')) return false;
  if (!order) return true;
  if (order.type !== 'delivery') return false;
  if (order.status === 'delivered' || order.status === 'cancelled' || order.status === 'open') {
    return false;
  }
  return true;
}

export function canCheckoutOrder(user, order) {
  if (!order) return false;
  if (!canMutateOrder(user, order, 'payment')) return false;
  if (order.payment_status === 'paid' || order.status === 'paid') return false;
  if (order.status === 'cancelled' || order.status === 'open') return false;
  if (order.payment_status === 'partial') return true;
  if (order.type === 'dine_in') return order.status === 'served';
  if (order.type === 'takeaway') return ['ready', 'served'].includes(order.status);
  if (order.type === 'delivery') return order.status === 'delivered';
  return false;
}

const CANCELLABLE_STATUSES = ['open', 'sent', 'preparing', 'ready', 'served'];

export function canCancelUnpaidOrder(user, order) {
  if (!order || order.status === 'cancelled') return false;
  if (['paid', 'partial'].includes(order.payment_status) || order.status === 'paid') return false;
  if (!CANCELLABLE_STATUSES.includes(order.status)) return false;
  return canMutateOrder(user, order, 'cancel');
}

export function canRefundAndCancelOrder(user, order, capabilities) {
  if (!order || order.status === 'cancelled') return false;
  const hasPaidState = order.status === 'paid'
    || ['paid', 'partial'].includes(order.payment_status);
  if (!hasPaidState) return false;
  if (!canMutateOrder(user, order, 'cancel')) return false;
  return canVoidPayment(user, capabilities);
}
