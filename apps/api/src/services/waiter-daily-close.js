const { Order, OrderItem, Establishment, Shift } = require('../models');
const { getPeriodRange } = require('./shift');

function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

function waiterOrderFilter(userId) {
  const uid = String(userId);
  return {
    $or: [{ waiter: uid }, { created_by: uid }],
  };
}

function sumQuantities(items) {
  return items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
}

function isReturnedInRange(item, from, to) {
  if (!['cancelled', 'rejected'].includes(item.status)) return false;
  const at = item.cancelled_at ? new Date(item.cancelled_at) : new Date(item.updatedAt);
  return at >= from && at <= to;
}

function aggregateByName(items) {
  const map = new Map();
  for (const item of items) {
    const name = item.name || 'Article';
    const qty = Number(item.quantity) || 0;
    map.set(name, (map.get(name) || 0) + qty);
  }
  return [...map.entries()]
    .map(([name, quantity]) => ({
      name,
      quantity: round2(quantity),
    }))
    .sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name, 'fr'));
}

function aggregateByNameWithAmount(items) {
  const map = new Map();
  for (const item of items) {
    const name = item.name || 'Article';
    const qty = Number(item.quantity) || 0;
    const amount = Number(item.line_total) || 0;
    const prev = map.get(name) || { quantity: 0, amount: 0 };
    map.set(name, {
      quantity: prev.quantity + qty,
      amount: prev.amount + amount,
    });
  }
  return [...map.entries()]
    .map(([name, { quantity, amount }]) => ({
      name,
      quantity: round2(quantity),
      amount: round2(amount),
    }))
    .sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name, 'fr'));
}

function emptyDetailBucket() {
  return {
    ordered_qty: 0,
    ordered_amount: 0,
    returned_qty: 0,
    returned_amount: 0,
    paid_qty: 0,
    paid_amount: 0,
    unpaid_qty: 0,
    unpaid_amount: 0,
  };
}

function aggregateDetailByName(itemsSent, itemsReturned, orderById) {
  const map = new Map();
  const bucket = (name) => {
    const key = name || 'Article';
    if (!map.has(key)) map.set(key, emptyDetailBucket());
    return map.get(key);
  };

  for (const item of itemsSent) {
    if (['cancelled', 'rejected'].includes(item.status)) continue;
    const order = orderById[String(item.order)];
    if (!order || order.status === 'cancelled') continue;
    const row = bucket(item.name);
    const qty = Number(item.quantity) || 0;
    const amount = Number(item.line_total) || 0;
    row.ordered_qty += qty;
    row.ordered_amount += amount;
    if (order.payment_status === 'paid') {
      row.paid_qty += qty;
      row.paid_amount += amount;
    } else if (['unpaid', 'partial'].includes(order.payment_status)) {
      row.unpaid_qty += qty;
      row.unpaid_amount += amount;
    }
  }

  for (const item of itemsReturned) {
    const row = bucket(item.name);
    const qty = Number(item.quantity) || 0;
    const amount = Number(item.line_total) || 0;
    row.returned_qty += qty;
    row.returned_amount += amount;
  }

  return [...map.entries()]
    .map(([name, row]) => ({
      name,
      ordered_qty: round2(row.ordered_qty),
      ordered_amount: round2(row.ordered_amount),
      returned_qty: round2(row.returned_qty),
      returned_amount: round2(row.returned_amount),
      paid_qty: round2(row.paid_qty),
      paid_amount: round2(row.paid_amount),
      unpaid_qty: round2(row.unpaid_qty),
      unpaid_amount: round2(row.unpaid_amount),
    }))
    .sort((a, b) => b.ordered_qty - a.ordered_qty || a.name.localeCompare(b.name, 'fr'));
}

function countPaidUnpaidItems(itemsSent, orderById) {
  let paid = 0;
  let unpaid = 0;
  let paidAmount = 0;
  let unpaidAmount = 0;

  for (const item of itemsSent) {
    if (['cancelled', 'rejected'].includes(item.status)) continue;
    const order = orderById[String(item.order)];
    if (!order || order.status === 'cancelled') continue;
    const qty = Number(item.quantity) || 0;
    const amount = Number(item.line_total) || 0;
    if (order.payment_status === 'paid') {
      paid += qty;
      paidAmount += amount;
    } else if (['unpaid', 'partial'].includes(order.payment_status)) {
      unpaid += qty;
      unpaidAmount += amount;
    }
  }

  return {
    paid: round2(paid),
    unpaid: round2(unpaid),
    paidAmount: round2(paidAmount),
    unpaidAmount: round2(unpaidAmount),
  };
}

