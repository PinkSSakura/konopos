const config = require('../config');
const { User, UserSession, Shift, Establishment } = require('../models');
const { getSingleEstablishment } = require('./cds');
const { clearAuthCookie } = require('../utils/authcookie');

async function establishmentHasSystempos(establishmentId) {
  if (!establishmentId) return false;
  const estId = String(establishmentId);
  const users = await User.find({
    establishment: estId,
    is_system_pos: true,
    is_deleted: false,
    is_active: true,
    status: 'actif',
  }).select('_id');
  return users.length > 0;
}

async function getPinLoginOptions() {
  const establishment = await getSingleEstablishment();
  if (!establishment) {
    return {
      pin_login_available: false,
      waiter_quick_pin_mode: false,
      has_systempos: false,
    };
  }
  const hasSystempos = await establishmentHasSystempos(establishment._id);
  const waiterQuickPinMode = Boolean(establishment.waiter_quick_pin_mode);
  return {
    pin_login_available: waiterQuickPinMode || !hasSystempos,
    waiter_quick_pin_mode: waiterQuickPinMode,
    has_systempos: hasSystempos,
  };
}

function getDirectPinInactivityMs() {
  return (Number(config.directPinSessionTimeoutSeconds) || 105) * 1000;
}

async function closeShiftForSession(session, reason) {
  if (!session?.shift) return;
  await Shift.updateOne(
    { _id: session.shift, is_active: true },
    {
      clock_out: new Date(),
      is_active: false,
      auto_closed_reason: reason,
    },
  );
}

async function endDirectPinSession(session, reason) {
  if (!session?.is_quick_waiter_session || !session.is_active) return false;
  await closeShiftForSession(session, reason);
  await session.logout(reason);
  return true;
}

async function finalizeDirectPinLogout(req, res, reason) {
  const ended = await endDirectPinSession(req.session, reason);
  if (ended) clearAuthCookie(res);
  return ended;
}

async function sessionUnlocksCds(session) {
  if (!session?.is_active || session.is_quick_waiter_session) return false;
  if (!session.is_pin_session) return true;
  const user = await User.findById(session.user).populate('role');
  return user?.role?.role_key !== 'waiter';
}

async function isCdsUnlockedForEstablishment(establishmentId) {
  const sessions = await UserSession.find({ is_active: true });
  const estKey = establishmentId == null ? null : String(establishmentId._id ?? establishmentId);

  for (const session of sessions) {
    const sessionEst = session.establishment?._id || session.establishment;
    if (estKey && sessionEst && String(sessionEst) !== estKey) continue;
    if (await sessionUnlocksCds(session)) return true;
  }

  const estCount = await Establishment.countDocuments({ is_deleted: false });
  return estCount <= 1;
}

module.exports = {
  establishmentHasSystempos,
  getPinLoginOptions,
  getDirectPinInactivityMs,
  endDirectPinSession,
  finalizeDirectPinLogout,
  isCdsUnlockedForEstablishment,
};
