const { Shift, Establishment } = require('../models');
const {
  SHIFT_ROLES,
  isShiftRole,
  requiresManualShiftStart,
  usesAutoShift,
  requiresShiftAmounts,
  shouldAutoStartShiftOnLogin,
} = require('../utils/shiftroles');

function getPeriodRange(period, dateInput) {
  const ref = dateInput ? new Date(dateInput) : new Date();
  if (Number.isNaN(ref.getTime())) {
    const err = new Error('Date invalide.');
    err.status = 400;
    throw err;
  }

  let from;
  let to;

  if (period === 'day') {
    from = new Date(ref);
    from.setHours(0, 0, 0, 0);
    to = new Date(ref);
    to.setHours(23, 59, 59, 999);
  } else if (period === 'week') {
    const day = ref.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    from = new Date(ref);
    from.setDate(ref.getDate() + diff);
    from.setHours(0, 0, 0, 0);
    to = new Date(from);
    to.setDate(from.getDate() + 6);
    to.setHours(23, 59, 59, 999);
  } else if (period === 'month') {
    from = new Date(ref.getFullYear(), ref.getMonth(), 1);
    to = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
  } else if (period === 'year') {
    from = new Date(ref.getFullYear(), 0, 1);
    to = new Date(ref.getFullYear(), 11, 31, 23, 59, 59, 999);
  } else {
    const err = new Error('Période invalide.');
    err.status = 400;
    throw err;
  }

  return { from, to };
}

async function findActiveShift(userId, establishmentId) {
  return Shift.findOne({
    user: userId,
    establishment: establishmentId,
    is_active: true,
  }).sort({ clock_in: -1 });
}

async function autoCloseShift(shiftId, reason) {
  if (!shiftId) return;
  await Shift.updateOne(
    { _id: shiftId, is_active: true },
    {
      $set: {
        is_active: false,
        clock_out: new Date(),
        auto_closed_reason: reason,
      },
    }
  );
}

async function createAutoShift({ user, establishment, roleKey, source = 'auto', systemposSessionId = null }) {
  return Shift.create({
    user: user._id,
    establishment: establishment?._id || establishment,
    opening_amount: 0,
    source,
    source_systempos_session: systemposSessionId || undefined,
    role_key: roleKey,
  });
}

async function resolveEstablishmentForUser(user) {
  if (user?.establishment?._id || user?.establishment) {
    const id = user.establishment._id || user.establishment;
    return Establishment.findById(id).select(
      'waiter_shift_manual_start kitchen_shift_manual_start'
    );
  }
  return Establishment.findOne({ is_deleted: false, is_setup_complete: true }).select(
    'waiter_shift_manual_start kitchen_shift_manual_start'
  );
}

async function shouldBlockManualLogout(user, reason) {
  if (reason !== 'manual') return false;
  const establishment = await resolveEstablishmentForUser(user);
  const roleKey = user?.role?.role_key;
  if (!requiresManualShiftStart(roleKey, establishment)) return false;
  const estId = establishment?._id;
  if (!estId) return false;
  const active = await findActiveShift(user._id, estId);
  return Boolean(active);
}

module.exports = {
  SHIFT_ROLES,
  isShiftRole,
  requiresManualShiftStart,
  usesAutoShift,
  requiresShiftAmounts,
  shouldAutoStartShiftOnLogin,
  getPeriodRange,
  findActiveShift,
  autoCloseShift,
  createAutoShift,
  resolveEstablishmentForUser,
  shouldBlockManualLogout,
};
