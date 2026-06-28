const { defineModel } = require('../db/sqlite-model');

module.exports = defineModel('PushSubscription', {
  refs: {
    user: 'User',
    establishment: 'Establishment',
  },
  defaults: {
    is_deleted: false,
  },
});
