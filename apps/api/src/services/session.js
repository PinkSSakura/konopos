const { UserSession, User } = require('../models');
const { logoutSession } = require('./auth');
const { emitSessionRevoked } = require('./notify');

function formatDeviceLabel(deviceInfo = {}) {
  const parts = [];
  if (deviceInfo.device_type) {
    parts.push(deviceInfo.device_type === 'mobile' ? 'Mobile' : 'Ordinateur');
  }
  const ua = deviceInfo.user_agent || '';
  if (ua.includes('Edg/')) parts.push('Edge');
  else if (ua.includes('Chrome/')) parts.push('Chrome');
  else if (ua.includes('Firefox/')) parts.push('Firefox');
  else if (ua.includes('Safari/') && !ua.includes('Chrome')) parts.push('Safari');
  if (deviceInfo.ip) parts.push(deviceInfo.ip);
  return parts.join(' · ') || 'Appareil inconnu';
}

function serializeActiveSession(session, currentSessionId) {
  const s = session?.toObject ? session.toObject() : session;
  const user = s.user?.toObject ? s.user.toObject() : s.user;
  const role = user?.role?.toObject ? user.role.toObject() : user?.role;
  return {
    _id: s._id,
    user: user
      ? {
          _id: user._id,
          fullname: user.fullname,
          username: user.username,
          role_key: role?.role_key,
          role_name: role?.display_name || role?.name,
        }
      : null,
    login_time: s.login_time,
    is_pin_session: Boolean(s.is_pin_session),
    device_label: formatDeviceLabel(s.device_info),
    is_current: currentSessionId ? String(s._id) === String(currentSessionId) : false,
  };
}

async function listActiveSessions(establishmentId, currentSessionId) {
  const sessions = await UserSession.find({
    establishment: establishmentId,
    is_active: true,
  })
    .populate({
      path: 'user',
      select: 'fullname username role',
      populate: { path: 'role', select: 'name display_name role_key' },
    })
    .sort({ login_time: -1 });

  return sessions.map((session) => serializeActiveSession(session, currentSessionId));
}

async function forceLogoutSession({ sessionId, establishmentId, forcedBy, req }) {
  const session = await UserSession.findOne({
    _id: sessionId,
    establishment: establishmentId,
    is_active: true,
  });
  if (!session) {
    const err = new Error('Session introuvable ou déjà fermée.');
    err.status = 404;
    throw err;
  }

  if (String(session._id) === String(req.session?._id)) {
    const err = new Error('Utilisez Déconnexion pour fermer votre propre session.');
    err.status = 400;
    throw err;
  }

  const user = await User.findById(session.user).populate('role').populate('establishment');
  if (!user) {
    const err = new Error('Utilisateur introuvable.');
    err.status = 404;
    throw err;
  }

  await logoutSession({
    token: session.session_token,
    reason: 'forced',
    req,
    user,
  });

  emitSessionRevoked(String(session.user), {
    reason: 'forced',
    session_id: String(sessionId),
    forced_by: String(forcedBy?._id || forcedBy),
  });

  return { session_id: sessionId, user_id: session.user };
}

module.exports = {
  listActiveSessions,
  forceLogoutSession,
  formatDeviceLabel,
};
