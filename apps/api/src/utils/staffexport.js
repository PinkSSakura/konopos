const STAFF_EXPORT_LEADERSHIP = ['superadmin', 'owner', 'manager', 'submanager'];

function canExportStaffReport(requester, targetUserId) {
  if (!requester?._id) return false;
  if (!targetUserId || String(requester._id) === String(targetUserId)) return true;
  return STAFF_EXPORT_LEADERSHIP.includes(requester.role?.role_key);
}

function canExportAnyStaffReport(roleKey) {
  return STAFF_EXPORT_LEADERSHIP.includes(roleKey);
}

module.exports = {
  STAFF_EXPORT_LEADERSHIP,
  canExportStaffReport,
  canExportAnyStaffReport,
};
