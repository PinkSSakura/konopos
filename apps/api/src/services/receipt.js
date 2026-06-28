const { Order, OrderItem, Establishment, Payment, Customer } = require('../models');
const { calcOrderAmounts, getBillableItems } = require('./payment');

function calcTaxBreakdown(totalTtc, taxRate = 20) {
  const rate = taxRate / 100;
  const totalHt = Math.round((totalTtc / (1 + rate)) * 100) / 100;
  const taxAmount = Math.round((totalTtc - totalHt) * 100) / 100;
  return {
    tax_rate: taxRate,
    total_ht: totalHt,
    tax_amount: taxAmount,
    total_ttc: totalTtc,
  };
}

function formatLineItem(item) {
  const extras = [];
  if (item.variant?.name) extras.push(item.variant.name);
  if (item.modifiers?.length) {
    item.modifiers.forEach((m) => extras.push(m.name));
  }
  return {
    _id: item._id,
    name: item.name,
    quantity: item.quantity,
    unit_price: item.unit_price,
    line_total: item.line_total,
    extras,
    notes: item.notes,
    status: item.status,
  };
}

const TYPE_LABELS = {
  dine_in: 'Sur place',
  takeaway: 'À emporter',
  delivery: 'Livraison',
};

async function buildReceiptPayload(orderId, establishmentId, paymentId = null, options = {}) {
  const order = await Order.findOne({ _id: orderId, establishment: establishmentId, is_deleted: false })
    .populate('table', 'name')
    .populate('waiter', 'fullname')
    .populate('customer', 'name phone balance');

  if (!order) {
    const err = new Error('Commande introuvable.');
    err.status = 404;
    throw err;
  }

  const establishment = await Establishment.findById(establishmentId).select(
    'name address phone email website logo patente ice identifiant_fiscal rc currency tax_rate'
  );

  const items = await OrderItem.find({ order: orderId }).sort({ createdAt: 1 });
  const billableItems = options.include_cancelled_items
    ? items.filter((i) => i.status !== 'rejected')
    : getBillableItems(items);
  const amounts = calcOrderAmounts(order, items);

  let payment = null;
  let payments_summary = [];

  const allPayments = await Payment.find({ order: orderId, is_void: false }).sort({ processed_at: 1 });
  payments_summary = allPayments.map((p) => ({
    method: p.method,
    amount: p.amount,
    receipt_number: p.receipt_number,
    processed_at: p.processed_at,
  }));

  if (paymentId) {
    payment = allPayments.find((p) => String(p._id) === String(paymentId));
  } else if (allPayments.length) {
    payment = allPayments[allPayments.length - 1];
  }

  if (payment) {
    await payment.populate('processed_by', 'fullname');
  }

  const tax = calcTaxBreakdown(amounts.total_due, establishment?.tax_rate ?? 20);

  return {
    establishment: {
      name: establishment?.name,
      address: establishment?.address,
      phone: establishment?.phone,
      email: establishment?.email,
      website: establishment?.website,
      logo: establishment?.logo,
      patente: establishment?.patente,
      ice: establishment?.ice,
      identifiant_fiscal: establishment?.identifiant_fiscal,
      rc: establishment?.rc,
      currency: establishment?.currency || 'MAD',
    },
    order: {
      _id: order._id,
      order_number: order.order_number,
      daily_code: order.daily_code,
      receipt_number: payment?.receipt_number || order.receipt_number,
      type: order.type,
      type_label: TYPE_LABELS[order.type] || order.type,
      status: order.status,
      payment_status: order.payment_status,
      table: order.table?.name,
      waiter: order.waiter?.fullname,
      notes: order.notes,
      created_at: order.createdAt,
      paid_at: order.paid_at,
    },
    customer: order.customer,
    items: billableItems.map(formatLineItem),
    amounts,
    tax,
    payment: payment
      ? {
          _id: payment._id,
          method: payment.method,
          amount: payment.amount,
          amount_tendered: payment.amount_tendered,
          change_due: payment.change_due,
          processed_at: payment.processed_at,
          processed_by: payment.processed_by,
          receipt_number: payment.receipt_number,
          discount_amount: payment.discount_amount,
          service_charge_amount: payment.service_charge_amount,
        }
      : null,
    payments_summary,
    is_paid: order.payment_status === 'paid',
  };
}

async function getReceiptForOrder(orderId, establishmentId, paymentId = null, options = {}) {
  return buildReceiptPayload(orderId, establishmentId, paymentId, options);
}

module.exports = {
  calcTaxBreakdown,
  buildReceiptPayload,
  getReceiptForOrder,
};
