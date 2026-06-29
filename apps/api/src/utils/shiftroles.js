const SHIFT_ROLES = ['waiter', 'cook', 'barman'];

function isShiftRole(roleKey) {
  return SHIFT_ROLES.includes(roleKey);
}

function requiresManualShiftStart(roleKey, establishment) {
  if (!isShiftRole(roleKey)) return false;
  if (roleKey === 'waiter') return true;
  if (['cook', 'barman'].includes(roleKey)) {
    return establishment?.kitchen_shift_manual_start === true;
  }
  return false;
}

function waiterRequiresOpenShift(roleKey) {
  return roleKey === 'waiter';
}

function usesAutoShift(roleKey, establishment) {
  return isShiftRole(roleKey) && !requiresManualShiftStart(roleKey, establishment);
}

function requiresShiftAmounts(roleKey) {
  return roleKey === 'waiter';
}

function shouldAutoStartShiftOnLogin(roleKey, establishment, {
  isPinSession = false,
  fromSystemPos = false,
  isDirectPin = false,
} = {}) {
  if (!isShiftRole(roleKey)) return false;
  // Waiters: shift is opened only by admin (Shifts en service).
  if (roleKey === 'waiter') return false;
  if (usesAutoShift(roleKey, establishment)) return true;
  if (requiresManualShiftStart(roleKey, establishment) && isPinSession && fromSystemPos) {
    return true;
  }
  return false;
}

/** @deprecated utiliser isShiftRole — conservé pour compatibilité */
function requiresShift(roleKey) {
  return isShiftRole(roleKey);
}

module.exports = {
  SHIFT_ROLES,
  SHIFT_REQUIRED_ROLES: SHIFT_ROLES,
  isShiftRole,
  requiresShift,
  requiresManualShiftStart,
  usesAutoShift,
  requiresShiftAmounts,
  shouldAutoStartShiftOnLogin,
  waiterRequiresOpenShift,
};
