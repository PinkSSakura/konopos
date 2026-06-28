export const KITCHEN_STAFF_ROLES = ['cook', 'barman'];

export function isKitchenStaffRole(roleKey) {
  return KITCHEN_STAFF_ROLES.includes(roleKey);
}

export function getKitchenProductType(roleKey) {
  if (roleKey === 'cook') return 'FOOD';
  if (roleKey === 'barman') return 'DRINK';
  return null;
}

export function getKitchenDashboardPath(roleKey) {
  if (roleKey === 'cook') return '/kds/food';
  if (roleKey === 'barman') return '/kds/drink';
  return null;
}

export function canAccessPos(roleKey) {
  return !isKitchenStaffRole(roleKey);
}

const KITCHEN_REPRINT_ROLES = ['waiter', 'manager', 'submanager', 'superadmin', 'owner'];

export function canReprintKitchenTicket(roleKey) {
  if (!roleKey) return false;
  return KITCHEN_REPRINT_ROLES.includes(roleKey);
}

export function canPrintKitchenOrder(order) {
  return order?.status && !['open', 'cancelled'].includes(order.status);
}

export function isSuperAdminRole(roleKey) {
  return roleKey === 'superadmin';
}

export function canOverrideKitchenStaffDispatch(roleKey) {
  return isSuperAdminRole(roleKey);
}
