import { hasPermission } from './permissions';

export function canExportTeamStaffReports(user) {
  return hasPermission(user, 'report_export_staff');
}

export function canExportOwnStaffReport(user) {
  return hasPermission(user, 'report_self_export');
}
