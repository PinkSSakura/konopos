import { hasPermission } from './permissions';

export function canViewStaffActivity(user) {
  return hasPermission(user, 'activity_view');
}
