function isKitchenAcceptRejectEnabled(establishment) {
  if (establishment?.kds_kitchen_accept_reject != null) {
    return Boolean(establishment.kds_kitchen_accept_reject);
  }
  return Boolean(establishment?.kds_accept_required);
}

const SERVE_ROLES = ['waiter', 'manager', 'submanager', 'superadmin', 'owner', 'systempos'];

function canMarkServed(roleKey) {
  return SERVE_ROLES.includes(roleKey);
}

function canKitchenDispatch(roleKey) {
  return canMarkServed(roleKey);
}

const KITCHEN_STAFF_ROLES = ['cook', 'barman'];

function isKitchenStaffRole(roleKey) {
  return KITCHEN_STAFF_ROLES.includes(roleKey);
}

function getKitchenProductType(roleKey) {
  if (roleKey === 'cook') return 'FOOD';
  if (roleKey === 'barman') return 'DRINK';
  return null;
}

const KITCHEN_REPRINT_ROLES = ['waiter', 'manager', 'submanager', 'superadmin', 'owner'];

function canReprintKitchenTicket(roleKey) {
  return KITCHEN_REPRINT_ROLES.includes(roleKey);
}

function isSuperAdminRole(roleKey) {
  return roleKey === 'superadmin';
}

function canOverrideKitchenStaffDispatch(roleKey) {
  return isSuperAdminRole(roleKey);
}

module.exports = {
  isKitchenAcceptRejectEnabled,
  SERVE_ROLES,
  canMarkServed,
  canKitchenDispatch,
  KITCHEN_STAFF_ROLES,
  isKitchenStaffRole,
  getKitchenProductType,
  KITCHEN_REPRINT_ROLES,
  canReprintKitchenTicket,
  isSuperAdminRole,
  canOverrideKitchenStaffDispatch,
};
