const PDFDocument = require('pdfkit');
const { Order, OrderItem, Payment, Expense, Shift, DailyClosing, User } = require('../models');
const { getAnalyticsRange, startOfDay, endOfDay } = require('../utils/daterange');

const METHODS = ['cash', 'card', 'credit', 'debit'];
const ORDER_TYPES = ['dine_in', 'takeaway', 'delivery'];
const MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
const WEEKDAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

const STAFF_REPORT_ROLES = ['waiter', 'manager', 'submanager', 'cook', 'barman'];
const METRICS_ROLES = ['waiter', 'manager', 'submanager'];

const METHOD_LABELS = {
  cash: 'Espèces',
  card: 'Carte',
  credit: 'Crédit client',
  debit: 'Débit compte',
};

const TYPE_LABELS = {
  dine_in: 'Sur place',
  takeaway: 'À emporter',
  delivery: 'Livraison',
};

const PERIOD_LABELS = {
  day: 'Journalier',
  week: 'Hebdomadaire',
  month: 'Mensuel',
  year: 'Annuel',
};

const ROLE_SECTION_LABELS = {
  waiter: 'Serveurs',
  manager: 'Managers',
  submanager: 'Sous-managers',
  cook: 'Cuisine',
  barman: 'Bar',
};

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function emptyMethodTotals() {
  return { cash: 0, card: 0, credit: 0, debit: 0 };
}

function emptyTypeTotals() {
  return { dine_in: 0, takeaway: 0, delivery: 0 };
}

