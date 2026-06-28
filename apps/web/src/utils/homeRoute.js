import { isLeadershipRole } from './roleKeys';
import { getKitchenDashboardPath } from './kdsaccess';

/** Route d'accueil après connexion selon le rôle */
export function getHomeRoute(roleKey) {
  if (roleKey === 'systempos') return '/pin';
  if (isLeadershipRole(roleKey)) return '/dashboard';
  const kitchenHome = getKitchenDashboardPath(roleKey);
  if (kitchenHome) return kitchenHome;
  return '/pos';
}
