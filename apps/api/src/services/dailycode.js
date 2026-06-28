const { Establishment, Order, OrderItem } = require('../models');
const { buildDailyCodeSlipBuffer } = require('./escpos');
const { sendBufferToPrinter } = require('./printer-transport');
const { isPrinterConfigured } = require('../utils/printer-config');

const CODE_LENGTH = 6;
const MAX_COUNTER = 10 ** CODE_LENGTH - 1;

function normalizeDailyCode(input) {
  const digits = String(input || '').replace(/\D/g, '');
  if (!digits.length) return null;
  const n = parseInt(digits, 10);
  if (Number.isNaN(n) || n < 1 || n > MAX_COUNTER) return null;
  return String(n).padStart(CODE_LENGTH, '0');
}

function formatDailyCode(counter) {
  return String(counter).padStart(CODE_LENGTH, '0');
}

async function getEstablishmentSession(estId) {
  const est = await Establishment.findById(estId).select(
    'daily_order_counter daily_order_session tables_enabled name'
  );
  if (!est) {
    const err = new Error('Établissement introuvable.');
    err.status = 404;
    throw err;
  }
  if (est.daily_order_session == null) {
    est.daily_order_session = 1;
    est.daily_order_counter = est.daily_order_counter || 0;
    await est.save();
  }
  return est;
}

function todayDateKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function maybeResetDailyCodeForCalendarDay(establishmentId) {
  const est = await getEstablishmentSession(establishmentId);
  const today = todayDateKey();
  if (est.daily_code_calendar_date === today) return false;
  await Establishment.updateOne(
    { _id: establishmentId },
    {
      $set: {
        daily_order_counter: 0,
        daily_code_calendar_date: today,
      },
    },
  );
  return true;
}

/**
 * Assign a daily code on first send to kitchen/bar. Re-sends keep the existing code.
 */
async function assignDailyCodeIfNeeded(order, establishment) {
  const est = establishment?.daily_order_session != null
    ? establishment
    : await getEstablishmentSession(order.establishment);

  await maybeResetDailyCodeForCalendarDay(est._id || order.establishment);

  if (
    order.daily_code
    && order.daily_code_session === est.daily_order_session
  ) {
    return { code: order.daily_code, isNew: false };
  }

  const next = (est.daily_order_counter || 0) + 1;
  if (next > MAX_COUNTER) {
    const err = new Error('Compteur journalier épuisé (999999). Clôturez la journée.');
    err.status = 400;
    throw err;
  }

  const code = formatDailyCode(next);
  await Establishment.updateOne(
    { _id: est._id },
    { $set: { daily_order_counter: next } }
  );

  order.daily_code = code;
  order.daily_code_session = est.daily_order_session;
  await order.save();

  return { code, isNew: true };
}

async function resetDailyCodeSession(establishmentId) {
  const est = await getEstablishmentSession(establishmentId);
  const nextSession = (est.daily_order_session || 1) + 1;
  await Establishment.updateOne(
    { _id: establishmentId },
    {
      $set: {
        daily_order_counter: 0,
        daily_order_session: nextSession,
      },
    }
  );
  return nextSession;
}

async function findOrderByDailyCode(establishmentId, codeInput) {
  const code = normalizeDailyCode(codeInput);
  if (!code) {
    const err = new Error('Code invalide.');
    err.status = 400;
    throw err;
  }

  const est = await getEstablishmentSession(establishmentId);
  const order = await Order.findOne({
    establishment: establishmentId,
    daily_code: code,
    daily_code_session: est.daily_order_session,
    is_deleted: false,
    merged_into: { $in: [null, undefined] },
  })
    .populate('table', 'name')
    .populate('waiter', 'fullname')
    .populate('customer', 'name phone');

  if (!order) {
    const err = new Error('Aucune commande pour ce code aujourd\'hui.');
    err.status = 404;
    throw err;
  }

  const items = await OrderItem.find({ order: order._id });
  const { canPayOrder } = require('./payment');
  const check = canPayOrder(order, items);
  return {
    order,
    items,
    can_pay: check.ok || order.payment_status === 'partial',
    pay_block_reason: check.ok ? null : check.reason,
  };
}

const DAILY_CODE_TYPE_LABELS = {
  dine_in: 'Sur place',
  takeaway: 'A emporter',
  delivery: 'Livraison',
};

function buildDailyCodeSlipPayload(establishment, order, dailyCode) {
  const meta = [];
  if (order.table) {
    meta.push(`Table : ${order.table?.name || order.table}`);
  }
  meta.push(`Type : ${DAILY_CODE_TYPE_LABELS[order.type] || order.type}`);
  meta.push(`Commande : ${order.order_number}`);
  meta.push(`Date : ${new Date().toLocaleString('fr-FR')}`);
  meta.push('Conservez ce ticket pour le paiement');

  return {
    title: establishment.name || 'TouDev',
    subtitle: 'CODE DU JOUR',
    code: dailyCode,
    meta,
    footer: 'Merci',
  };
}

async function printDailyCodeSlip(establishmentId, orderId, dailyCode) {
  const establishment = await Establishment.findById(establishmentId).select('caisse_printer name');
  if (!isPrinterConfigured(establishment?.caisse_printer)) {
    return { skipped: true, reason: 'Imprimante caisse non configuree' };
  }

  const order = await Order.findById(orderId).populate('table', 'name');
  if (!order) {
    return { skipped: true, reason: 'Commande introuvable' };
  }

  const payload = buildDailyCodeSlipPayload(establishment, order, dailyCode);
  const buffer = buildDailyCodeSlipBuffer(payload);
  const printer = establishment.caisse_printer;
  const result = await sendBufferToPrinter(printer, buffer);
  return { printed: true, target: result.target };
}

module.exports = {
  CODE_LENGTH,
  normalizeDailyCode,
  formatDailyCode,
  assignDailyCodeIfNeeded,
  resetDailyCodeSession,
  maybeResetDailyCodeForCalendarDay,
  findOrderByDailyCode,
  printDailyCodeSlip,
  buildDailyCodeSlipPayload,
};
