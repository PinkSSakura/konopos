const { Order, Shift, Establishment } = require('../models');
const { resetDailyCodeSession, maybeResetDailyCodeForCalendarDay } = require('./dailycode');
const { requiresShiftAmounts } = require('../utils/shiftroles');

const MANAGER_ROLES = ['superadmin', 'owner', 'manager', 'submanager'];

function isManagerRole(roleKey) {
  return MANAGER_ROLES.includes(roleKey);
}

async function findOpenShifts(establishmentId) {
  return Shift.find({
    establishment: establishmentId,
    is_active: true,
  }).sort({ clock_in: 1 });
}

async function countOpenShifts(establishmentId) {
  return Shift.countDocuments({
    establishment: establishmentId,
    is_active: true,
  });
}

async function getBlockingOrdersForShift(shiftId) {
  return Order.find({
    shift: shiftId,
    is_deleted: false,
    status: { $ne: 'cancelled' },
    payment_status: { $in: ['unpaid', 'partial'] },
  }).select('_id order_number total payment_status status table');
}

async function reassignUnpaidOrders(fromShiftId, toShiftId) {
  const result = await Order.updateMany(
    {
      shift: fromShiftId,
      is_deleted: false,
      status: { $ne: 'cancelled' },
      payment_status: { $in: ['unpaid', 'partial'] },
    },
    { $set: { shift: toShiftId } },
  );
  return result.modifiedCount || 0;
}

async function afterShiftClosed(establishmentId) {
  const open = await countOpenShifts(establishmentId);
  if (open === 0) {
    await resetDailyCodeSession(establishmentId);
  }
}

async function validateShiftClose({ shift, user, establishment, closingAmount, force, reassignToShiftId }) {
  const roleKey = user?.role?.role_key;
  const blocking = await getBlockingOrdersForShift(shift._id);

  if (blocking.length && force) {
    if (roleKey !== 'superadmin') {
      const err = new Error('Seul le superadmin peut forcer la clôture.');
      err.status = 403;
      throw err;
    }
    if (!reassignToShiftId) {
      const err = new Error('Indiquez un shift ouvert pour réassigner les commandes impayées.');
      err.status = 400;
      throw err;
    }
    const target = await Shift.findOne({
      _id: reassignToShiftId,
      establishment: shift.establishment,
      is_active: true,
    });
    if (!target) {
      const err = new Error('Shift cible introuvable ou fermé.');
      err.status = 400;
      throw err;
    }
    await reassignUnpaidOrders(shift._id, target._id);
  } else if (blocking.length) {
    const err = new Error(
      `${blocking.length} commande(s) impayée(s) — encaissez ou annulez avant clôture.`,
    );
    err.status = 400;
    err.code = 'SHIFT_UNPAID_ORDERS';
    err.data = { orders: blocking.map((o) => ({
      _id: o._id,
      order_number: o.order_number,
      total: o.total,
      payment_status: o.payment_status,
    })) };
    throw err;
  }

  const cashOptional = establishment?.shift_cash_optional === true;
  const needsAmounts = requiresShiftAmounts(shift.role_key || user?.role?.role_key) && !cashOptional;
  if (needsAmounts && (Number.isNaN(closingAmount) || closingAmount < 0)) {
    const err = new Error('Montant de clôture invalide.');
    err.status = 400;
    throw err;
  }

  return { needsAmounts };
}

async function closeShiftRecord({
  shift,
  closedByUser,
  closingAmount,
  notes,
  needsAmounts,
}) {
  shift.is_active = false;
  shift.clock_out = new Date();
  shift.closed_by_user = closedByUser._id;
  if (notes) shift.notes = notes;
  if (needsAmounts) shift.closing_amount = closingAmount;
  await shift.save();
  await afterShiftClosed(shift.establishment?._id || shift.establishment);
  return shift;
}

async function startShiftForUser({
  targetUser,
  establishmentId,
  openedBy,
  openingAmount,
  shiftLabel,
  roleKey,
  source,
  systemposSessionId,
}) {
  const existing = await Shift.findOne({
    user: targetUser._id,
    establishment: establishmentId,
    is_active: true,
  });
  if (existing) return existing;

  const est = await Establishment.findById(establishmentId).select('shift_cash_optional');
  const cashOptional = est?.shift_cash_optional === true;
  const needsAmounts = requiresShiftAmounts(roleKey) && !cashOptional;
  const opening = needsAmounts ? Number(openingAmount || 0) : Number(openingAmount || 0);

  if (needsAmounts && (Number.isNaN(opening) || opening < 0)) {
    const err = new Error('Montant de départ invalide.');
    err.status = 400;
    throw err;
  }

  return Shift.create({
    user: targetUser._id,
    establishment: establishmentId,
    opened_by: openedBy._id,
    opening_amount: opening,
    shift_label: shiftLabel || null,
    source: source || 'manual',
    source_systempos_session: systemposSessionId || null,
    role_key: roleKey,
    clock_in: new Date(),
  });
}

module.exports = {
  MANAGER_ROLES,
  isManagerRole,
  findOpenShifts,
  countOpenShifts,
  getBlockingOrdersForShift,
  validateShiftClose,
  closeShiftRecord,
  startShiftForUser,
  afterShiftClosed,
};
