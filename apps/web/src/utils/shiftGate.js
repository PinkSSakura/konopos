import { canViewAnalytics } from './analyticsAccess';
import { canViewPaymentHistory } from './paymentAccess';
import { getKitchenDashboardPath } from './kdsaccess';
import { hasCaisseHubAccess } from './caisseHub';

/** Routes / menu keys accessible without an open shift (manual mode). */
export function getShiftGateAllowedKeys(user) {
  const roleKey = user?.role?.role_key;
  const keys = ['/shift', '/orders'];
  if (canViewPaymentHistory(user)) {
    keys.push('/caisse/history', '/caisse');
  }
  if (canViewAnalytics(user)) {
    keys.push('/dashboard');
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
      if (item.key === '/caisse') {
        return hasCaisseHubAccess(user) && allowed.includes('/caisse') ? item : null;
      }
      return allowed.includes(item.key) ? item : null;
    })
    .filter(Boolean);
}

export function getPostShiftStartRoute(roleKey) {
  if (roleKey === 'waiter') return '/pos';
  return getKitchenDashboardPath(roleKey) || '/pos';
}
