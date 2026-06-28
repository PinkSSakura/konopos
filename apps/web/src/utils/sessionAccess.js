import { hasAnyPermission, hasPermission } from './permissions';

export function canViewConnectedSessions(user) {
  return hasPermission(user, 'user_view_sessions');
}

export function canForceLogoutSession(user) {
  return hasPermission(user, 'user_force_logout');
}

export function canAccessConnectedUsers(user) {
  return hasAnyPermission(user, ['user_view_sessions', 'user_force_logout']);
}
