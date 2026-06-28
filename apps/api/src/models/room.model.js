const { defineModel } = require('../db/sqlite-model');
const auditDefaults = require('./auditfields');

module.exports = defineModel('Room', {
  refs: {
    establishment: 'Establishment',
    created_by: 'User',
    modified_by: 'User',
    deleted_by: 'User',
  },
  defaults: {
    sort_order: 0,
    layout_width: 800,
    layout_height: 600,
    ...auditDefaults,
  },
});
