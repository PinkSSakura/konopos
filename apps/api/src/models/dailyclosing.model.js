const { defineModel } = require('../db/sqlite-model');
const auditDefaults = require('./auditfields');

module.exports = defineModel('DailyClosing', {
  refs: {
    establishment: 'Establishment',
    closed_by: 'User',
    created_by: 'User',
    modified_by: 'User',
    deleted_by: 'User',
  },
  defaults: {
    totals: {
      cash: 0,
      card: 0,
      credit: 0,
      debit: 0,
      discount_total: 0,
      service_charge_total: 0,
      amount_tendered_total: 0,
      change_total: 0,
      payment_count: 0,
      void_count: 0,
      gross_total: 0,
    },
    shift_ids: [],
    payment_ids: [],
    ...auditDefaults,
  },
});
