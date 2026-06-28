const { Order, OrderItem, Establishment } = require('../models');
const { getReceiptForOrder, calcTaxBreakdown } = require('./receipt');
const { buildTicketBuffer, buildCaisseTicketBuffer, buildWaiterDailyCloseBuffer } = require('./escpos');
const { sendBufferToPrinter } = require('./printer-transport');
const {
  isPrinterConfigured,
  getPrinterTarget,
  getPrinterLabel,
} = require('../utils/printer-config');

const METHOD_LABELS = {
  cash: 'Especes',
  card: 'Carte',
  credit: 'Credit client',
  debit: 'Debit compte',
};

const STATUS_LABELS = {
  paid: 'Paye',
  partial: 'Partiel',
  unpaid: 'A regler',
};

const TYPE_LABELS = {
  FOOD: 'CUISINE',
  DRINK: 'BAR',
  dine_in: 'Sur place',
  takeaway: 'A emporter',
  delivery: 'Livraison',
};

const DEFAULT_PRODUCT_TYPES = ['FOOD', 'DRINK'];

function normalizeProductTypes(productTypes) {
  if (!productTypes?.length) return DEFAULT_PRODUCT_TYPES;
  const allowed = productTypes.filter((t) => ['FOOD', 'DRINK'].includes(t));
  return allowed.length ? allowed : DEFAULT_PRODUCT_TYPES;
}

function filterItemsForPrinter(items, productTypes) {
  const types = normalizeProductTypes(productTypes);
  return items.filter((item) => types.includes(item.product_type));
}

function formatItemLine(item) {
  const extras = [];
  if (item.variant?.name) extras.push(item.variant.name);
  if (item.modifiers?.length) {
    item.modifiers.forEach((m) => extras.push(m.name));
  }
  return {
    quantity: item.quantity,
    name: item.name,
    extras,
    notes: item.notes,
  };
}

function buildKitchenTicketLines(order, items, establishmentName, printerLabel, reprint) {
  const meta = [
    `Commande : ${order.order_number}`,
    `Type : ${TYPE_LABELS[order.type] || order.type}`,
  ];
  if (order.table?.name) meta.push(`Table : ${order.table.name}`);
  if (order.waiter?.fullname) meta.push(`Serveur : ${order.waiter.fullname}`);
  meta.push(`Date : ${new Date().toLocaleString('fr-FR')}`);
  if (reprint) meta.push('*** REIMPRESSION ***');
  if (order.notes) meta.push(`Note commande : ${order.notes}`);

  return {
    title: `${establishmentName || 'COMMANDE'} — ${printerLabel}`,
    meta,
    items: items.map(formatItemLine),
    footer: 'Bon commande',
  };
}

function getActivePrinters(establishment) {
  return (establishment.printers || []).filter(isPrinterConfigured);
}

