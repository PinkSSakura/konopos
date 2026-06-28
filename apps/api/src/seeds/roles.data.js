const { ROLE_TYPES } = require('../models/role.model');

const ROLES = [
  {
    code_role: 'SA00000',
    name: 'superadmin',
    display_name: 'SUPERADMIN',
    abreviation: 'SA',
    role_key: 'superadmin',
    role_type: ROLE_TYPES.BACKOFFICE,
    is_hidden: true,
  },
  {
    code_role: 'OW00000',
    name: 'owner',
    display_name: 'PROPRIÉTAIRE',
    abreviation: 'OWN',
    role_key: 'owner',
    role_type: ROLE_TYPES.BACKOFFICE,
  },
  {
    code_role: 'MG00000',
    name: 'manager',
    display_name: 'MANAGER',
    abreviation: 'MGR',
    role_key: 'manager',
    role_type: ROLE_TYPES.BACKOFFICE,
  },
  {
    code_role: 'SM00000',
    name: 'submanager',
    display_name: 'SOUS-MANAGER',
    abreviation: 'SMG',
    role_key: 'submanager',
    role_type: ROLE_TYPES.BACKOFFICE,
  },
  {
    code_role: 'WT00000',
    name: 'waiter',
    display_name: 'SERVEUR',
    abreviation: 'WTR',
    role_key: 'waiter',
    role_type: ROLE_TYPES.FRONTOFFICE,
  },
  {
    code_role: 'BR00000',
    name: 'barman',
    display_name: 'BARMAN',
    abreviation: 'BAR',
    role_key: 'barman',
    role_type: ROLE_TYPES.FRONTOFFICE,
  },
  {
    code_role: 'CK00000',
    name: 'cook',
    display_name: 'CUISINIER',
    abreviation: 'COK',
    role_key: 'cook',
    role_type: ROLE_TYPES.FRONTOFFICE,
  },
  {
    code_role: 'SY00000',
    name: 'systempos',
    display_name: 'SYSTEMPOS',
    abreviation: 'SYS',
    role_key: 'systempos',
    role_type: ROLE_TYPES.SYSTEMOFFICE,
  },
];

module.exports = ROLES;
