const { defineModel } = require('../db/sqlite-model');
const auditDefaults = require('./auditfields');

const TABLE_STATUS = ['libre', 'occupee', 'reservee', 'nettoyage'];

const Table = defineModel('Table', {
  refs: {
    establishment: 'Establishment',
    room: 'Room',
    current_order: 'Order',
    assigned_waiter: 'User',
    created_by: 'User',
    modified_by: 'User',
    deleted_by: 'User',
  },
  defaults: {
    capacity: 4,
    status: 'libre',
    position: {
      x: 0,
      y: 0,
      width: 100,
      height: 60,
    },
    rotation: 0,
    server_section: null,
    is_merge_primary: false,
    ...auditDefaults,
  },
});

module.exports = Table;
module.exports.TABLE_STATUS = TABLE_STATUS;
