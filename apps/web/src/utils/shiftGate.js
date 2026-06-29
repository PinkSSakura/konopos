import { canViewPaymentHistory } from './paymentAccess';
import { getKitchenDashboardPath } from './kdsaccess';

export function shouldEnforceShiftGate(user) {
  return user?.role?.role_key === 'waiter';
}

/** Routes accessible without an open waiter shift. */
export function getShiftGateAllowedKeys(user) {
  const roleKey = user?.role?.role_key;
  const keys = ['/shift', '/shift/daily-close'];

  if (roleKey === 'waiter') {
    if (canViewPaymentHistory(user)) {
      keys.push('/caisse/history');
    }
    return keys;
  }

  if (canViewPaymentHistory(user)) {
    keys.push('/caisse/history');
  }
  return keys;
}

export function isShiftGateAllowedPath(path, user) {
  return getShiftGateAllowedKeys(user).some(
    (key) => path === key || path.startsWith(`${key}/`),
  );
}

export function filterNavForShiftGate(navItems, user) {
  const allowed = getShiftGateAllowedKeys(user);
  return navItems
    .map((item) => {
      if (item.children) {
        const children = item.children.filter((child) => allowed.includes(child.key));
        if (!children.length) return null;
        return { ...item, children };
      }
      return allowed.includes(item.key) ? item : null;
    })
    .filter(Boolean);
}

export function getWaiterHomeRoute(activeShift) {
  return activeShift ? '/pos' : '/shift';
}

export function getPostShiftStartRoute(roleKey) {
  if (roleKey === 'waiter') return '/pos';
  return getKitchenDashboardPath(roleKey) || '/pos';
}
