const { defineModel } = require('../db/sqlite-model');

module.exports = defineModel('AuditLog', {
  refs: {
    establishment: 'Establishment',
    user: 'User',
  },
  defaults: {
    success: true,
    audience: 'system',
  },
});
