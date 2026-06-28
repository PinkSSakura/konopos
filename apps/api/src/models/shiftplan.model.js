const { defineModel } = require('../db/sqlite-model');

module.exports = defineModel('ShiftPlan', {
  refs: {
    establishment: 'Establishment',
    user: 'User',
  },
  defaults: {
    status: 'planned',
  },
});
