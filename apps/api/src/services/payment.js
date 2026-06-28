const {
  Order,
  OrderItem,
  Payment,
  Customer,
  Establishment,
  Shift,
  DailyClosing,
  User,
} = require('../models');
const { ORDER_TYPES } = require('../models/order.model');
const { generateReceiptNumber } = require('../utils/codes');
const { syncTableFromOrders } = require('./order');
const { resetDailyCodeSession, findOrderByDailyCode } = require('./dailycode');

const METHODS = ['cash', 'card', 'credit', 'debit'];

const PAYMENT_TYPE_LABELS = {
  dine_in: 'Sur place',
  takeaway: 'À emporter',
  delivery: 'Livraison',
};

function getBillableItems(items) {
  return items.filter((i) => !['cancelled', 'rejected'].includes(i.status));
}

function itemsReadyForPaymentType(order, billableItems) {
  if (!billableItems.length) return false;

  if (order.type === 'dine_in') {
    return billableItems.every((i) => i.status === 'served');
  }
  if (order.type === 'takeaway') {
    return billableItems.every((i) => ['ready', 'served'].includes(i.status));
  }
  if (order.type === 'delivery') {
    return order.status === 'delivered';
  }
  return false;
}

function canPayOrder(order, items) {
  if (order.payment_status === 'paid' || order.status === 'paid') {
    return { ok: false, reason: 'Commande déjà réglée.' };
  }
  if (order.status === 'cancelled') {
    return { ok: false, reason: 'Commande annulée.' };
  }
  if (order.merged_into) {
    return { ok: false, reason: 'Commande fusionnée dans une autre.' };
  }

  const billable = getBillableItems(items);
  if (!billable.length) {
    return { ok: false, reason: 'Aucun article à encaisser.' };
  }

  const amounts = calcOrderAmounts(order, billable);
  if (amounts.balance_due <= 0.001) {
    return { ok: false, reason: 'Commande déjà réglée.' };
  }

  if (order.payment_status === 'partial') {
    return { ok: true };
  }

  if (!itemsReadyForPaymentType(order, billable)) {
    if (order.type === 'delivery') {
      return { ok: false, reason: 'Marquez la commande comme livrée avant l\'encaissement.' };
    }
    if (order.type === 'takeaway') {
      return { ok: false, reason: 'La commande doit être prête (préparation terminée).' };
    }
    return { ok: false, reason: 'Tous les articles doivent être servis.' };
  }

  return { ok: true };
}

function calcOrderAmounts(order, items, adjustments = {}) {
  const billable = getBillableItems(items);
  const subtotal = billable.reduce((s, i) => s + i.line_total, 0);

  const discountPercent = adjustments.discount_percent ?? order.discount_percent ?? 0;
  const discountAmount = adjustments.discount_amount ?? order.discount_amount ?? 0;
  let discount = discountAmount;
  if (discountPercent > 0) {
    discount = Math.round(subtotal * (discountPercent / 100) * 100) / 100;
  }
  discount = Math.min(discount, subtotal);

  const afterDiscount = Math.round((subtotal - discount) * 100) / 100;

  const servicePercent = adjustments.service_charge_percent ?? order.service_charge_percent ?? 0;
  const serviceAmount = adjustments.service_charge_amount ?? order.service_charge_amount ?? 0;
  let serviceCharge = serviceAmount;
  if (servicePercent > 0) {
    serviceCharge = Math.round(afterDiscount * (servicePercent / 100) * 100) / 100;
  }

  const totalDue = Math.round((afterDiscount + serviceCharge) * 100) / 100;
  const amountPaid = order.amount_paid || 0;
  const balanceDue = Math.round((totalDue - amountPaid) * 100) / 100;

  return {
    subtotal,
    discount,
    discount_percent: discountPercent,
    discount_amount: discountAmount,
    service_charge: serviceCharge,
    service_charge_percent: servicePercent,
    service_charge_amount: serviceAmount,
    total_due: totalDue,
    amount_paid: amountPaid,
    balance_due: Math.max(0, balanceDue),
  };
}

async function getActiveShift(userId, establishmentId) {  return Shift.findOne({
    user: userId,
    establishment: establishmentId,
    is_active: true,
  });
}

