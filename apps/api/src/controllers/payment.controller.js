const { Order, Payment, Establishment } = require('../models');
const { query, orderownership, serializers, paymentaccess } = require('../utils')();
const { getEstablishmentId } = query;
const { assertWaiterOrderAccess } = orderownership;
const { serializeCaisseReadyRow, serializeOrderDetail, serializePaymentHistoryRow, mapList } = serializers;
const { canVoidPayment } = paymentaccess;
const { payment, receipt, audit, notify, print, auth } = require('../services')();
const { finalizeDirectPinLogout } = auth;
const {
  listReadyToPay,
  processCheckout,
  voidPayment,
  listPaymentHistory,
  getDailySummary,
  closeDay,
  findOrderByDailyCode,
  calcOrderAmounts,
} = payment;
const { getReceiptForOrder } = receipt;
const { logStaffActivity } = audit;
const { emitOrderChanged, emitTablesChanged } = notify;
const { printCaisseReceipt } = print;

function handleAccessError(res, err, next) {
  if (err.status) {
    return res.status(err.status).json({ success: false, message: err.message, code: err.code });
  }
  return next(err);
}

async function getReceipt(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const receipt = await getReceiptForOrder(req.params.id, estId, req.query.payment_id);
    res.json({ success: true, data: receipt });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    return next(err);
  }
}

async function listReady(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const data = mapList(await listReadyToPay(estId, req.user), serializeCaisseReadyRow);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function lookupByDailyCode(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const result = await findOrderByDailyCode(estId, req.params.code);
    const amounts = calcOrderAmounts(result.order, result.items);
    res.json({
      success: true,
      data: {
        order: serializeOrderDetail(result.order),
        can_pay: result.can_pay,
        pay_block_reason: result.pay_block_reason,
        amounts: {
          balance_due: amounts.balance_due,
        },
      },
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    return next(err);
  }
}

async function checkout(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const order = await Order.findOne({ _id: req.params.id, establishment: estId, is_deleted: false });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Commande introuvable.' });
    }
    try {
      await assertWaiterOrderAccess(req, order, 'payment');
    } catch (err) {
      return handleAccessError(res, err, next);
    }

    const result = await processCheckout(estId, req.params.id, req.user, req.body);

    await logStaffActivity({
      establishment: estId,
      user: req.user,
      action: 'checkout',
      module: 'payments',
      resource: 'payment',
      resource_id: result.payments[0]?._id,
      description: `Encaissement ${result.order?.order_number || ''} — ${Number(result.payments[0]?.amount || 0).toFixed(2)} MAD`,
      metadata: { order_id: result.order._id, method: result.payments[0]?.method },
      req,
    });

    emitOrderChanged(estId, result.order._id);
    if (result.order.table) emitTablesChanged(estId, result.order.room);

    let endQuickWaiterSession = false;
    if (result.fully_paid) {
      endQuickWaiterSession = await finalizeDirectPinLogout(req, res, 'order_paid');
    }

    const receipt = await getReceiptForOrder(
      result.order._id,
      estId,
      result.payments[result.payments.length - 1]._id
    );

    res.json({
      success: true,
      data: {
        ...result,
        receipt,
        end_quick_waiter_session: endQuickWaiterSession,
      },
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    return next(err);
  }
}

async function voidPaymentHandler(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const establishment = await Establishment.findById(estId).select('waiter_can_void_payment');

    if (!(await canVoidPayment(req.user, establishment))) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'êtes pas autorisé à annuler un paiement.',
      });
    }

    const payment = await Payment.findOne({ _id: req.params.paymentId, establishment: estId });
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Paiement introuvable.' });
    }
    const order = await Order.findOne({ _id: payment.order, establishment: estId, is_deleted: false });
    if (order) {
      try {
        await assertWaiterOrderAccess(req, order, 'payment_cancel');
      } catch (err) {
        return handleAccessError(res, err, next);
      }
    }

    const result = await voidPayment(estId, req.params.paymentId, req.user, req.body.reason);

    await logStaffActivity({
      establishment: estId,
      user: req.user,
      action: 'void',
      module: 'payments',
      resource: 'payment',
      resource_id: result.payment._id,
      description: `Paiement annulé — ${result.payment.receipt_number || result.payment._id}`,
      req,
    });

    emitOrderChanged(estId, result.order._id);

    res.json({ success: true, data: result, message: 'Paiement annulé.' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    return next(err);
  }
}

async function history(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const data = mapList(await listPaymentHistory(estId, req.query), serializePaymentHistoryRow);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function dailySummary(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const data = await getDailySummary(estId, req.query.date);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function dailyClose(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const closing = await closeDay(estId, req.user, req.body.date, req.body.notes);

    await logStaffActivity({
      establishment: estId,
      user: req.user,
      action: 'daily_close',
      module: 'payments',
      resource: 'daily_closing',
      resource_id: closing._id,
      description: `Clôture journalière — ${new Date(closing.closing_date).toLocaleDateString('fr-FR')}`,
      req,
    });

    res.json({ success: true, data: closing, message: 'Journée clôturée.' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    return next(err);
  }
}

async function printCaisse(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const order = await Order.findOne({ _id: req.params.id, establishment: estId, is_deleted: false });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Commande introuvable.' });
    }
    try {
      await assertWaiterOrderAccess(req, order, 'print');
    } catch (err) {
      return handleAccessError(res, err, next);
    }

    const paymentId = req.body.payment_id;
    const result = await printCaisseReceipt(estId, req.params.id, paymentId);
    res.json({ success: true, data: result });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    return next(err);
  }
}

module.exports = {
  getReceipt,
  listReady,
  lookupByDailyCode,
  checkout,
  voidPaymentHandler,
  history,
  dailySummary,
  dailyClose,
  printCaisse,
};