function buildCaisseTicketPayload(receipt, { includePayment = true, itemIds = null, isVoid = false, voidReason } = {}) {
  const { establishment: est, order, tax: fullTax, payment, amounts, payments_summary } = receipt;
  let items = receipt.items || [];

  if (itemIds?.length) {
    const idSet = new Set(itemIds.map(String));
    items = items.filter((item) => idSet.has(String(item._id)));
  }

  if (!items.length) return null;

  let tax = fullTax;
  if (itemIds?.length) {
    const subtotalTtc = items.reduce((sum, item) => sum + (item.line_total || 0), 0);
    tax = calcTaxBreakdown(Math.round(subtotalTtc * 100) / 100, fullTax?.tax_rate ?? 20);
  }

  const meta = [
    `Commande : ${order.order_number}`,
    `Ticket : ${payment?.receipt_number || order.receipt_number || '-'}`,
    `Type : ${order.type_label}`,
  ];
  if (order.daily_code) meta.push(`Code du jour : ${order.daily_code}`);
  if (order.table) meta.push(`Table : ${order.table}`);
  if (order.waiter) meta.push(`Serveur : ${order.waiter}`);
  if (receipt.customer?.name) meta.push(`Client : ${receipt.customer.name}`);
  meta.push(`Date : ${new Date(payment?.processed_at || order.paid_at || order.created_at).toLocaleString('fr-FR')}`);
  if (!includePayment) meta.push('Note : A regler');
  if (isVoid) {
    meta.push(`Motif : ${voidReason || 'Annulation'}`);
  }
  if (amounts?.discount > 0 && !itemIds?.length) {
    meta.push(`Remise : -${amounts.discount.toFixed(2)} ${est.currency}`);
  }
  if (amounts?.service_charge > 0 && !itemIds?.length) {
    meta.push(`Service : +${amounts.service_charge.toFixed(2)} ${est.currency}`);
  }

  const contactFooter = [est.website, est.phone, est.email].filter(Boolean).join(' | ');
  const statusKey = isVoid
    ? 'void'
    : (receipt.is_paid ? 'paid' : order.payment_status || 'unpaid');

  return {
    title: est.name || 'TICKET CAISSE',
    daily_code: order.daily_code || null,
    is_void: isVoid,
    void_reason: voidReason,
    status_label: isVoid ? 'ANNULE / IMPAYE' : (STATUS_LABELS[statusKey] || statusKey),
    meta,
    items,
    tax,
    payment: includePayment && payment
      ? {
          ...payment,
          method_label: METHOD_LABELS[payment.method] || payment.method,
        }
      : null,
    payments_summary: includePayment ? payments_summary : [],
    footer: contactFooter ? `Merci de votre visite\n${contactFooter}` : 'Merci de votre visite',
    currency: est.currency || 'MAD',
  };
}

async function sendCaisseTicket(establishment, ticket) {
  const printer = establishment?.caisse_printer;
  if (!isPrinterConfigured(printer)) {
    return { skipped: true };
  }

  const buffer = buildCaisseTicketBuffer(ticket);
  const result = await sendBufferToPrinter(printer, buffer);
  return { printed: true, target: result.target };
}

async function printItemsToStations(establishmentId, order, items, { reprint = false } = {}) {
  const establishment = await Establishment.findById(establishmentId).select('name printers auto_print_on_send');
  if (!establishment) {
    const err = new Error('Etablissement introuvable.');
    err.status = 404;
    throw err;
  }

  const billable = items.filter((i) => !['cancelled', 'rejected'].includes(i.status));
  if (!billable.length) {
    return { printed: [], skipped: [], errors: [] };
  }

  const printers = getActivePrinters(establishment);
  if (!printers.length) {
    return { printed: [], skipped: [{ reason: 'Aucune imprimante active configuree' }], errors: [] };
  }

  const printed = [];
  const skipped = [];
  const errors = [];

  for (const printer of printers) {
    const printerItems = filterItemsForPrinter(billable, printer.product_types);
    if (!printerItems.length) {
      skipped.push({
        printer: getPrinterLabel(printer),
        target: getPrinterTarget(printer),
        reason: 'Aucun article pour ce type',
      });
      continue;
    }

    const ticketLines = buildKitchenTicketLines(
      order,
      printerItems,
      establishment.name,
      getPrinterLabel(printer),
      reprint
    );
    const buffer = buildTicketBuffer(ticketLines);

    try {
      const result = await sendBufferToPrinter(printer, buffer);
      printed.push({
        printer: getPrinterLabel(printer),
        target: result.target,
        itemCount: printerItems.length,
      });
    } catch (err) {
      errors.push({
        printer: getPrinterLabel(printer),
        target: getPrinterTarget(printer),
        message: err.message,
      });
    }
  }

  return { printed, skipped, errors };
}

