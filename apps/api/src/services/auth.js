const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { PIN_ROLES } = require('../constants/auth');
const { User, UserSession, Shift, Role } = require('../models');
const { ROLE_TYPES } = require('../models/role.model');
const { logAudit, logStaffActivity } = require('./audit');
const { emitLoginChallenge, emitLoginChallengeResolved, emitSessionRevoked } = require('./notify');
const {
  shouldAutoStartShiftOnLogin,
  requiresManualShiftStart,
  findActiveShift,
  createAutoShift,
  shouldBlockManualLogout,
} = require('./shift');
const { setAuthCookie } = require('../utils/authcookie');
const {
  getPinLoginOptions,
  getDirectPinInactivityMs,
  endDirectPinSession,
  finalizeDirectPinLogout,
} = require('./quick-waiter-session');
const { getSingleEstablishment } = require('./cds');

const CHALLENGE_TTL_MS = 2 * 60 * 1000;
const loginChallenges = new Map();

function isBackofficeUser(user) {
  return user?.role?.role_type === ROLE_TYPES.BACKOFFICE;
}

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
  return parts.join(' · ') || 'Autre appareil';
}

function captureDeviceInfo(req) {
  return {
    device_type: req?.headers?.['x-device-type'] || null,
    user_agent: req?.headers?.['user-agent'] || null,
    ip: req?.ip || null,
  };
}

async function findActiveBackofficeSession(userId) {
  const sessions = await UserSession.find({
    user: userId,
    is_active: true,
    is_pin_session: false,
  });
  return sessions[0] || null;
}

async function findActiveSystemPosSession(establishmentId) {
  const systemUser = await User.findOne({
    establishment: establishmentId,
    is_system_pos: true,
    is_deleted: false,
    is_active: true,
  }).select('_id');
  if (!systemUser) return null;

  const sessions = await UserSession.find({
    user: systemUser._id,
    is_active: true,
    is_pin_session: false,
  });
  return sessions[0] || null;
}

function isSameTerminalDevice(a, b) {
  if (!a || !b) return false;
  if (a.ip && b.ip && a.ip === b.ip) return true;
  return false;
}

async function isLoginFromEstablishmentTerminal(req, establishmentId) {
  if (!establishmentId) return false;
  if (String(req?.headers?.['x-konopos-terminal'] || '').toLowerCase() === 'systempos') {
    return true;
  }
  const systemSession = await findActiveSystemPosSession(establishmentId);
  if (!systemSession?.device_info) return false;
  return isSameTerminalDevice(systemSession.device_info, captureDeviceInfo(req));
}

async function invalidateBackofficeSessions(userId, reason = 'replaced') {
  const activeSessions = await UserSession.find({
    user: userId,
    is_active: true,
    is_pin_session: false,
  });

  const revokedSessionIds = [];

  for (const session of activeSessions) {
    revokedSessionIds.push(String(session._id));
    if (session.shift) {
      await Shift.updateOne(
        { _id: session.shift, is_active: true },
        {
          clock_out: new Date(),
          is_active: false,
          forced_logout_by: reason === 'replaced' ? userId : undefined,
        }
      );
    }
    await session.logout(reason);
  }

  return revokedSessionIds;
}

function purgeExpiredChallenges() {
  const now = Date.now();
  for (const [id, challenge] of loginChallenges) {
    if (challenge.expiresAt <= now) {
      loginChallenges.delete(id);
    }
  }
}

function cancelPendingChallengesForUser(userId) {
  for (const [id, challenge] of loginChallenges) {
    if (challenge.userId === String(userId) && challenge.status === 'pending') {
      loginChallenges.delete(id);
    }
  }
}

