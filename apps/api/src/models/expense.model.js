const { defineModel } = require('../db/sqlite-model');
const auditDefaults = require('./auditfields');

const EXPENSE_CATEGORIES = [
  'bills',
  'merchandise',
  'salary',
  'maintenance',
  'marketing',
  'tax',
  'other',
];

const EXPENSE_PAYMENT_METHODS = ['cash', 'card', 'transfer', 'check', 'other'];

const Expense = defineModel('Expense', {
  refs: {
    establishment: 'Establishment',
    recorded_by: 'User',
    created_by: 'User',
    modified_by: 'User',
    deleted_by: 'User',
  },
  defaults: {
    payment_method: 'cash',
    ...auditDefaults,
  },
});

module.exports = Expense;
module.exports.EXPENSE_CATEGORIES = EXPENSE_CATEGORIES;
module.exports.EXPENSE_PAYMENT_METHODS = EXPENSE_PAYMENT_METHODS;
