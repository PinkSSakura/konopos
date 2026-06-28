export const ORDER_STATUS_LABELS = {
  open: 'Ouverte',
  sent: 'Envoyée',
  preparing: 'En préparation',
  ready: 'Prête',
  served: 'Servie',
  delivered: 'Livrée',
  paid: 'Payée',
  cancelled: 'Annulée',
};

export const ORDER_ITEM_STATUS_LABELS = {
  open: 'Ouverte',
  sent: 'Envoyée',
  preparing: 'En préparation',
  ready: 'Prête',
  served: 'Servie',
  cancelled: 'Annulée',
  rejected: 'Rejetée',
};

export const ACTIVE_ORDER_STATUSES = [
  'open',
  'sent',
  'preparing',
  'ready',
  'served',
  'delivered',
];

export function orderStatusLabel(status) {
  return ORDER_STATUS_LABELS[status] || status || '—';
}

export function orderItemStatusLabel(status) {
  return ORDER_ITEM_STATUS_LABELS[status] || status || '—';
}