function buildBuckets(range) {
  const { period, from, to } = range;
  const buckets = [];

  if (period === 'day') {
    for (let h = 0; h < 24; h += 1) {
      const start = new Date(from);
      start.setHours(h, 0, 0, 0);
      const end = new Date(from);
      end.setHours(h, 59, 59, 999);
      buckets.push({
        key: String(h),
        label: `${String(h).padStart(2, '0')}h`,
        from: start,
        to: end,
        revenue: 0,
        orders: 0,
        payments: 0,
      });
    }
    return buckets;
  }

  if (period === 'week' || period === 'month') {
    const cursor = new Date(from);
    while (cursor <= to) {
      const start = new Date(cursor);
      start.setHours(0, 0, 0, 0);
      const end = new Date(cursor);
      end.setHours(23, 59, 59, 999);
      const label =
        period === 'week'
          ? WEEKDAYS_FR[cursor.getDay()]
          : String(cursor.getDate());
      buckets.push({
        key: start.toISOString().slice(0, 10),
        label,
        from: start,
        to: end,
        revenue: 0,
        orders: 0,
        payments: 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return buckets;
  }

  for (let m = 0; m < 12; m += 1) {
    const start = new Date(from.getFullYear(), m, 1, 0, 0, 0, 0);
    const end = new Date(from.getFullYear(), m + 1, 0, 23, 59, 59, 999);
    buckets.push({
      key: String(m),
      label: MONTHS_FR[m],
      from: start,
      to: end,
      revenue: 0,
      orders: 0,
      payments: 0,
    });
  }
  return buckets;
}

function findBucket(buckets, date) {
  const t = new Date(date).getTime();
  return buckets.find((b) => t >= b.from.getTime() && t <= b.to.getTime());
}

async function getDashboardAnalytics(establishmentId, { period = 'day', date } = {}) {
  const range = getAnalyticsRange(period, date);
  const { from, to } = range;
  const estId = establishmentId;

  const [payments, orders, expenses, voidedCount, topItems, recentPayments] = await Promise.all([
    Payment.find({
      establishment: estId,
      processed_at: { $gte: from, $lte: to },
      is_void: false,
      is_deleted: { $ne: true },
    }).lean(),
    Order.find({
      establishment: estId,
      createdAt: { $gte: from, $lte: to },
      is_deleted: { $ne: true },
    }).lean(),
    Expense.find({
      establishment: estId,
      expense_date: { $gte: from, $lte: to },
      is_deleted: false,
    }).lean(),
    Payment.countDocuments({
      establishment: estId,
      is_void: true,
      voided_at: { $gte: from, $lte: to },
    }),
    OrderItem.aggregate([
      {
        $match: {
          establishment: estId,
          createdAt: { $gte: from, $lte: to },
          status: { $nin: ['cancelled', 'rejected'] },
        },
      },
      {
        $group: {
          _id: '$name',
          qty: { $sum: '$quantity' },
          revenue: { $sum: '$line_total' },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
    ]),
    Payment.find({
      establishment: estId,
      processed_at: { $gte: from, $lte: to },
      is_void: false,
      is_deleted: { $ne: true },
    })
      .sort({ processed_at: -1 })
      .limit(12)
      .populate('processed_by', 'fullname')
      .populate('order', 'order_number type')
      .lean(),
  ]);

  const buckets = buildBuckets(range);
  const byMethod = emptyMethodTotals();
  const byOrderType = emptyTypeTotals();
  let revenue = 0;
  let discountTotal = 0;
  let serviceChargeTotal = 0;

  for (const p of payments) {
    revenue += p.amount || 0;
    discountTotal += p.discount_amount || 0;
    serviceChargeTotal += p.service_charge_amount || 0;
    if (METHODS.includes(p.method)) {
      byMethod[p.method] = round2((byMethod[p.method] || 0) + p.amount);
    }
    const bucket = findBucket(buckets, p.processed_at);
    if (bucket) {
      bucket.revenue = round2(bucket.revenue + (p.amount || 0));
      bucket.payments += 1;
    }
  }

  const ordersByStatus = {};
  let ordersCancelled = 0;
  let ordersPaid = 0;

  for (const o of orders) {
    ordersByStatus[o.status] = (ordersByStatus[o.status] || 0) + 1;
    if (o.status === 'cancelled') ordersCancelled += 1;
    if (o.status === 'paid' || o.payment_status === 'paid') ordersPaid += 1;
    if (ORDER_TYPES.includes(o.type)) {
      byOrderType[o.type] += 1;
    }
    const bucket = findBucket(buckets, o.createdAt);
    if (bucket) bucket.orders += 1;
  }

  const ordersCount = orders.length;
  const avgTicket = ordersPaid > 0 ? round2(revenue / ordersPaid) : 0;

  let expenseTotal = 0;
  const expensesByCategory = {};
  for (const e of expenses) {
    expenseTotal += e.amount || 0;
    expensesByCategory[e.category] = round2((expensesByCategory[e.category] || 0) + (e.amount || 0));
  }
  expenseTotal = round2(expenseTotal);

  return {
    period: range.period,
    from,
    to,
    summary: {
      revenue: round2(revenue),
      expense_total: expenseTotal,
      net_result: round2(revenue - expenseTotal),
      expenses_count: expenses.length,
      expenses_by_category: expensesByCategory,
      orders_count: ordersCount,
      orders_paid: ordersPaid,
      orders_cancelled: ordersCancelled,
      payments_count: payments.length,
      void_count: voidedCount,
      avg_ticket: avgTicket,
      discount_total: round2(discountTotal),
      service_charge_total: round2(serviceChargeTotal),
      by_method: Object.fromEntries(
        Object.entries(byMethod).map(([k, v]) => [k, round2(v)])
      ),
      by_order_type: byOrderType,
      orders_by_status: ordersByStatus,
    },
    series: buckets.map((b) => ({
      label: b.label,
      revenue: b.revenue,
      orders: b.orders,
      payments: b.payments,
    })),
    top_items: topItems.map((row) => ({
      name: row._id,
      qty: row.qty,
      revenue: round2(row.revenue),
    })),
    recent_payments: recentPayments.map((p) => ({
      _id: p._id,
      receipt_number: p.receipt_number,
      amount: round2(p.amount),
      method: p.method,
      processed_at: p.processed_at,
      processed_by: p.processed_by?.fullname,
      order_number: p.order?.order_number,
      order_type: p.order?.type,
    })),
  };
}

async function getClosingSummaryForRange(establishmentId, from, to) {
  const payments = await Payment.find({
    establishment: establishmentId,
    processed_at: { $gte: from, $lte: to },
    is_void: false,
    is_deleted: { $ne: true },
  });

  const voided = await Payment.countDocuments({
    establishment: establishmentId,
    voided_at: { $gte: from, $lte: to },
    is_void: true,
  });

  const totals = {
    cash: 0,
    card: 0,
    credit: 0,
    debit: 0,
    discount_total: 0,
    service_charge_total: 0,
    gross_total: 0,
    payment_count: payments.length,
    void_count: voided,
  };

  for (const p of payments) {
    totals[p.method] = (totals[p.method] || 0) + (p.amount || 0);
    totals.gross_total += p.amount || 0;
    totals.discount_total += p.discount_amount || 0;
    totals.service_charge_total += p.service_charge_amount || 0;
  }

  Object.keys(totals).forEach((k) => {
    if (typeof totals[k] === 'number' && !['payment_count', 'void_count'].includes(k)) {
      totals[k] = round2(totals[k]);
    }
  });

  const shifts = await Shift.find({
    establishment: establishmentId,
    clock_in: { $gte: from, $lte: to },
  }).select('_id');

  const closings = await DailyClosing.find({
    establishment: establishmentId,
    closing_date: { $gte: from, $lte: to },
    is_deleted: { $ne: true },
  }).select('closing_date');

  return {
    totals,
    shift_count: shifts.length,
    closed_days_count: closings.length,
  };
}

function parseDay(dateStr) {
  const anchor = dateStr ? new Date(`${dateStr}T12:00:00`) : new Date();
  const d = Number.isNaN(anchor.getTime()) ? new Date() : anchor;
  return { from: startOfDay(d), to: endOfDay(d) };
}

function isItemCancelled(status) {
  return ['cancelled', 'rejected'].includes(status);
}

async function getUserStaffMetrics(establishmentId, userId, from, to) {
  const orders = await Order.find({
    establishment: establishmentId,
    waiter: userId,
    createdAt: { $gte: from, $lte: to },
    is_deleted: { $ne: true },
  }).lean();

  const orderIds = orders.map((o) => o._id);
  const items = orderIds.length
    ? await OrderItem.find({
        order: { $in: orderIds },
        is_deleted: { $ne: true },
      }).lean()
    : [];

  const orderById = Object.fromEntries(orders.map((o) => [String(o._id), o]));

  let items_ordered = 0;
  let items_paid = 0;
  let items_cancelled = 0;
  let items_unpaid = 0;

  for (const item of items) {
    const qty = Number(item.quantity) || 0;
    const order = orderById[String(item.order)];
    if (!order) continue;

    items_ordered += qty;

    if (isItemCancelled(item.status)) {
      items_cancelled += qty;
      continue;
    }

    if (order.payment_status === 'paid' || order.status === 'paid') {
      items_paid += qty;
    } else if (order.status !== 'cancelled') {
      items_unpaid += qty;
    }
  }

  const shifts = await Shift.find({
    user: userId,
    establishment: establishmentId,
    clock_in: { $gte: from, $lte: to },
  }).select('clock_in clock_out is_active');

  const shiftMs = shifts.reduce((sum, s) => {
    const end = s.clock_out
      ? new Date(s.clock_out)
      : (s.is_active ? new Date() : new Date(s.clock_in));
    return sum + (end - new Date(s.clock_in));
  }, 0);

  return {
    orders_total: orders.length,
    orders_cancelled: orders.filter((o) => o.status === 'cancelled').length,
    items_ordered,
    items_paid,
    items_cancelled,
    items_unpaid,
    shift_count: shifts.length,
    shift_hours: round2(shiftMs / 3600000),
  };
}

async function getKitchenGlobals(establishmentId, from, to) {
  const items = await OrderItem.find({
    establishment: establishmentId,
    sent_to_kitchen_at: { $gte: from, $lte: to },
    is_deleted: { $ne: true },
    status: { $nin: ['cancelled', 'rejected'] },
  }).select('product_type quantity');

  let food_qty = 0;
  let drink_qty = 0;
  let food_lines = 0;
  let drink_lines = 0;

  for (const item of items) {
    const qty = Number(item.quantity) || 0;
    if (item.product_type === 'FOOD') {
      food_qty += qty;
      food_lines += 1;
    } else if (item.product_type === 'DRINK') {
      drink_qty += qty;
      drink_lines += 1;
    }
  }

  return {
    cuisine: { lines: food_lines, quantity: food_qty },
    bar: { lines: drink_lines, quantity: drink_qty },
  };
}

async function listStaffUsers(establishmentId, roleKey) {
  const filter = {
    establishment: establishmentId,
    is_deleted: false,
    status: 'actif',
  };
  const users = await User.find(filter)
    .populate('role', 'role_key name')
    .sort({ fullname: 1 })
    .lean();

  return users.filter((u) => {
    const key = u.role?.role_key;
    if (!STAFF_REPORT_ROLES.includes(key)) return false;
    if (roleKey && key !== roleKey) return false;
    return true;
  });
}

async function getStaffDailyReport(establishmentId, { date, mode = 'full', roleKey, userId } = {}) {
  const { from, to } = parseDay(date);
  const kitchen = await getKitchenGlobals(establishmentId, from, to);

  if (mode === 'person' && userId) {
    const user = await User.findOne({
      _id: userId,
      establishment: establishmentId,
      is_deleted: false,
    }).populate('role', 'role_key name');
    if (!user) {
      const err = new Error('Utilisateur introuvable.');
      err.status = 404;
      throw err;
    }

    const key = user.role?.role_key;
    const entry = {
      user_id: user._id,
      fullname: user.fullname,
      role_key: key,
      role_name: user.role?.name || key,
    };

    if (METRICS_ROLES.includes(key)) {
      entry.metrics = await getUserStaffMetrics(establishmentId, user._id, from, to);
    } else {
      const shifts = await Shift.find({
        user: user._id,
        establishment: establishmentId,
        clock_in: { $gte: from, $lte: to },
      });
      const shiftMs = shifts.reduce((sum, s) => {
        const end = s.clock_out
          ? new Date(s.clock_out)
          : (s.is_active ? new Date() : new Date(s.clock_in));
        return sum + (end - new Date(s.clock_in));
      }, 0);
      entry.metrics = {
        shift_count: shifts.length,
        shift_hours: round2(shiftMs / 3600000),
      };
    }

    return {
      date: from,
      from,
      to,
      mode,
      staff: [entry],
      kitchen,
    };
  }

  const users = await listStaffUsers(establishmentId, mode === 'role' ? roleKey : null);
  const staff = [];

  for (const user of users) {
    const key = user.role?.role_key;
    const entry = {
      user_id: user._id,
      fullname: user.fullname,
      role_key: key,
      role_name: user.role?.name || key,
    };

    if (METRICS_ROLES.includes(key)) {
      entry.metrics = await getUserStaffMetrics(establishmentId, user._id, from, to);
    } else {
      const shifts = await Shift.find({
        user: user._id,
        establishment: establishmentId,
        clock_in: { $gte: from, $lte: to },
      });
      const shiftMs = shifts.reduce((sum, s) => {
        const end = s.clock_out
          ? new Date(s.clock_out)
          : (s.is_active ? new Date() : new Date(s.clock_in));
        return sum + (end - new Date(s.clock_in));
      }, 0);
      entry.metrics = {
        shift_count: shifts.length,
        shift_hours: round2(shiftMs / 3600000),
      };
    }

    staff.push(entry);
  }

  return {
    date: from,
    from,
    to,
    mode,
    role_key: roleKey || null,
    staff,
    kitchen,
  };
}

function fmtMad(amount, currency = 'MAD') {
  return `${Number(amount || 0).toFixed(2)} ${currency}`;
}

function fmtDate(d) {
  if (!d) return '—';
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function fmtDateTime(d) {
  if (!d) return '—';
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function createPdfBuffer(renderFn, docOptions) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument(docOptions);
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    renderFn(doc);
    doc.end();
  });
}

function ensureSpace(doc, needed = 40) {
  if (doc.y + needed > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
}

function drawLegalHeader(doc, establishment, title, subtitle) {
  const name = establishment.legal_name || establishment.name || 'Établissement';
  doc.fontSize(11).font('Helvetica-Bold').text(name, { align: 'center' });
  doc.font('Helvetica').fontSize(8);
  if (establishment.address) doc.text(establishment.address, { align: 'center' });
  const legal = [];
  if (establishment.identifiant_fiscal) {
    legal.push(`${establishment.tax_id_label || 'IF'}: ${establishment.identifiant_fiscal}`);
  }
  if (establishment.ice) legal.push(`ICE: ${establishment.ice}`);
  if (establishment.patente) legal.push(`Patente: ${establishment.patente}`);
  if (establishment.rc) legal.push(`RC: ${establishment.rc}`);
  if (legal.length) doc.text(legal.join(' | '), { align: 'center' });
  doc.moveDown(0.4);
  doc.fontSize(10).font('Helvetica-Bold').text(title, { align: 'center' });
  if (subtitle) {
    doc.font('Helvetica').fontSize(8).text(subtitle, { align: 'center' });
  }
  doc.moveDown(0.6);
  doc.moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .stroke();
  doc.moveDown(0.5);
}

function drawKeyValue(doc, label, value, { boldValue = false } = {}) {
  ensureSpace(doc, 14);
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const y = doc.y;
  doc.font('Helvetica').fontSize(8).text(label, x, y, { width: width * 0.55, lineBreak: false });
  doc.font(boldValue ? 'Helvetica-Bold' : 'Helvetica')
    .text(String(value), x + width * 0.55, y, { width: width * 0.45, align: 'right', lineBreak: false });
  doc.y = y + 11;
}

function drawSectionTitle(doc, title) {
  ensureSpace(doc, 24);
  doc.moveDown(0.3);
  doc.font('Helvetica-Bold').fontSize(9).text(title);
  doc.moveDown(0.2);
}

function drawTableHeader(doc, cols) {
  ensureSpace(doc, 20);
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  let offset = x;
  doc.font('Helvetica-Bold').fontSize(7);
  cols.forEach((col) => {
    const w = width * col.width;
    doc.text(col.label, offset, doc.y, { width: w, align: col.align || 'left' });
    offset += w;
  });
  doc.moveDown(0.2);
  doc.y += 10;
}

function drawTableRow(doc, cols, values) {
  ensureSpace(doc, 14);
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  let offset = x;
  const y = doc.y;
  doc.font('Helvetica').fontSize(7);
  cols.forEach((col, i) => {
    const w = width * col.width;
    doc.text(String(values[i] ?? ''), offset, y, { width: w, align: col.align || 'left' });
    offset += w;
  });
  doc.y = y + 11;
}

function renderBusinessPdf(doc, establishment, analytics, closing) {
  const currency = establishment.currency || 'MAD';
  const s = analytics.summary || {};
  const periodLabel = PERIOD_LABELS[analytics.period] || analytics.period;
  const subtitle = `${periodLabel} — ${fmtDate(analytics.from)} au ${fmtDate(analytics.to)}`;

  drawLegalHeader(doc, establishment, 'Rapport d\'activité', subtitle);

  drawSectionTitle(doc, 'Synthèse');
  drawKeyValue(doc, 'Chiffre d\'affaires', fmtMad(s.revenue, currency), { boldValue: true });
  drawKeyValue(doc, 'Dépenses', fmtMad(s.expense_total, currency));
  drawKeyValue(doc, 'Résultat net', fmtMad(s.net_result, currency), { boldValue: true });
  drawKeyValue(doc, 'Commandes', s.orders_count ?? 0);
  drawKeyValue(doc, 'Commandes payées', s.orders_paid ?? 0);
  drawKeyValue(doc, 'Commandes annulées', s.orders_cancelled ?? 0);
  drawKeyValue(doc, 'Paiements', s.payments_count ?? 0);
  drawKeyValue(doc, 'Ticket moyen', fmtMad(s.avg_ticket, currency));
  drawKeyValue(doc, 'Remises', fmtMad(s.discount_total, currency));
  drawKeyValue(doc, 'Service', fmtMad(s.service_charge_total, currency));

  drawSectionTitle(doc, 'Paiements par mode');
  Object.entries(s.by_method || {}).forEach(([key, value]) => {
    if (Number(value) > 0) {
      drawKeyValue(doc, METHOD_LABELS[key] || key, fmtMad(value, currency));
    }
  });

  drawSectionTitle(doc, 'Commandes par type');
  Object.entries(s.by_order_type || {}).forEach(([key, value]) => {
    if (Number(value) > 0) {
      drawKeyValue(doc, TYPE_LABELS[key] || key, value);
    }
  });

  if (s.expenses_by_category && Object.keys(s.expenses_by_category).length) {
    drawSectionTitle(doc, 'Dépenses par catégorie');
    Object.entries(s.expenses_by_category).forEach(([cat, amount]) => {
      drawKeyValue(doc, cat, fmtMad(amount, currency));
    });
  }

  if ((analytics.top_items || []).length) {
    drawSectionTitle(doc, 'Top articles');
    const cols = [
      { label: 'Article', width: 0.55 },
      { label: 'Qté', width: 0.15, align: 'right' },
      { label: 'CA', width: 0.3, align: 'right' },
    ];
    drawTableHeader(doc, cols);
    analytics.top_items.slice(0, 15).forEach((row) => {
      drawTableRow(doc, cols, [row.name, row.qty, fmtMad(row.revenue, currency)]);
    });
  }

  if ((analytics.series || []).length) {
    drawSectionTitle(doc, 'Évolution');
    const cols = [
      { label: 'Période', width: 0.35 },
      { label: 'CA', width: 0.25, align: 'right' },
      { label: 'Cmd', width: 0.2, align: 'right' },
      { label: 'Paie.', width: 0.2, align: 'right' },
    ];
    drawTableHeader(doc, cols);
    analytics.series.forEach((row) => {
      drawTableRow(doc, cols, [
        row.label,
        fmtMad(row.revenue, currency),
        row.orders ?? 0,
        row.payments ?? 0,
      ]);
    });
  }

  const ct = closing.totals || {};
  drawSectionTitle(doc, 'Caisse / clôture');
  drawKeyValue(doc, 'Total encaissé', fmtMad(ct.gross_total, currency), { boldValue: true });
  drawKeyValue(doc, 'Espèces', fmtMad(ct.cash, currency));
  drawKeyValue(doc, 'Carte', fmtMad(ct.card, currency));
  drawKeyValue(doc, 'Crédit client', fmtMad(ct.credit, currency));
  drawKeyValue(doc, 'Débit compte', fmtMad(ct.debit, currency));
  drawKeyValue(doc, 'Annulations paiement', ct.void_count ?? 0);
  drawKeyValue(doc, 'Shifts enregistrés', closing.shift_count ?? 0);
  if (analytics.period !== 'day') {
    drawKeyValue(doc, 'Jours clôturés', closing.closed_days_count ?? 0);
  }

  doc.moveDown(1);
  doc.font('Helvetica').fontSize(7).text(`Généré le ${fmtDateTime(new Date())}`, { align: 'center' });
}

function renderStaffPersonMetrics(doc, metrics) {
  if (!metrics) return;
  if (metrics.orders_total != null) {
    drawKeyValue(doc, 'Commandes', metrics.orders_total);
    drawKeyValue(doc, 'Annulations cmd', metrics.orders_cancelled);
    drawKeyValue(doc, 'Articles commandés', metrics.items_ordered);
    drawKeyValue(doc, 'Articles payés', metrics.items_paid);
    drawKeyValue(doc, 'Articles annulés', metrics.items_cancelled);
    drawKeyValue(doc, 'Articles impayés', metrics.items_unpaid);
  }
  if (metrics.shift_count != null) {
    drawKeyValue(doc, 'Shifts', metrics.shift_count);
    drawKeyValue(doc, 'Heures shift', `${Number(metrics.shift_hours || 0).toFixed(2)} h`);
  }
}

function renderStaffPdf(doc, establishment, report) {
  const subtitle = fmtDate(report.from);
  drawLegalHeader(doc, establishment, 'Rapport personnel journalier', subtitle);

  const grouped = {};
  for (const entry of report.staff || []) {
    const key = entry.role_key || 'other';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(entry);
  }

  const roleOrder = ['waiter', 'manager', 'submanager', 'cook', 'barman'];
  for (const roleKey of roleOrder) {
    const entries = grouped[roleKey];
    if (!entries?.length) continue;

    drawSectionTitle(doc, ROLE_SECTION_LABELS[roleKey] || roleKey);
    for (const entry of entries) {
      ensureSpace(doc, 60);
      doc.font('Helvetica-Bold').fontSize(8).text(entry.fullname || '—');
      doc.font('Helvetica').fontSize(7).text(entry.role_name || roleKey);
      doc.moveDown(0.2);
      renderStaffPersonMetrics(doc, entry.metrics);
      doc.moveDown(0.4);
      doc.moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .strokeColor('#cccccc')
        .stroke()
        .strokeColor('#000000');
      doc.moveDown(0.3);
    }
  }

  const kitchen = report.kitchen || {};
  if (kitchen.cuisine) {
    drawSectionTitle(doc, 'Cuisine (global)');
    drawKeyValue(doc, 'Lignes envoyées', kitchen.cuisine.lines);
    drawKeyValue(doc, 'Quantité plats', kitchen.cuisine.quantity);
  }
  if (kitchen.bar) {
    drawSectionTitle(doc, 'Bar (global)');
    drawKeyValue(doc, 'Lignes envoyées', kitchen.bar.lines);
    drawKeyValue(doc, 'Quantité boissons', kitchen.bar.quantity);
  }

  doc.moveDown(0.8);
  doc.font('Helvetica').fontSize(6).text(`Généré le ${fmtDateTime(new Date())}`, { align: 'center' });
}

async function buildBusinessPdf(establishment, analytics, closing) {
  return createPdfBuffer(
    (doc) => renderBusinessPdf(doc, establishment, analytics, closing),
    { size: 'A4', margin: 40 }
  );
}

async function buildStaffPdf(establishment, report) {
  const widthPt = Math.round(80 * 2.83465);
  return createPdfBuffer(
    (doc) => renderStaffPdf(doc, establishment, report),
    { size: [widthPt, 841.89], margin: 12 }
  );
}

function renderWaiterDailyClosePdf(doc, establishment, report) {
  const currency = report.currency || establishment?.currency || 'MAD';
  const subtitle = fmtDate(report.date);
  drawLegalHeader(doc, establishment, 'Clôture du jour — Serveur', subtitle);

  const waiterName = report.waiter?.fullname || '—';
  doc.font('Helvetica-Bold').fontSize(8).text(`Serveur : ${waiterName}`);
  doc.moveDown(0.4);

  const orders = report.orders || {};
  const items = report.items || {};

  drawSectionTitle(doc, 'Synthèse financière');
  drawKeyValue(doc, 'Encaissé (payé)', fmtMad(items.earned_amount, currency), { boldValue: true });
  drawKeyValue(doc, 'Impayé', fmtMad(items.unpaid_amount, currency));
  drawKeyValue(doc, 'Retours (articles)', fmtMad(items.returned_amount, currency));
  drawKeyValue(doc, 'Commandes annulées', fmtMad(orders.canceled_amount, currency));
  drawKeyValue(doc, 'Total perdu', fmtMad(items.lost_amount, currency), { boldValue: true });
  drawKeyValue(doc, 'CA commandes envoyées', fmtMad(orders.total_amount, currency));

  if ((report.shifts || []).length) {
    drawSectionTitle(doc, 'Shifts / caisses');
    report.shifts.forEach((shift, index) => {
      const inLabel = shift.clock_in
        ? new Date(shift.clock_in).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        : '—';
      const outLabel = shift.clock_out
        ? new Date(shift.clock_out).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        : 'En cours';
      drawKeyValue(doc, `Shift ${index + 1}`, `${inLabel} → ${outLabel}`);
      drawKeyValue(doc, 'Fond de caisse départ', fmtMad(shift.opening_amount, currency));
      drawKeyValue(doc, 'Clôture caisse', fmtMad(shift.closing_amount, currency));
    });
  }

  drawSectionTitle(doc, 'Commandes');
  drawKeyValue(doc, 'Total envoyées', orders.sent ?? 0);
  drawKeyValue(doc, 'Annulées', orders.canceled ?? 0);
  drawKeyValue(doc, 'Impayées', orders.unpaid ?? 0);
  drawKeyValue(doc, 'Payées', orders.paid ?? 0);
  drawKeyValue(doc, 'Montant total', fmtMad(orders.total_amount, currency), { boldValue: true });

  drawSectionTitle(doc, 'Articles');
  drawKeyValue(doc, 'Articles envoyés', items.sent_total ?? 0);
  drawKeyValue(doc, 'Articles payés', items.paid_total ?? 0);
  drawKeyValue(doc, 'Articles impayés', items.unpaid_total ?? 0);
  drawKeyValue(doc, 'Articles retournés', items.returned_total ?? 0);
  drawKeyValue(doc, 'Montant articles commandés', fmtMad(items.ordered_amount, currency), { boldValue: true });
  drawKeyValue(doc, 'Montant articles payés', fmtMad(items.paid_amount, currency));
  drawKeyValue(doc, 'Montant articles impayés', fmtMad(items.unpaid_amount, currency));

  if ((items.detail_by_name || items.sent_by_name || []).length) {
    drawSectionTitle(doc, 'Détail par article');
    const detailRows = items.detail_by_name?.length
      ? items.detail_by_name
      : (items.sent_by_name || []).map((row) => ({
        name: row.name,
        ordered_qty: row.quantity,
        ordered_amount: row.amount,
        returned_qty: 0,
        returned_amount: 0,
        paid_qty: 0,
        paid_amount: 0,
        unpaid_qty: 0,
        unpaid_amount: 0,
      }));
    const cols = [
      { label: 'Article', width: 0.34 },
      { label: 'Cmd', width: 0.16, align: 'right' },
      { label: 'Ret', width: 0.16, align: 'right' },
      { label: 'Payé', width: 0.17, align: 'right' },
      { label: 'Imp', width: 0.17, align: 'right' },
    ];
    drawTableHeader(doc, cols);
    for (const row of detailRows) {
      ensureSpace(doc, 14);
      drawTableRow(doc, cols, [
        row.name,
        `${row.ordered_qty} · ${fmtMad(row.ordered_amount, currency)}`,
        row.returned_qty ? `${row.returned_qty} · ${fmtMad(row.returned_amount, currency)}` : '—',
        row.paid_qty ? `${row.paid_qty} · ${fmtMad(row.paid_amount, currency)}` : '—',
        row.unpaid_qty ? `${row.unpaid_qty} · ${fmtMad(row.unpaid_amount, currency)}` : '—',
      ]);
    }
  }

  if (!items.detail_by_name?.length && (items.returned_by_name || []).length) {
    drawSectionTitle(doc, 'Détail articles retournés');
    const cols = [
      { label: 'Article', width: 0.5 },
      { label: 'Qté', width: 0.15, align: 'right' },
      { label: 'Montant', width: 0.35, align: 'right' },
    ];
    drawTableHeader(doc, cols);
    for (const row of items.returned_by_name) {
      ensureSpace(doc, 14);
      drawTableRow(doc, cols, [row.name, row.quantity, fmtMad(row.amount, currency)]);
    }
  }

  doc.moveDown(0.8);
  doc.font('Helvetica').fontSize(6).text(`Généré le ${fmtDateTime(new Date())}`, { align: 'center' });
}

async function buildWaiterDailyClosePdf(establishment, report) {
  const widthPt = Math.round(80 * 2.83465);
  const heightPt = Math.round(3276 * 2.83465);
  return createPdfBuffer(
    (doc) => renderWaiterDailyClosePdf(doc, establishment, report),
    { size: [widthPt, heightPt], margin: 12 },
  );
}

module.exports = {
  STAFF_REPORT_ROLES,
  METRICS_ROLES,
  getDashboardAnalytics,
  getClosingSummaryForRange,
  getStaffDailyReport,
  getKitchenGlobals,
  getUserStaffMetrics,
  listStaffUsers,
  buildBusinessPdf,
  buildStaffPdf,
  buildWaiterDailyClosePdf,
};