async function applyCustomerBalance(customerId, method, amount) {
  if (!customerId) return;
  const customer = await Customer.findById(customerId);
  if (!customer) return;

  if (method === 'credit') {
    customer.balance = Math.round((customer.balance + amount) * 100) / 100;
  } else if (method === 'debit') {
    customer.balance = Math.round((customer.balance - amount) * 100) / 100;
  }
  await customer.save();
}

async function reverseCustomerBalance(customerId, method, amount) {
  if (!customerId) return;
  const customer = await Customer.findById(customerId);
  if (!customer) return;

  if (method === 'credit') {
    customer.balance = Math.round((customer.balance - amount) * 100) / 100;
  } else if (method === 'debit') {
    customer.balance = Math.round((customer.balance + amount) * 100) / 100;
  }
  await customer.save();
}

async function listReadyToPay(establishmentId, user = null) {
  const filter = {
    establishment: establishmentId,
    is_deleted: false,
    payment_status: { $in: ['unpaid', 'partial'] },
    status: { $nin: ['open', 'cancelled', 'paid'] },
    merged_into: { $in: [null, undefined] },
  };

  const {
    enforcesWaiterOwnership,
    bypassesOrderOwnership,
    waiterOwnershipFilter,
  } = require('../utils/orderownership');
  if (user && enforcesWaiterOwnership(user) && !bypassesOrderOwnership(user)) {
    Object.assign(filter, waiterOwnershipFilter(user._id));
  }

  const orders = await Order.find(filter)
    .populate('table', 'name')
    .populate('waiter', 'fullname')
    .populate('customer', 'name phone balance')
    .sort({ updatedAt: -1 })
    .limit(200);

  const results = [];
  for (const order of orders) {
    const items = await OrderItem.find({ order: order._id });
    const check = canPayOrder(order, items);
    const amounts = calcOrderAmounts(order, items);
    results.push({
      order,
      can_pay: check.ok,
      pay_block_reason: check.reason,
      amounts: {
        balance_due: amounts.balance_due,
        total_due: amounts.total_due,
        amount_paid: amounts.amount_paid,
      },
    });
  }

  return results.filter((r) => r.can_pay);
}

