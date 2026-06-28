const { defineModel } = require('../db/sqlite-model');
const auditDefaults = require('./auditfields');
const config = require('../config');

module.exports = defineModel('Establishment', {
  refs: {
    created_by: 'User',
    modified_by: 'User',
    deleted_by: 'User',
  },
  defaults: {
    maincolor: config.defaultMainColor,
    secondarycolor: config.defaultSecondaryColor,
    currency: config.defaultCurrency,
    tax_rate: 20,
    tax_id_label: 'IF',
    legal_name: '',
    status: 'setup',
    tables_enabled: true,
    server_sections_enabled: true,
    delivery_enabled: true,
    fiscal_morocco_enabled: true,
    waiter_shift_manual_start: true,
    kitchen_shift_manual_start: false,
    auto_print_on_send: false,
    printers: [],
    caisse_printer: {
      enabled: false,
      connection_type: 'tcp',
      port: 9100,
      auto_print_on_send: false,
      auto_print_on_payment: true,
    },
    checkout_ui_mode: 'modal',
    waiter_can_void_payment: false,
    waiter_can_cancel_order: false,
    waiter_service_served_only: false,
    service_ready_on_send: false,
    kds_kitchen_accept_reject: false,
    kds_accept_required: false,
    soft_delete_visible_to_managers: false,
    is_setup_complete: false,
    daily_order_counter: 0,
    daily_order_session: 1,
    ...auditDefaults,
  },
});