function createPendingLoginChallenge({ user, establishment, shift, req, requiresShiftStart = false }) {
  purgeExpiredChallenges();
  cancelPendingChallengesForUser(user._id);

  const id = crypto.randomBytes(16).toString('hex');
  const secret = crypto.randomBytes(24).toString('hex');
  const deviceInfo = captureDeviceInfo(req);
  const challenge = {
    id,
    secret,
    status: 'pending',
    userId: String(user._id),
    establishmentId: establishment?._id ? String(establishment._id) : String(establishment || ''),
    shiftId: shift?._id ? String(shift._id) : null,
    roleKey: user.role?.role_key,
    requiresShiftStart: Boolean(requiresShiftStart),
    deviceInfo,
    createdAt: Date.now(),
    expiresAt: Date.now() + CHALLENGE_TTL_MS,
    token: null,
  };

  loginChallenges.set(id, challenge);

  emitLoginChallenge(user._id, {
    challenge_id: id,
    device_label: formatDeviceLabel(deviceInfo),
    expires_at: new Date(challenge.expiresAt).toISOString(),
  });

  return {
    challengeId: id,
    challengeSecret: secret,
    expiresAt: challenge.expiresAt,
    deviceLabel: formatDeviceLabel(deviceInfo),
  };
}

function buildLoginChallengePendingError(challengeMeta) {
  const err = new Error(
    'Une session est déjà active. Confirmez la connexion sur l\'autre appareil.'
  );
  err.status = 409;
  err.code = 'LOGIN_CHALLENGE_PENDING';
  err.data = {
    challenge_id: challengeMeta.challengeId,
    challenge_secret: challengeMeta.challengeSecret,
    expires_at: new Date(challengeMeta.expiresAt).toISOString(),
    device_label: challengeMeta.deviceLabel,
  };
  return err;
}

function getLoginChallenge(challengeId, secret) {
  purgeExpiredChallenges();
  const challenge = loginChallenges.get(challengeId);
  if (!challenge) return null;
  if (challenge.expiresAt <= Date.now()) {
    loginChallenges.delete(challengeId);
    return null;
  }
  if (secret && challenge.secret !== secret) return null;
  return challenge;
}

function pollLoginChallenge({ challengeId, secret }) {
  const challenge = getLoginChallenge(challengeId, secret);
  if (!challenge) {
    return { status: 'expired' };
  }
  if (challenge.status === 'pending') {
    return {
      status: 'pending',
      expires_at: new Date(challenge.expiresAt).toISOString(),
    };
  }
  if (challenge.status === 'denied') {
    loginChallenges.delete(challengeId);
    return { status: 'denied' };
  }
  if (challenge.status === 'approved') {
    return {
      status: 'approved',
      token: challenge.token,
      roleKey: challenge.roleKey,
      requires_shift_start: challenge.requiresShiftStart,
    };
  }
  return { status: 'expired' };
}

function consumeLoginChallenge(challengeId) {
  loginChallenges.delete(challengeId);
}

async function approveLoginChallenge({ challengeId, currentSession, user }) {
  const challenge = loginChallenges.get(challengeId);
  if (!challenge || challenge.status !== 'pending') {
    const err = new Error('Demande de connexion introuvable ou expirée.');
    err.status = 404;
    throw err;
  }
  if (String(challenge.userId) !== String(user._id)) {
    const err = new Error('Non autorisé.');
    err.status = 403;
    throw err;
  }

  const fullUser = await User.findById(challenge.userId)
    .populate('role')
    .populate('establishment');
  if (!fullUser) {
    const err = new Error('Utilisateur introuvable.');
    err.status = 404;
    throw err;
  }

  let shift = null;
  if (challenge.shiftId) {
    shift = await Shift.findById(challenge.shiftId);
  }

  await invalidateBackofficeSessions(fullUser._id, 'replaced_by_new_login');

  const fakeReq = {
    headers: {
      'x-device-type': challenge.deviceInfo.device_type,
      'user-agent': challenge.deviceInfo.user_agent,
    },
    ip: challenge.deviceInfo.ip,
  };

  const { token } = await createSession({
    user: fullUser,
    establishment: fullUser.establishment,
    shift,
    req: fakeReq,
    replaceExisting: false,
  });

  challenge.status = 'approved';
  challenge.token = token;
  challenge.roleKey = fullUser.role?.role_key;

  emitLoginChallengeResolved(fullUser._id, {
    challenge_id: challengeId,
    status: 'approved',
  });

  if (currentSession?.is_active) {
    await currentSession.logout('replaced_by_new_login');
  }

  return {
    token,
    roleKey: challenge.roleKey,
    requires_shift_start: challenge.requiresShiftStart,
  };
}