async function getWaiterDailyCloseReport(establishmentId, user, dateInput, shiftDoc) {
  const userId = user._id;
  let from;
  let to;
  let useShiftScope = false;

  if (shiftDoc) {
    from = new Date(shiftDoc.clock_in);
    to = shiftDoc.clock_out ? new Date(shiftDoc.clock_out) : new Date();
    useShiftScope = true;
  } else {
    ({ from, to } = getPeriodRange('day', dateInput));
  }

  const waiterFilter = waiterOrderFilter(userId);
  const sentTimeFilter = useShiftScope
    ? {
      $or: [
        { shift: shiftDoc._id },
        { shift: { $in: [null, undefined] }, sent_to_kitchen_at: { $gte: from, $lte: to } },
      ],
    }
    : { sent_to_kitchen_at: { $gte: from, $lte: to } };

  const base = {
    establishment: establishmentId,
    is_deleted: false,
    ...waiterFilter,
  };

  const establishment = await Establishment.findById(establishmentId).select('currency name');
  const currency = establishment?.currency || 'MAD';

  const [
    ordersSent,
    ordersCanceled,
    ordersUnpaid,
    ordersPaid,
    sentOrders,
    canceledOrders,
    waiterOrders,
    shifts,
  ] = await Promise.all([
    Order.countDocuments({
      ...base,
      ...sentTimeFilter,
    }),
    Order.countDocuments({
      ...base,
      status: 'cancelled',
      updatedAt: { $gte: from, $lte: to },
    }),
    Order.countDocuments({
      ...base,
      ...sentTimeFilter,
      status: { $nin: ['cancelled'] },
      payment_status: { $in: ['unpaid', 'partial'] },
    }),
    Order.countDocuments({
      ...base,
      ...sentTimeFilter,
      payment_status: 'paid',
    }),
    Order.find({
      ...base,
      ...sentTimeFilter,
      status: { $nin: ['cancelled'] },
    }).select('_id total payment_status status'),
    Order.find({
      ...base,
      status: 'cancelled',
      updatedAt: { $gte: from, $lte: to },
    }).select('total'),
    Order.find(base).select('_id payment_status status'),
    Shift.find(
      shiftDoc
        ? { _id: shiftDoc._id }
        : {
          establishment: establishmentId,
          user: userId,
          clock_in: { $gte: from, $lte: to },
        },
    )
      .sort({ clock_in: 1 })
      .select('clock_in clock_out opening_amount closing_amount source is_active'),
  ]);

  const ordersTotalAmount = sentOrders.reduce(
    (sum, order) => sum + (Number(order.total) || 0),
    0,
  );
  const canceledOrdersAmount = canceledOrders.reduce(
    (sum, order) => sum + (Number(order.total) || 0),
    0,
  );

  const orderById = Object.fromEntries(
    waiterOrders.map((order) => [String(order._id), order]),
  );
  const sentOrderIds = sentOrders.map((o) => o._id);
  const orderIds = waiterOrders.map((o) => o._id);

  let itemsSent = [];
  let itemsReturned = [];

  const itemLoads = [];
  if (sentOrderIds.length) {
    itemLoads.push(
      OrderItem.find({
        order: { $in: sentOrderIds },
        is_deleted: false,
      }),
    );
  } else {
    itemLoads.push(Promise.resolve([]));
  }

  if (orderIds.length) {
    itemLoads.push(
      OrderItem.find({
        order: { $in: orderIds },
        is_deleted: false,
        status: { $in: ['rejected', 'cancelled'] },
        $or: [
          { cancelled_at: { $gte: from, $lte: to } },
          { cancelled_at: null, updatedAt: { $gte: from, $lte: to } },
        ],
      }),
    );
  } else {
    itemLoads.push(Promise.resolve([]));
  }

  const [sentRows, cancelledRows] = await Promise.all(itemLoads);
  itemsSent = sentRows;
  itemsReturned = cancelledRows.filter((item) => isReturnedInRange(item, from, to));

  const {
    paid: itemsPaid,
    unpaid: itemsUnpaid,
    paidAmount: itemsPaidAmount,
    unpaidAmount: itemsUnpaidAmount,
  } = countPaidUnpaidItems(itemsSent, orderById);
  const sentByName = aggregateByNameWithAmount(
    itemsSent.filter((item) => !['cancelled', 'rejected'].includes(item.status)),
  );
  const returnedByName = aggregateByNameWithAmount(itemsReturned);
  const detailByName = aggregateDetailByName(itemsSent, itemsReturned, orderById);
  const itemsOrderedAmount = round2(
    sentByName.reduce((sum, row) => sum + (row.amount || 0), 0),
  );
  const returnedAmount = round2(
    returnedByName.reduce((sum, row) => sum + (row.amount || 0), 0),
  );
  const lostAmount = round2(returnedAmount + canceledOrdersAmount);

  return {
    date: from.toISOString(),
    from: from.toISOString(),
    to: to.toISOString(),
    currency,
    waiter: {
      _id: userId,
      fullname: user.fullname,
    },
    shifts: shifts.map((shift) => ({
      _id: shift._id,
      clock_in: shift.clock_in,
      clock_out: shift.clock_out,
      opening_amount: round2(shift.opening_amount),
      closing_amount: round2(shift.closing_amount),
      source: shift.source,
      is_active: Boolean(shift.is_active),
      shift_label: shift.shift_label,
    })),
    shift_id: shiftDoc?._id || null,
    orders: {
      sent: ordersSent,
      canceled: ordersCanceled,
      unpaid: ordersUnpaid,
      paid: ordersPaid,
      total_amount: round2(ordersTotalAmount),
      canceled_amount: round2(canceledOrdersAmount),
    },
    items: {
      sent_total: round2(sumQuantities(
        itemsSent.filter((item) => !['cancelled', 'rejected'].includes(item.status)),
      )),
      paid_total: itemsPaid,
      unpaid_total: itemsUnpaid,
      returned_total: round2(sumQuantities(itemsReturned)),
      ordered_amount: itemsOrderedAmount,
      paid_amount: itemsPaidAmount,
      unpaid_amount: itemsUnpaidAmount,
      returned_amount: returnedAmount,
      lost_amount: lostAmount,
      earned_amount: itemsPaidAmount,
      sent_by_name: sentByName,
      returned_by_name: returnedByName,
      detail_by_name: detailByName,
    },
  };
}

module.exports = {
  getWaiterDailyCloseReport,
  getWaiterDailyCloseReportForShift: (estId, user, shift) => (
    getWaiterDailyCloseReport(estId, user, null, shift)
  ),
  aggregateByName,
  aggregateByNameWithAmount,
  aggregateDetailByName,
  sumQuantities,
};
