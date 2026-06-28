const { defineModel } = require('../db/sqlite-model');
const auditDefaults = require('./auditfields');

module.exports = defineModel('Permission', {
  refs: {
    created_by: 'User',
    modified_by: 'User',
    deleted_by: 'User',
  },
  defaults: auditDefaults,
});
