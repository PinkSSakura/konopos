const { defineModel } = require('../db/sqlite-model');
const auditDefaults = require('./auditfields');

module.exports = defineModel('User', {
  refs: {
    establishment: 'Establishment',
    role: 'Role',
    created_by: 'User',
    modified_by: 'User',
    deleted_by: 'User',
  },
  defaults: {
    status: 'actif',
    is_system_pos: false,
    pin_failed_attempts: 0,
    pin_lock_tier: 0,
    ...auditDefaults,
  },
});
