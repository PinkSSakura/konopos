const { defineModel } = require('../db/sqlite-model');
const auditDefaults = require('./auditfields');

module.exports = defineModel('RolePermission', {
  refs: {
    role: 'Role',
    permission: 'Permission',
    establishment: 'Establishment',
    granted_by: 'User',
    revoked_by: 'User',
    created_by: 'User',
    modified_by: 'User',
    deleted_by: 'User',
  },
  defaults: {
    is_active: true,
    ...auditDefaults,
  },
});
