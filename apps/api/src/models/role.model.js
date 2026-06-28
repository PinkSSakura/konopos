const { defineModel } = require('../db/sqlite-model');
const auditDefaults = require('./auditfields');

const ROLE_TYPES = {
  BACKOFFICE: 'backoffice',
  FRONTOFFICE: 'frontoffice',
  SYSTEMOFFICE: 'systemoffice',
};

const ROLE_KEYS = [
  'superadmin',
  'owner',
  'manager',
  'submanager',
  'waiter',
  'barman',
  'cook',
  'systempos',
];

const Role = defineModel('Role', {
  refs: {
    created_by: 'User',
    modified_by: 'User',
    deleted_by: 'User',
  },
  defaults: {
    is_hidden: false,
    status: 'actif',
    ...auditDefaults,
  },
});

module.exports = Role;
module.exports.ROLE_TYPES = ROLE_TYPES;
module.exports.ROLE_KEYS = ROLE_KEYS;
