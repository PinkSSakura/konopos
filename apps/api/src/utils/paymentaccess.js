const MANAGER_VOID_ROLES = ['manager', 'submanager', 'owner', 'superadmin'];

async function canVoidPayment(user, establishment) {
  const roleKey = user?.role?.role_key;
  if (MANAGER_VOID_ROLES.includes(roleKey)) return true;
  if (roleKey === 'waiter' && establishment?.waiter_can_void_payment) return true;
  return false;
}

module.exports = { MANAGER_VOID_ROLES, canVoidPayment };
