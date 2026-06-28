const { defineModel } = require('../db/sqlite-model');
const auditDefaults = require('./auditfields');

const ORDER_TYPES = ['dine_in', 'takeaway', 'delivery'];
const ORDER_STATUS = ['open', 'sent', 'preparing', 'ready', 'served', 'delivered', 'paid', 'cancelled'];
const PAYMENT_STATUS = ['unpaid', 'partial', 'paid'];

const Order = defineModel('Order', {
  refs: {
    establishment: 'Establishment',
    table: 'Table',
    room: 'Room',
    waiter: 'User',
    customer: 'Customer',
    merged_from_orders: 'Order',
    merged_into: 'Order',
    created_by: 'User',
    modified_by: 'User',
    deleted_by: 'User',
  },
  defaults: {
    type: 'dine_in',
    status: 'open',
    subtotal: 0,
    total: 0,
    discount_amount: 0,
    discount_percent: 0,
    service_charge_amount: 0,
    service_charge_percent: 0,
    payment_status: 'unpaid',
    amount_paid: 0,
    merged_from_orders: [],
    ...auditDefaults,
  },
});

module.exports = Order;
module.exports.ORDER_TYPES = ORDER_TYPES;
module.exports.ORDER_STATUS = ORDER_STATUS;
module.exports.PAYMENT_STATUS = PAYMENT_STATUS;