async function processCheckout(establishmentId, orderId, user, body) {
  const order = await Order.findOne({ _id: orderId, establishment: establishmentId, is_deleted: false });
  if (!order) {
    const err = new Error('Commande introuvable.');
    err.status = 404;
    throw err;
  }

  if (order.payment_status === 'paid') {
    const err = new Error('Commande déjà réglée.');
    err.status = 400;
    throw err;
  }

  const items = await OrderItem.find({ order: order._id });
  const check = canPayOrder(order, items);
  if (!check.ok && order.payment_status !== 'partial') {
    const err = new Error(check.reason);
    err.status = 400;
    throw err;
  }

  const adjustments = {
    discount_percent: body.discount_percent,
    discount_amount: body.discount_amount,
    service_charge_percent: body.service_charge_percent,
    service_charge_amount: body.service_charge_amount,
  };

  const amounts = calcOrderAmounts(order, items, adjustments);
  if (amounts.balance_due <= 0 && order.payment_status === 'paid') {
    const err = new Error('Commande déjà réglée.');
    err.status = 400;
    throw err;
  }

  const isComplimentary = amounts.balance_due <= 0.001;

  let paymentLines = body.payments?.length ? body.payments : [{
    method: body.method || 'cash',
    amount: body.amount ?? amounts.balance_due,
    amount_tendered: body.amount_tendered,
    item_ids: body.item_ids,
    split_label: body.split_label,
  }];

  if (isComplimentary) {
    paymentLines = [{
      method: paymentLines[0]?.method || body.method || 'cash',
      amount: 0,
      amount_tendered: 0,
    }];
  }

  const customerId = body.customer_id || order.customer;
  const hasPartial = !isComplimentary
    && paymentLines.some((p) => (p.amount ?? 0) < amounts.balance_due - 0.001);
  const isSplit = paymentLines.length > 1 || paymentLines.some((p) => p.item_ids?.length);

  if ((hasPartial || paymentLines.some((p) => ['credit', 'debit'].includes(p.method))) && !customerId) {
    const err = new Error('Client régulier requis pour paiement partiel ou compte client.');
    err.status = 400;
    throw err;
  }

  let totalPaying = 0;
  for (const line of paymentLines) {
    const method = line.method || 'cash';
    if (!METHODS.includes(method)) {
      const err = new Error('Mode de paiement invalide.');
      err.status = 400;
      throw err;
    }
    const amt = Math.round(Number(line.amount) * 100) / 100;
    if (!Number.isFinite(amt) || amt < 0) {
      const err = new Error('Montant de paiement invalide.');
      err.status = 400;
      throw err;
    }
    if (isComplimentary) {
      if (amt > 0.001) {
        const err = new Error('Le total des paiements dépasse le solde dû.');
        err.status = 400;
        throw err;
      }
    } else if (amt <= 0) {
      const err = new Error('Montant de paiement invalide.');
      err.status = 400;
      throw err;
    }
    totalPaying += amt;

    if (method === 'cash' && amt > 0) {
      const tendered = Number(line.amount_tendered);
      if (!Number.isFinite(tendered) || tendered < amt) {
        const err = new Error('Montant reçu insuffisant (espèces).');
        err.status = 400;
        throw err;
      }
    }
  }

  totalPaying = Math.round(totalPaying * 100) / 100;
  if (totalPaying > amounts.balance_due + 0.01) {
    const err = new Error('Le total des paiements dépasse le solde dû.');
    err.status = 400;
    throw err;
  }

  const establishment = await Establishment.findById(establishmentId).select('tax_rate caisse_printer name');
  const taxRate = establishment?.tax_rate ?? 20;
  const { calcTaxBreakdown } = require('./receipt');
  const tax = calcTaxBreakdown(amounts.total_due, taxRate);
  const shift = await getActiveShift(user._id, establishmentId);
  const now = new Date();

  const freshOrder = await Order.findById(order._id).select('payment_status amount_paid');
  if (freshOrder?.payment_status === 'paid') {
    const err = new Error('Commande déjà réglée.');
    err.status = 409;
    throw err;
  }

  const createdPayments = [];
  let lineIndex = 0;

  for (const line of paymentLines) {
    const method = line.method || 'cash';
    const amt = Math.round(Number(line.amount) * 100) / 100;
    let amountTendered = null;
    let changeDue = 0;

    if (method === 'cash') {
      amountTendered = Number(line.amount_tendered);
      changeDue = Math.round((amountTendered - amt) * 100) / 100;
    }

    const receiptNumber = await generateReceiptNumber(establishmentId);
    let kind = 'full';
    if (isSplit) kind = 'split';
    else if (totalPaying < amounts.balance_due - 0.001) kind = 'partial';

    let payment;
    try {
      payment = await Payment.create({
        establishment: establishmentId,
        order: order._id,
        shift: shift?._id,
        customer: customerId || undefined,
        receipt_number: receiptNumber,
        kind,
        method,
        amount: amt,
        amount_tendered: amountTendered,
        change_due: changeDue,
        discount_amount: lineIndex === 0 ? amounts.discount : 0,
        discount_percent: lineIndex === 0 ? amounts.discount_percent : 0,
        service_charge_amount: lineIndex === 0 ? amounts.service_charge : 0,
        service_charge_percent: lineIndex === 0 ? amounts.service_charge_percent : 0,
        order_subtotal: amounts.subtotal,
        order_total_before_payment: amounts.total_due,
        tax_rate: tax.tax_rate,
        total_ht: tax.total_ht,
        tax_amount: tax.tax_amount,
        total_ttc: tax.total_ttc,
        split_item_ids: line.item_ids || [],
        split_label: line.split_label,
        processed_by: user._id,
        processed_at: now,
        created_by: user._id,
      });
    } catch (err) {
      if (err.code === 11000) {
        const dup = new Error('Un paiement existe déjà pour cette commande. Actualisez la page.');
        dup.status = 409;
        throw dup;
      }
      throw err;
    }

    await applyCustomerBalance(customerId, method, amt);
    createdPayments.push(payment);
    lineIndex += 1;
  }

  const newAmountPaid = Math.round(((order.amount_paid || 0) + totalPaying) * 100) / 100;
  order.discount_amount = amounts.discount;
  order.discount_percent = amounts.discount_percent;
  order.service_charge_amount = amounts.service_charge;
  order.service_charge_percent = amounts.service_charge_percent;
  order.amount_paid = newAmountPaid;
  if (customerId) order.customer = customerId;

  const fullyPaid = newAmountPaid >= amounts.total_due - 0.01;

  if (fullyPaid) {
    const updated = await Order.findOneAndUpdate(
      { _id: order._id, payment_status: { $ne: 'paid' } },
      {
        $set: {
          discount_amount: amounts.discount,
          discount_percent: amounts.discount_percent,
          service_charge_amount: amounts.service_charge,
          service_charge_percent: amounts.service_charge_percent,
          amount_paid: newAmountPaid,
          customer: customerId || order.customer,
          payment_status: 'paid',
          status: 'paid',
          paid_at: now,
          receipt_number: createdPayments[createdPayments.length - 1].receipt_number,
          modified_by: user._id,
        },
      },
      { new: true }
    );

    if (!updated) {
      const err = new Error('Commande déjà réglée par un autre encaissement.');
      err.status = 409;
      throw err;
    }

    Object.assign(order, updated.toObject());

    if (order.table) {
      await syncTableFromOrders(order.table, establishmentId);
    }
  } else {
    order.payment_status = 'partial';
    order.modified_by = user._id;
    await order.save();
  }

  if (establishment?.caisse_printer?.enabled && establishment?.caisse_printer?.auto_print_on_payment) {
    const lastPayment = createdPayments[createdPayments.length - 1];
    const { printCaisseReceipt } = require('./print');
    printCaisseReceipt(establishmentId, order._id, lastPayment._id).catch((err) => {      console.error('Impression caisse:', err.message);
    });
  }

  return {
    order,
    payments: createdPayments,
    amounts: calcOrderAmounts(order, items, adjustments),
    fully_paid: fullyPaid,
  };
}

