const STAFF_EXPORT_LEADERSHIP = ['superadmin', 'owner', 'manager', 'submanager'];

export function canExportAnyStaffReport(roleKey) {
  return STAFF_EXPORT_LEADERSHIP.includes(roleKey);
}
