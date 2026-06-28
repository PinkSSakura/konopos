const { defineModel } = require('../db/sqlite-model');
const auditDefaults = require('./auditfields');

const PAYMENT_METHODS = ['cash', 'card', 'credit', 'debit'];
const PAYMENT_KINDS = ['full', 'partial', 'split'];

const Payment = defineModel('Payment', {
  refs: {
    establishment: 'Establishment',
    order: 'Order',
    shift: 'Shift',
    customer: 'Customer',
    processed_by: 'User',
    voided_by: 'User',
    created_by: 'User',
    modified_by: 'User',
    deleted_by: 'User',
  },
  defaults: {
    kind: 'full',
    change_due: 0,
    discount_amount: 0,
    discount_percent: 0,
    service_charge_amount: 0,
    service_charge_percent: 0,
    split_item_ids: [],
    is_void: false,
    ...auditDefaults,
  },
});

module.exports = Payment;
module.exports.PAYMENT_METHODS = PAYMENT_METHODS;
module.exports.PAYMENT_KINDS = PAYMENT_KINDS;