async function voidPayment(establishmentId, paymentId, user, reason) {
  const payment = await Payment.findOne({
    _id: paymentId,
    establishment: establishmentId,
    is_void: false,
  });
  if (!payment) {
    const err = new Error('Paiement introuvable.');
    err.status = 404;
    throw err;
  }

  payment.is_void = true;
  payment.voided_at = new Date();
  payment.voided_by = user._id;
  payment.void_reason = reason?.trim() || 'Annulation';
  await payment.save();

  await reverseCustomerBalance(payment.customer, payment.method, payment.amount);

  const order = await Order.findById(payment.order);
  const items = await OrderItem.find({ order: order._id });
  const activePayments = await Payment.find({ order: order._id, is_void: false });
  const amountPaid = activePayments.reduce((s, p) => s + p.amount, 0);
  order.amount_paid = Math.round(amountPaid * 100) / 100;

  const amounts = calcOrderAmounts(order, items);

  if (order.status === 'cancelled') {
    order.payment_status = 'unpaid';
    order.status = 'cancelled';
    order.paid_at = undefined;
    order.receipt_number = undefined;
  } else if (order.amount_paid >= amounts.total_due - 0.01) {
    order.payment_status = 'paid';
    order.status = 'paid';
  } else if (order.amount_paid > 0) {
    order.payment_status = 'partial';
    order.status = order.status === 'paid' ? 'served' : order.status;
    order.paid_at = undefined;
    order.receipt_number = undefined;
  } else {
    order.payment_status = 'unpaid';
    if (order.status === 'paid') {
      order.status = order.type === 'delivery' ? 'delivered' : 'served';
    }
    order.paid_at = undefined;
    order.receipt_number = undefined;
  }

  order.modified_by = user._id;
  await order.save();

  if (order.table) {
    await syncTableFromOrders(order.table, establishmentId);
  }

  return { payment, order };
}

