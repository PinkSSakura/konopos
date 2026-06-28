const CONNECTION_TCP = 'tcp';
const CONNECTION_USB = 'usb';

function normalizeConnectionType(type) {
  return type === CONNECTION_USB ? CONNECTION_USB : CONNECTION_TCP;
}

function productTypesFromTicketType(ticketType) {
  if (ticketType === 'FOOD') return ['FOOD'];
  if (ticketType === 'DRINK') return ['DRINK'];
  return ['FOOD', 'DRINK'];
}

function ticketTypeFromProductTypes(productTypes) {
  const types = productTypes || [];
  if (types.includes('FOOD') && types.includes('DRINK')) return 'BOTH';
  if (types.includes('DRINK')) return 'DRINK';
  if (types.includes('FOOD')) return 'FOOD';
  return 'BOTH';
}

function normalizeKitchenPrinter(raw) {
  const connection_type = normalizeConnectionType(raw?.connection_type);
  const product_types = raw?.product_types?.length
    ? raw.product_types.filter((t) => ['FOOD', 'DRINK'].includes(t))
    : productTypesFromTicketType(raw?.ticket_type);

  const base = {
    label: String(raw?.label || '').trim(),
    connection_type,
    enabled: raw?.enabled !== false,
    product_types: product_types.length ? product_types : ['FOOD', 'DRINK'],
  };

  if (connection_type === CONNECTION_USB) {
    return {
      ...base,
      usb_name: String(raw?.usb_name || '').trim(),
    };
  }

  return {
    ...base,
    host: String(raw?.host || '').trim(),
    port: Number(raw?.port) || 9100,
  };
}

function normalizeKitchenPrinters(printers) {
  return (printers || [])
    .map(normalizeKitchenPrinter)
    .filter((printer) => {
      if (!printer.label) return false;
      if (printer.connection_type === CONNECTION_USB) return Boolean(printer.usb_name);
      return Boolean(printer.host);
    });
}

function normalizeCaissePrinter(raw) {
  const connection_type = normalizeConnectionType(raw?.connection_type);
  const base = {
    enabled: Boolean(raw?.enabled),
    connection_type,
    auto_print_on_send: Boolean(raw?.auto_print_on_send),
    auto_print_on_payment: raw?.auto_print_on_payment !== false,
  };

  if (connection_type === CONNECTION_USB) {
    return {
      ...base,
      usb_name: String(raw?.usb_name || '').trim(),
    };
  }

  return {
    ...base,
    host: String(raw?.host || '').trim(),
    port: Number(raw?.port) || 9100,
  };
}

function isPrinterConfigured(printer) {
  if (!printer || printer.enabled === false) return false;
  const connection_type = normalizeConnectionType(printer.connection_type);
  if (connection_type === CONNECTION_USB) {
    return Boolean(printer.usb_name?.trim());
  }
  return Boolean(printer.host?.trim());
}

function getPrinterTarget(printer) {
  if (!printer) return '';
  const connection_type = normalizeConnectionType(printer.connection_type);
  if (connection_type === CONNECTION_USB) {
    return printer.usb_name || printer.label || 'USB';
  }
  const port = printer.port || 9100;
  return `${printer.host}:${port}`;
}

function getPrinterLabel(printer) {
  return printer?.label || getPrinterTarget(printer) || 'Imprimante';
}

module.exports = {
  CONNECTION_TCP,
  CONNECTION_USB,
  normalizeConnectionType,
  normalizeKitchenPrinter,
  normalizeKitchenPrinters,
  normalizeCaissePrinter,
  isPrinterConfigured,
  getPrinterTarget,
  getPrinterLabel,
  productTypesFromTicketType,
  ticketTypeFromProductTypes,
};