async function printOnSend(establishmentId, orderId, sentItemIds) {
  const establishment = await Establishment.findById(establishmentId).select('auto_print_on_send printers');
  if (!establishment?.auto_print_on_send) {
    return { printed: [], skipped: [{ reason: 'Auto-impression desactivee' }], errors: [] };
  }

  const order = await Order.findById(orderId)
    .populate('table', 'name')
    .populate('waiter', 'fullname');
  if (!order) return { printed: [], skipped: [], errors: [] };

  const items = await OrderItem.find({ _id: { $in: sentItemIds }, order: orderId });
  return printItemsToStations(establishmentId, order, items, { reprint: false });
}

async function reprintFullOrder(establishmentId, orderId) {
  const order = await Order.findOne({ _id: orderId, establishment: establishmentId, is_deleted: false })
    .populate('table', 'name')
    .populate('waiter', 'fullname');

  if (!order) {
    const err = new Error('Commande introuvable.');
    err.status = 404;
    throw err;
  }

  if (order.status === 'open') {
    const err = new Error('Envoyez la commande en cuisine avant d\'imprimer.');
    err.status = 400;
    throw err;
  }

  if (order.status === 'cancelled') {
    const err = new Error('Commande annulee.');
    err.status = 400;
    throw err;
  }

  const items = await OrderItem.find({ order: orderId }).sort({ createdAt: 1 });
  return printItemsToStations(establishmentId, order, items, { reprint: true });
}

async function printCaisseReceipt(establishmentId, orderId, paymentId) {
  const establishment = await Establishment.findById(establishmentId).select('caisse_printer name currency');
  const receipt = await getReceiptForOrder(orderId, establishmentId, paymentId);
  const ticket = buildCaisseTicketPayload(receipt, { includePayment: true });
  if (!ticket) return { skipped: true, reason: 'Aucun article a imprimer' };
  return sendCaisseTicket(establishment, ticket);
}

async function printCaisseVoidReceipt(establishmentId, orderId, { reason } = {}) {
  const establishment = await Establishment.findById(establishmentId).select('caisse_printer name currency');
  const receipt = await getReceiptForOrder(orderId, establishmentId, null, { include_cancelled_items: true });
  const ticket = buildCaisseTicketPayload(receipt, {
    includePayment: false,
    isVoid: true,
    voidReason: reason,
  });
  if (!ticket) return { skipped: true, reason: 'Aucun article a imprimer' };
  return sendCaisseTicket(establishment, ticket);
}

async function printCaisseOnSend(establishmentId, orderId, sentItemIds) {
  const establishment = await Establishment.findById(establishmentId).select('caisse_printer');
  if (!establishment?.caisse_printer?.enabled || !establishment?.caisse_printer?.auto_print_on_send) {
    return { skipped: true, reason: 'Auto-impression caisse a l\'envoi desactivee' };
  }

  const receipt = await getReceiptForOrder(orderId, establishmentId);
  const ticket = buildCaisseTicketPayload(receipt, {
    includePayment: false,
    itemIds: sentItemIds,
  });
  if (!ticket) return { skipped: true, reason: 'Aucun article a imprimer' };
  return sendCaisseTicket(establishment, ticket);
}

async function printWaiterDailyClose(establishmentId, report) {
  const establishment = await Establishment.findById(establishmentId).select('caisse_printer name');
  const printer = establishment?.caisse_printer;
  if (!isPrinterConfigured(printer)) {
    return { skipped: true, reason: 'Imprimante caisse non configuree' };
  }
  const buffer = buildWaiterDailyCloseBuffer(report, establishment.name);
  const result = await sendBufferToPrinter(printer, buffer);
  return { printed: true, target: result.target };
}

module.exports = {
  printOnSend,
  reprintFullOrder,
  printItemsToStations,
  normalizeProductTypes,
  filterItemsForPrinter,
  printCaisseReceipt,
  printCaisseVoidReceipt,
  printCaisseOnSend,
  buildCaisseTicketPayload,
  printWaiterDailyClose,
};
