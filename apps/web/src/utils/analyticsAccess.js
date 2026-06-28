import { hasAnyPermission, hasPermission } from './permissions';

export function canViewAnalytics(user) {
  return hasPermission(user, 'view_dashboard');
}

export function canViewSelfDashboard(user) {
  return hasAnyPermission(user, ['view_dashboard', 'self_dashboard']);
}
