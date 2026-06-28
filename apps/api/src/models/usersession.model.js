const { defineModel } = require('../db/sqlite-model');

module.exports = defineModel('UserSession', {
  refs: {
    user: 'User',
    establishment: 'Establishment',
    shift: 'Shift',
    parent_systempos_session: 'UserSession',
  },
  defaults: {
    is_active: true,
    login_time: () => new Date().toISOString(),
    is_pin_session: false,
    is_quick_waiter_session: false,
    pin_login_counts: {},
  },
  methods: {
    logout(reason = 'manual') {
      this.is_active = false;
      this.logout_time = new Date();
      this.logout_reason = reason || 'manual';
      return this.save();
    },
  },
});