async function denyLoginChallenge({ challengeId, user }) {
  const challenge = loginChallenges.get(challengeId);
  if (!challenge || challenge.status !== 'pending') {
    const err = new Error('Demande de connexion introuvable ou expirée.');
    err.status = 404;
    throw err;
  }
  if (String(challenge.userId) !== String(user._id)) {
    const err = new Error('Non autorisé.');
    err.status = 403;
    throw err;
  }

  challenge.status = 'denied';
  emitLoginChallengeResolved(user._id, {
    challenge_id: challengeId,
    status: 'denied',
  });

  setTimeout(() => loginChallenges.delete(challengeId), 30_000);
  return { status: 'denied' };
}

async function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
}

async function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

function getInactivityMs(roleKey, isPinSession, isDirectPinSession = false) {
  if (isDirectPinSession) {
    return getDirectPinInactivityMs();
  }
  if (roleKey === 'systempos' && !isPinSession) {
    return config.systemposSessionTimeoutMinutes * 60 * 1000;
  }
  return config.sessionTimeoutMinutes * 60 * 1000;
}

function getSessionExpiry(roleKey, isPinSession, isDirectPinSession = false) {
  return new Date(Date.now() + getInactivityMs(roleKey, isPinSession, isDirectPinSession));
}

function getJwtExpiresIn(roleKey) {
  if (roleKey === 'superadmin') {
    return process.env.JWT_SUPERADMIN_EXPIRES_IN || '7d';
  }
  return config.jwtExpiresIn;
}

async function invalidateUserSessions(userId, reason = 'replaced') {
  const activeSessions = await UserSession.find({ user: userId, is_active: true });

  for (const session of activeSessions) {
    if (session.shift) {
      await Shift.updateOne(
        { _id: session.shift, is_active: true },
        {
          clock_out: new Date(),
          is_active: false,
          forced_logout_by: reason === 'replaced' ? userId : undefined,
        }
      );
    }
    await session.logout(reason);
  }
}

function signToken(payload, roleKey) {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: getJwtExpiresIn(roleKey),
  });
}

function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

