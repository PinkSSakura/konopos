const { defineModel } = require('../db/sqlite-model');

const ITEM_STATUS = ['new', 'preparing', 'ready', 'served', 'rejected', 'cancelled'];

const OrderItem = defineModel('OrderItem', {
  refs: {
    order: 'Order',
    establishment: 'Establishment',
    menu_item: 'MenuItem',
    cancelled_by: 'User',
    replaced_by: 'OrderItem',
    replaces: 'OrderItem',
  },
  defaults: {
    quantity: 1,
    status: 'new',
    modifiers: [],
  },
});

module.exports = OrderItem;
module.exports.ITEM_STATUS = ITEM_STATUS;
