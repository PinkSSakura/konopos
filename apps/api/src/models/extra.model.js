const { defineModel } = require('../db/sqlite-model');
const auditDefaults = require('./auditfields');

module.exports = defineModel('Extra', {
  refs: {
    establishment: 'Establishment',
    created_by: 'User',
    modified_by: 'User',
    deleted_by: 'User',
  },
  defaults: {
    price: 0,
    is_active: true,
    ...auditDefaults,
  },
});
