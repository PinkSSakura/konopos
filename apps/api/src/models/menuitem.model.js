const { defineModel } = require('../db/sqlite-model');
const auditDefaults = require('./auditfields');

module.exports = defineModel('MenuItem', {
  refs: {
    establishment: 'Establishment',
    category: 'Category',
    subcategory: 'Subcategory',
    created_by: 'User',
    modified_by: 'User',
    deleted_by: 'User',
  },
  defaults: {
    variants: [],
    modifier_groups: [],
    extra_ids: [],
    use_category_extras: true,
    ...auditDefaults,
  },
});
