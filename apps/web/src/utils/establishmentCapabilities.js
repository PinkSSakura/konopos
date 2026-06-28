export const ESTABLISHMENT_CAP = {
  SETUP_COMPLETE: 'setup_complete',
  TABLES: 'tables',
  WAITER_SHIFT_MANUAL: 'waiter_shift_manual',
  KITCHEN_SHIFT_MANUAL: 'kitchen_shift_manual',
  KITCHEN_DISPATCH: 'kitchen_dispatch',
  WAITER_VOID_PAYMENT: 'waiter_void_payment',
  WAITER_CANCEL_ORDER: 'waiter_cancel_order',
  WAITER_SERVICE_SERVED_ONLY: 'waiter_service_served_only',
  CAISSE_AUTO_PRINT_PAYMENT: 'caisse_auto_print_payment',
  SERVER_SECTIONS: 'server_sections',
  DELIVERY: 'delivery',
};

export function hasEstablishmentCapability(capabilities, code) {
  return Array.isArray(capabilities) && capabilities.includes(code);
}

export function getEstablishmentFeaturesFromCapabilities(capabilities) {
  return {
    tables: hasEstablishmentCapability(capabilities, ESTABLISHMENT_CAP.TABLES),
    waiterShiftManualStart: hasEstablishmentCapability(
      capabilities,
      ESTABLISHMENT_CAP.WAITER_SHIFT_MANUAL,
    ),
    kitchenShiftManualStart: hasEstablishmentCapability(
      capabilities,
      ESTABLISHMENT_CAP.KITCHEN_SHIFT_MANUAL,
    ),
  };
}