async function listPaymentHistory(establishmentId, query = {}) {
  const filter = { establishment: establishmentId };

  if (query.from || query.to) {
    filter.processed_at = {};
    if (query.from) filter.processed_at.$gte = new Date(query.from);
    if (query.to) {
      const to = new Date(query.to);
      to.setHours(23, 59, 59, 999);
      filter.processed_at.$lte = to;
    }
  }
  if (query.method) filter.method = query.method;
  if (query.include_void !== 'true') filter.is_void = false;

  const q = query.q?.trim();
  if (q) {
    const or = [{ receipt_number: { $regex: q, $options: 'i' } }];
    const orders = await Order.find({
      establishment: establishmentId,
      order_number: { $regex: q, $options: 'i' },
    }).select('_id');
    if (orders.length) or.push({ order: { $in: orders.map((o) => o._id) } });
    const cashiers = await User.find({
      establishment: establishmentId,
      is_deleted: false,
      fullname: { $regex: q, $options: 'i' },
    }).select('_id');
    if (cashiers.length) or.push({ processed_by: { $in: cashiers.map((u) => u._id) } });
    const customers = await Customer.find({
      establishment: establishmentId,
      is_deleted: false,
      name: { $regex: q, $options: 'i' },
    }).select('_id');
    if (customers.length) or.push({ customer: { $in: customers.map((c) => c._id) } });
    filter.$or = or;
  }

  const payments = await Payment.find(filter)
    .populate('processed_by', 'fullname')
    .populate('voided_by', 'fullname')
    .populate('customer', 'name phone')
    .populate('shift')
    .populate({
      path: 'order',
      select: 'order_number type table waiter',
      populate: [
        { path: 'table', select: 'name' },
        { path: 'waiter', select: 'fullname' },
      ],
    })
    .sort({ processed_at: -1 })
    .limit(Number(query.limit) || 100);

  return payments.map((p) => ({
    _id: p._id,
    order_id: p.order?._id || p.order,
    receipt_number: p.receipt_number,
    processed_at: p.processed_at,
    order_number: p.order?.order_number,
    waiter: p.order?.waiter?.fullname,
    method: p.method,
    amount: p.amount,
    processed_by: p.processed_by?.fullname,
    is_void: p.is_void,
  }));
}

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

async function getDailySummary(establishmentId, dateStr) {
  const day = dateStr ? new Date(dateStr) : new Date();
  const from = startOfDay(day);
  const to = endOfDay(day);

  const payments = await Payment.find({
    establishment: establishmentId,
    processed_at: { $gte: from, $lte: to },
    is_void: false,
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
    amount_tendered_total: 0,
    change_total: 0,
    payment_count: payments.length,
    void_count: voided,
    gross_total: 0,
  };

  const shiftIds = new Set();

  for (const p of payments) {
    totals[p.method] = (totals[p.method] || 0) + p.amount;
    totals.gross_total += p.amount;
    totals.discount_total += p.discount_amount || 0;
    totals.service_charge_total += p.service_charge_amount || 0;
    totals.amount_tendered_total += p.amount_tendered || 0;
    totals.change_total += p.change_due || 0;
    if (p.shift) shiftIds.add(String(p.shift));
  }

  Object.keys(totals).forEach((k) => {
    if (typeof totals[k] === 'number' && k !== 'payment_count' && k !== 'void_count') {
      totals[k] = Math.round(totals[k] * 100) / 100;
    }
  });

  const existing = await DailyClosing.findOne({
    establishment: establishmentId,
    closing_date: from,
  });

  return {
    date: from,
    totals,
    shift_ids: [...shiftIds],
    payment_ids: payments.map((p) => p._id),
    is_closed: Boolean(existing),
    closing: existing,
  };
}

async function closeDay(establishmentId, user, dateStr, notes) {
  const summary = await getDailySummary(establishmentId, dateStr);
  if (summary.is_closed) {
    const err = new Error('Cette journée est déjà clôturée.');
    err.status = 400;
    throw err;
  }

  const closing = await DailyClosing.create({
    establishment: establishmentId,
    closing_date: summary.date,
    closed_by: user._id,
    closed_at: new Date(),
    totals: summary.totals,
    shift_ids: summary.shift_ids,
    payment_ids: summary.payment_ids,
    notes,
    created_by: user._id,
  });

  await resetDailyCodeSession(establishmentId);

  return closing;
}

module.exports = {
  getBillableItems,
  canPayOrder,
  calcOrderAmounts,
  itemsReadyForPaymentType,
  PAYMENT_TYPE_LABELS,
  ORDER_TYPES,
  listReadyToPay,
  processCheckout,
  voidPayment,
  listPaymentHistory,
  getDailySummary,
  closeDay,
  getActiveShift,
  findOrderByDailyCode,
};