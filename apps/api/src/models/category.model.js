const { defineModel } = require('../db/sqlite-model');
const auditDefaults = require('./auditfields');

module.exports = defineModel('Category', {
  refs: {
    establishment: 'Establishment',
    created_by: 'User',
    modified_by: 'User',
    deleted_by: 'User',
  },
  defaults: {
    color: '#c2462d',
    extra_ids: [],
    ...auditDefaults,
  },
});
