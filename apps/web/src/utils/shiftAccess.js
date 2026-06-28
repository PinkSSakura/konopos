import { hasAnyPermission, hasPermission } from './permissions';
import { canExportAnyStaffReport } from './staffExport';

export function canViewOwnShift(user) {
  return hasPermission(user, 'shift_view_own');
}

export function canViewWaiterDailyClose(user) {
  if (!canViewOwnShift(user)) return false;
  if (user?.role?.role_key === 'waiter') return true;
  return canExportAnyStaffReport(user?.role?.role_key);
}

export function canSelectWaiterDailyCloseTarget(user) {
  return canExportAnyStaffReport(user?.role?.role_key);
}

export function canViewAllShifts(user) {
  return hasPermission(user, 'shift_view_all');
}

export function canViewShiftPlans(user) {
  return hasPermission(user, 'shift_plan_view');
}

export function canCreateShiftPlan(user) {
  return hasPermission(user, 'shift_plan_create');
}

export function canUpdateShiftPlan(user) {
  return hasPermission(user, 'shift_plan_update');
}

export function canDeleteShiftPlan(user) {
  return hasPermission(user, 'shift_plan_delete');
}

export function canAccessShiftAdmin(user) {
  return hasAnyPermission(user, ['shift_view_all', 'shift_plan_view']);
}