async function createSession({
  user,
  establishment,
  isPinSession,
  isQuickWaiterSession: isDirectPinSession = false,
  shift,
  req,
  replaceExisting = true,
  parentSystemposSession = null,
}) {
  const role = user.role?.role_key
    ? user.role
    : await Role.findById(user.role).lean();
  const roleKey = role?.role_key;

  if (replaceExisting) {
    await invalidateUserSessions(user._id, 'replaced');
  }

  const expiry = getSessionExpiry(roleKey, isPinSession, isDirectPinSession);
  const token = signToken(
    {
      sub: user._id.toString(),
      role_key: roleKey,
      is_pin_session: Boolean(isPinSession),
      is_quick_waiter_session: Boolean(isDirectPinSession),
    },
    roleKey
  );

  const session = await UserSession.create({
    user: user._id,
    establishment: establishment?._id || establishment,
    session_token: token,
    expiry_time: expiry,
    is_pin_session: Boolean(isPinSession),
    is_quick_waiter_session: Boolean(isDirectPinSession),
    parent_systempos_session: parentSystemposSession || undefined,
    shift: shift?._id || shift,
    device_info: {
      device_type: req?.headers?.['x-device-type'],
      user_agent: req?.headers?.['user-agent'],
      ip: req?.ip,
    },
  });

  return { token, session, roleKey };
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function loginWithPassword({ identifier, username, password, req }) {
  const loginId = (identifier || username || '').trim();
  if (!loginId) {
    const err = new Error('Identifiant, matricule ou e-mail requis.');
    err.status = 400;
    throw err;
  }

  const matriculeId = loginId.toUpperCase();
  const user = await User.findOne({
    is_deleted: false,
    is_active: true,
    status: 'actif',
    $or: [
      { username: { $regex: new RegExp(`^${escapeRegex(loginId)}$`, 'i') } },
      { matricule: matriculeId },
      { email: { $regex: new RegExp(`^${escapeRegex(loginId)}$`, 'i') } },
    ],
  })
    .select('+password')
    .populate('role')
    .populate('establishment');

  if (!user || !user.password || !(await comparePassword(password, user.password))) {
    await logAudit({
      action: 'login_failed',
      module: 'auth',
      resource: 'user',
      description: `Échec connexion : ${loginId}`,
      req,
      success: false,
    });
    const err = new Error('Identifiants invalides.');
    err.status = 401;
    throw err;
  }

  const roleKey = user.role?.role_key;
  const est = user.establishment;
  let shift = await findActiveShift(user._id, est?._id || est);

  if (!shift && shouldAutoStartShiftOnLogin(roleKey, est, { isPinSession: false })) {
    shift = await createAutoShift({ user, establishment: est, roleKey, source: 'auto' });
  }

  let revokedSessionIds = [];
  if (isBackofficeUser(user)) {
    const activeSession = await findActiveBackofficeSession(user._id);
    if (activeSession) {
      revokedSessionIds = await invalidateBackofficeSessions(user._id, 'replaced_by_new_login');
    }
  }

  const { token, session } = await createSession({
    user,
    establishment: est,
    req,
    shift,
    replaceExisting: false,
  });

  if (revokedSessionIds.length) {
    emitSessionRevoked(String(user._id), {
      reason: 'replaced_by_new_login',
      silent: true,
      revoked_session_ids: revokedSessionIds,
    });
  }

  await logAudit({
    establishment: est?._id,
    user,
    action: 'login',
    module: 'auth',
    resource: 'user',
    resource_id: user._id,
    description: `Connexion : ${user.fullname}`,
    req,
  });

  await logStaffActivity({
    establishment: est?._id,
    user,
    action: 'login',
    module: 'auth',
    resource: 'user',
    resource_id: user._id,
    description: `Connexion — ${user.fullname}`,
    req,
  });

  return {
    user,
    token,
    session,
    shift,
    requires_shift_start: requiresManualShiftStart(roleKey, est) && !shift,
  };
}

async function loginWithPin({ pin, establishmentId, req }) {
  const user = await User.findOne({
    pin,
    establishment: establishmentId,
    is_deleted: false,
    is_active: true,
    status: 'actif',
  })
    .populate('role')
    .populate('establishment');

  if (!user) {
    await logAudit({
      establishment: establishmentId,
      action: 'pin_login_failed',
      module: 'auth',
      resource: 'user',
      description: 'PIN invalide',
      req,
      success: false,
    });
    const err = new Error('PIN invalide.');
    err.status = 401;
    throw err;
  }

  if (!PIN_ROLES.includes(user.role?.role_key)) {
    const err = new Error('Ce rôle ne peut pas se connecter par PIN.');
    err.status = 403;
    throw err;
  }

  if (user.pin_locked_until && user.pin_locked_until > new Date()) {
    const secondsLeft = Math.ceil((user.pin_locked_until - Date.now()) / 1000);
    const err = new Error(
      `PIN verrouillé. Réessayez dans ${secondsLeft} seconde${secondsLeft > 1 ? 's' : ''}.`
    );
    err.status = 423;
    throw err;
  }

  const roleKey = user.role?.role_key;
  const parentSystemposSession = (
    !req.session?.is_pin_session
    && req.user?.role?.role_key === 'systempos'
    && req.session?._id
  )
    ? String(req.session._id)
    : null;
  const estId = user.establishment?._id || user.establishment;
  let shift = await findActiveShift(user._id, estId);

  if (
    !shift
    && shouldAutoStartShiftOnLogin(roleKey, user.establishment, {
      isPinSession: true,
      fromSystemPos: Boolean(parentSystemposSession),
    })
  ) {
    shift = await createAutoShift({
      user,
      establishment: user.establishment,
      roleKey,
      source: parentSystemposSession ? 'systempos' : 'auto',
      systemposSessionId: parentSystemposSession,
    });
  }

  const { token, session } = await createSession({
    user,
    establishment: user.establishment,
    isPinSession: true,
    shift,
    req,
    parentSystemposSession,
  });

  if (parentSystemposSession) {
    await UserSession.updateOne(
      { _id: parentSystemposSession, is_active: true },
      { expiry_time: session.expiry_time },
    );
  }

  await User.updateOne(
    { _id: user._id },
    { pin_failed_attempts: 0, pin_locked_until: null, pin_lock_tier: 0 }
  );

  await logStaffActivity({
    establishment: user.establishment?._id,
    user,
    action: 'pin_login',
    module: 'auth',
    resource: 'user',
    resource_id: user._id,
    description: `Connexion PIN — ${user.fullname}`,
    req,
  });

  return {
    user,
    token,
    session,
    shift,
    requires_shift_start: requiresManualShiftStart(roleKey, user.establishment) && !shift,
  };
}

async function loginWithPinDirect({ pin, req }) {
  const options = await getPinLoginOptions();
  if (!options.pin_login_available) {
    const err = new Error('Connexion PIN indisponible pour cet établissement.');
    err.status = 403;
    throw err;
  }

  const establishment = await getSingleEstablishment();
  if (!establishment) {
    const err = new Error('Établissement introuvable.');
    err.status = 404;
    throw err;
  }

  const establishmentId = establishment._id;
  const user = await User.findOne({
    pin,
    establishment: establishmentId,
    is_deleted: false,
    is_active: true,
    status: 'actif',
  })
    .populate('role')
    .populate('establishment');

  if (!user) {
    await logAudit({
      establishment: establishmentId,
      action: 'pin_login_failed',
      module: 'auth',
      resource: 'user',
      description: 'PIN invalide (connexion directe)',
      req,
      success: false,
    });
    const err = new Error('PIN invalide.');
    err.status = 401;
    throw err;
  }

  if (!PIN_ROLES.includes(user.role?.role_key)) {
    const err = new Error('Ce rôle ne peut pas se connecter par PIN.');
    err.status = 403;
    throw err;
  }

  if (user.pin_locked_until && user.pin_locked_until > new Date()) {
    const secondsLeft = Math.ceil((user.pin_locked_until - Date.now()) / 1000);
    const err = new Error(
      `PIN verrouillé. Réessayez dans ${secondsLeft} seconde${secondsLeft > 1 ? 's' : ''}.`,
    );
    err.status = 423;
    throw err;
  }

  const roleKey = user.role?.role_key;
  const estId = user.establishment?._id || user.establishment;
  let shift = await findActiveShift(user._id, estId);

  if (
    !shift
    && shouldAutoStartShiftOnLogin(roleKey, user.establishment, {
      isPinSession: true,
      fromSystemPos: false,
      isDirectPin: true,
    })
  ) {
    shift = await createAutoShift({
      user,
      establishment: user.establishment,
      roleKey,
      source: 'direct_pin',
      systemposSessionId: null,
    });
  }

  const { token, session } = await createSession({
    user,
    establishment: user.establishment,
    isPinSession: true,
    isQuickWaiterSession: true,
    shift,
    req,
    parentSystemposSession: null,
  });

  await User.updateOne(
    { _id: user._id },
    { pin_failed_attempts: 0, pin_locked_until: null, pin_lock_tier: 0 },
  );

  await logStaffActivity({
    establishment: user.establishment?._id,
    user,
    action: 'pin_login',
    module: 'auth',
    resource: 'user',
    resource_id: user._id,
    description: `Connexion PIN directe — ${user.fullname}`,
    req,
  });

  return {
    user,
    token,
    session,
    shift,
    is_quick_waiter_session: true,
    requires_shift_start: requiresManualShiftStart(roleKey, user.establishment) && !shift,
  };
}

async function registerPinFailure(pin, establishmentId) {
  const user = await User.findOne({ pin, establishment: establishmentId }).select(
    '+pin_failed_attempts +pin_lock_tier'
  );
  if (!user) return;

  const attempts = (user.pin_failed_attempts || 0) + 1;
  const update = { pin_failed_attempts: attempts };

  if (attempts >= config.pinMaxAttempts) {
    const tier = user.pin_lock_tier || 0;
    const lockMs = config.pinLockBaseSeconds * 1000 * 2 ** tier;
    update.pin_locked_until = new Date(Date.now() + lockMs);
    update.pin_failed_attempts = 0;
    update.pin_lock_tier = tier + 1;
  }

  await User.updateOne({ _id: user._id }, update);
}

async function logoutSession({ token, reason, req, user }) {
  const session = await UserSession.findOne({ session_token: token, is_active: true });

  if (session && !session.is_pin_session && (await shouldBlockManualLogout(user, reason))) {
    const err = new Error('Veuillez clôturer votre shift avant déconnexion.');
    err.status = 409;
    err.code = 'SHIFT_MUST_CLOSE';
    throw err;
  }

  if (session) {
    if (session.is_quick_waiter_session && session.shift) {
      await Shift.updateOne(
        { _id: session.shift, is_active: true },
        {
          clock_out: new Date(),
          is_active: false,
          auto_closed_reason: reason,
        },
      );
    }
    if (user?.role?.role_key === 'systempos' && reason === 'manual') {
      await Shift.updateMany(
        {
          role_key: 'waiter',
          source: 'systempos',
          source_systempos_session: session._id,
          is_active: true,
        },
        {
          is_active: false,
          clock_out: new Date(),
          closed_by_user: user?._id,
        }
      );
    }
    await session.logout(reason);
    if (!session.is_pin_session && session.shift) {
      const autoReason = ['timeout', 'browser_close'].includes(reason) ? reason : undefined;
      await Shift.updateOne(
        { _id: session.shift, is_active: true },
        {
          clock_out: new Date(),
          is_active: false,
          forced_logout_by: reason === 'forced' ? user?._id : undefined,
          ...(autoReason ? { auto_closed_reason: autoReason } : {}),
        }
      );
    }
  }

  await logStaffActivity({
    establishment: user?.establishment?._id || user?.establishment,
    user,
    action: 'logout',
    module: 'auth',
    resource: 'user',
    resource_id: user?._id,
    description: `Déconnexion (${reason})`,
    req,
  });

  const roleKey = user?.role?.role_key;
  if (['superadmin', 'owner'].includes(roleKey)) {
    await logAudit({
      establishment: user?.establishment?._id || user?.establishment,
      user,
      action: 'logout',
      module: 'auth',
      resource: 'user',
      resource_id: user?._id,
      description: `Déconnexion (${reason})`,
      req,
      audience: 'system',
    });
  }
}

async function findActiveSystemposShellSession(establishmentId) {
  if (!establishmentId) return null;
  const estId = String(establishmentId);
  const systemposUsers = await User.find({
    establishment: estId,
    is_system_pos: true,
    is_deleted: false,
    is_active: true,
  }).select('_id');
  if (!systemposUsers.length) return null;

  const userIds = systemposUsers.map((u) => String(u._id));
  const sessions = await UserSession.find({
    establishment: estId,
    is_pin_session: false,
    is_active: true,
  }).sort({ login_time: -1 });

  return sessions.find((session) => userIds.includes(String(session.user?._id || session.user))) || null;
}

async function findLatestSystemposShellSession() {
  const systemposUsers = await User.find({
    is_system_pos: true,
    is_deleted: false,
    is_active: true,
  }).select('_id');
  if (!systemposUsers.length) return null;

  const userIds = new Set(systemposUsers.map((u) => String(u._id)));
  const sessions = await UserSession.find({
    is_pin_session: false,
  }).sort({ login_time: -1 });

  return sessions.find((session) => userIds.has(String(session.user?._id || session.user))) || null;
}

async function restoreSystemposShellFromParent(res, parentSessionId, establishmentId = null) {
  let parentSession = null;
  if (parentSessionId) {
    parentSession = await UserSession.findOne({ _id: parentSessionId });
    if (parentSession) {
      const shellUser = await User.findById(parentSession.user).populate('role');
      if (shellUser?.role?.role_key !== 'systempos') {
        parentSession = null;
      } else if (!parentSession.is_active) {
        parentSession.is_active = true;
        parentSession.logout_time = null;
        parentSession.logout_reason = null;
      }
    }
  }
  if (!parentSession && establishmentId) {
    parentSession = await findActiveSystemposShellSession(establishmentId);
  }
  if (!parentSession && (process.env.KONOPOS_LOCAL_POS === '1' || process.env.KONOPOS_LOCAL_POS === 'true')) {
    parentSession = await findLatestSystemposShellSession();
  }
  if (!parentSession || !res) return false;

  const parentUser = await User.findById(parentSession.user)
    .populate('role')
    .populate('establishment');
  if (!parentUser || parentUser.is_deleted || !parentUser.is_active) return false;
  if (parentUser.role?.role_key !== 'systempos') return false;

  const inactivityMs = getInactivityMs(parentUser.role?.role_key, false);
  parentSession.expiry_time = new Date(Date.now() + inactivityMs);
  parentSession.is_active = true;
  await parentSession.save();

  setAuthCookie(res, parentSession.session_token, parentUser.role?.role_key);
  return true;
}

async function restoreSystemposShellForTerminal(req, res) {
  const { getTokenFromRequest } = require('../utils/authcookie');
  const token = getTokenFromRequest(req);
  let parentSessionId = null;
  let establishmentId = null;

  if (token) {
    const session = await UserSession.findOne({ session_token: token });
    if (session) {
      establishmentId = session.establishment?._id || session.establishment;
      if (session.is_pin_session && session.parent_systempos_session) {
        parentSessionId = String(
          session.parent_systempos_session._id || session.parent_systempos_session,
        );
      } else {
        const shellUser = await User.findById(session.user).populate('role');
        if (shellUser?.role?.role_key === 'systempos') {
          parentSessionId = String(session._id);
        }
      }
    } else {
      try {
        const payload = verifyToken(token);
        const shellUser = await User.findById(payload.sub).populate('role');
        if (shellUser?.role?.role_key === 'systempos') {
          establishmentId = shellUser.establishment?._id || shellUser.establishment;
        }
      } catch {
        /* expired or invalid JWT — establishment may still be resolved below */
      }
    }
  }

  return restoreSystemposShellFromParent(res, parentSessionId, establishmentId);
}

module.exports = {
  hashPassword,
  comparePassword,
  signToken,
  verifyToken,
  createSession,
  loginWithPassword,
  loginWithPin,
  loginWithPinDirect,
  registerPinFailure,
  logoutSession,
  getPinLoginOptions,
  finalizeDirectPinLogout,
  endDirectPinSession,
  restoreSystemposShellFromParent,
  restoreSystemposShellForTerminal,
  pollLoginChallenge,
  consumeLoginChallenge,
  approveLoginChallenge,
  denyLoginChallenge,
};