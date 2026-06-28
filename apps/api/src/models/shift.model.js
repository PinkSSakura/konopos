const { defineModel } = require('../db/sqlite-model');

module.exports = defineModel('Shift', {
  refs: {
    user: 'User',
    establishment: 'Establishment',
    closed_by_user: 'User',
    source_systempos_session: 'UserSession',
    forced_logout_by: 'User',
  },
  defaults: {
    clock_in: () => new Date().toISOString(),
    opening_amount: 0,
    source: 'manual',
    is_active: true,
  },
});
