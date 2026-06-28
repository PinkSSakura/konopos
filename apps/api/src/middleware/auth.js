const { User, UserSession } = require('../models');
const config = require('../config');
const { auth: authService, shift } = require('../services')();
const { verifyToken } = authService;
const { getDirectPinInactivityMs } = require('../services/quick-waiter-session');
const { autoCloseShift } = shift;
const { authcookie } = require('../utils')();
const { getTokenFromRequest } = authcookie;

async function authenticate(req, res, next) {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentification requise.' });
    }
    const payload = verifyToken(token);

    const session = await UserSession.findOne({
      session_token: token,
      is_active: true,
    });
    if (!session) {
      return res.status(401).json({ success: false, message: 'Session expirée ou invalide.' });
    }

    if (session.expiry_time && session.expiry_time < new Date()) {
      if (!session.is_pin_session && session.shift) {
        await autoCloseShift(session.shift, 'timeout');
      }
      await session.logout('timeout');
      return res.status(401).json({ success: false, message: 'Session expirée (inactivité).' });
    }

    const user = await User.findById(payload.sub)
      .populate('role')
      .populate('establishment');

    if (!user || user.is_deleted || !user.is_active || user.status !== 'actif') {
      return res.status(401).json({ success: false, message: 'Utilisateur invalide.' });
    }

    const isDirectPin = Boolean(session.is_quick_waiter_session);
    const inactivityMs = isDirectPin
      ? getDirectPinInactivityMs()
      : ((!session.is_pin_session && payload.role_key === 'systempos')
        ? config.systemposSessionTimeoutMinutes * 60 * 1000
        : config.sessionTimeoutMinutes * 60 * 1000);
    session.expiry_time = new Date(Date.now() + inactivityMs);
    await session.save();

    if (session.is_pin_session && session.parent_systempos_session) {
      await UserSession.updateOne(
        { _id: session.parent_systempos_session, is_active: true },
        { expiry_time: session.expiry_time },
      );
    }

    req.user = user;
    req.session = session;
    req.token = token;
    req.isQuickWaiterSession = isDirectPin;
    return next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Jeton invalide.' });
  }
}

function requireRoleKeys(...keys) {
  return (req, res, next) => {
    const key = req.user?.role?.role_key;
    if (!keys.includes(key)) {
      return res.status(403).json({ success: false, message: 'Accès refusé.' });
    }
    return next();
  };
}

module.exports = { authenticate, requireRoleKeys };
