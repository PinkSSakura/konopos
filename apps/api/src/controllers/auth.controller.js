const { User, UserSession, Shift, Role } = require('../models');
const { PIN_ROLES } = require('../constants/auth');
const { ROLE_TYPES } = require('../models/role.model');
const { authcookie, authresponse, serializers, shiftroles, tenant } = require('../utils')();
const { clearAuthCookie, setAuthCookie } = authcookie;
const { sendAuthSuccess } = authresponse;
const { buildEstablishmentCapabilities } = serializers;
const { requiresShiftAmounts } = shiftroles;
const { findEstablishmentForUser } = tenant;
const { auth, permission } = require('../services')();
const {
  loginWithPassword,
  loginWithPin,
  loginWithPinDirect,
  registerPinFailure,
  logoutSession,
  getPinLoginOptions,
  comparePassword,
  createSession,
  hashPassword,
  pollLoginChallenge: pollLoginChallengeStatus,
  consumeLoginChallenge,
  approveLoginChallenge,
  denyLoginChallenge,
  restoreSystemposShellFromParent,
  restoreSystemposShellForTerminal,
} = auth;
const { getUserPermissionCodes } = permission;


function sanitizeUser(user) {
  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.password;
  delete obj.pin;
  delete obj.pin_failed_attempts;
  delete obj.pin_lock_tier;
  delete obj.pin_locked_until;
  delete obj.modified_by;
  delete obj.is_system_pos;
  return obj;
}

function sanitizeEstablishmentForClient(establishment) {
  if (!establishment || typeof establishment !== 'object') return null;
  if (!establishment.name && !establishment.maincolor) return null;
  const est = establishment.toObject ? establishment.toObject() : { ...establishment };
  return {
    name: est.name,
    maincolor: est.maincolor,
    secondarycolor: est.secondarycolor,
    currency: est.currency,
  };
}

function serializeUserForClient(user) {
  const obj = sanitizeUser(user);
  return {
    _id: obj._id,
    fullname: obj.fullname,
    username: obj.username,
    email: obj.email,
    phonenumber: obj.phonenumber,
    role_key: user.role?.role_key,
    establishment: sanitizeEstablishmentForClient(user.establishment),
  };
}

async function getAccess(req, res, next) {
  try {
    const establishmentId = req.user.establishment?._id || req.user.establishment;
    const permissions = await getUserPermissionCodes(req.user, establishmentId);
    const establishment = await findEstablishmentForUser(req.user);
    res.json({
      success: true,
      data: {
        role_key: req.user.role?.role_key,
        role_name: req.user.role?.name,
        permissions,
        is_pin_session: Boolean(req.session?.is_pin_session),
        is_quick_waiter_session: Boolean(req.session?.is_quick_waiter_session),
        session_id: req.session?._id ? String(req.session._id) : null,
        capabilities: buildEstablishmentCapabilities(establishment),
      },
    });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const identifier = (req.body.identifier ?? req.body.username ?? '').trim();
    const { password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Identifiant, matricule ou e-mail et mot de passe requis.',
      });
    }
    const result = await loginWithPassword({ identifier, password, req });
    const roleKey = result.user?.role?.role_key;
    sendAuthSuccess(res, {
      token: result.token,
      roleKey,
      is_pin_session: false,
      requires_shift_start: Boolean(result.requires_shift_start),
      shift_requires_amounts: requiresShiftAmounts(roleKey),
      req,
    });
  } catch (err) {
    next(err);
  }
}

async function loginPinDirect(req, res, next) {
  try {
    const { pin } = req.body;
    if (!pin || !/^\d{6}$/.test(pin)) {
      return res.status(400).json({ success: false, message: 'PIN à 6 chiffres requis.' });
    }

    try {
      const result = await loginWithPinDirect({ pin, req });
      const roleKey = result.user?.role?.role_key;
      sendAuthSuccess(res, {
        token: result.token,
        roleKey,
        is_pin_session: true,
        is_quick_waiter_session: Boolean(result.is_quick_waiter_session),
        requires_shift_start: Boolean(result.requires_shift_start),
        req,
      });
    } catch (err) {
      if (err.status === 401) {
        const { getSingleEstablishment } = require('../services/cds');
        const est = await getSingleEstablishment();
        if (est?._id) await registerPinFailure(pin, est._id);
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
}

async function loginPin(req, res, next) {
  try {
    if (req.user?.role?.role_key !== 'systempos') {
      return res.status(403).json({
        success: false,
        message: 'Connexion PIN réservée au terminal SystemPOS.',
      });
    }

    const { pin } = req.body;
    if (!pin || !/^\d{6}$/.test(pin)) {
      return res.status(400).json({ success: false, message: 'PIN à 6 chiffres requis.' });
    }

    const establishmentId = req.user.establishment?._id || req.user.establishment;

    try {
      const result = await loginWithPin({ pin, establishmentId, req });
      const roleKey = result.user?.role?.role_key;
      sendAuthSuccess(res, {
        token: result.token,
        roleKey,
        is_pin_session: true,
        requires_shift_start: Boolean(result.requires_shift_start),
        req,
      });
    } catch (err) {
      if (err.status === 401) {
        await registerPinFailure(pin, establishmentId);
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
}

async function loginSystemPos(req, res, next) {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({
      username,
      is_system_pos: true,
      is_deleted: false,
      is_active: true,
    })
      .select('+password')
      .populate('role')
      .populate('establishment');

    if (!user || user.role?.role_key !== 'systempos') {
      return res.status(401).json({ success: false, message: 'Compte SystemPOS invalide.' });
    }

    if (!(await comparePassword(password, user.password))) {
      return res.status(401).json({ success: false, message: 'Identifiants invalides.' });
    }

    const { token } = await createSession({
      user,
      establishment: user.establishment,
      req,
    });

    sendAuthSuccess(res, {
      token,
      roleKey: user.role?.role_key,
      is_pin_session: false,
      mode: 'systempos',
      req,
    });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    await logoutSession({
      token: req.token,
      reason: req.body?.reason || 'manual',
      req,
      user: req.user,
    });
    clearAuthCookie(res);
    res.json({ success: true, message: 'Déconnexion réussie.' });
  } catch (err) {
    next(err);
  }
}

async function logoutPin(req, res, next) {
  try {
    const establishmentId = req.user?.establishment?._id || req.user?.establishment;
    const isTerminal = req.headers['x-TouDev-terminal'] === 'systempos';

    if (!req.session?.is_pin_session) {
      if (req.user?.role?.role_key === 'systempos') {
        return res.json({
          success: true,
          message: 'Session serveur déjà terminée.',
          data: { restored_systempos: true },
        });
      }

      const restored_systempos = await restoreSystemposShellFromParent(
        res,
        null,
        establishmentId,
      );
      if (restored_systempos) {
        return res.json({
          success: true,
          message: 'Session serveur terminée.',
          data: { restored_systempos: true },
        });
      }

      return res.status(400).json({
        success: false,
        message: 'Aucune session PIN active.',
      });
    }

    const parentSessionId = req.session.parent_systempos_session;

    const isDirectPin = Boolean(req.session.is_quick_waiter_session);

    await logoutSession({
      token: req.token,
      reason: req.body?.reason || 'manual',
      req,
      user: req.user,
    });

    if (isDirectPin) {
      clearAuthCookie(res);
      return res.json({
        success: true,
        message: 'Session serveur terminée.',
        data: { direct_pin_logout: true },
      });
    }

    const restored_systempos = await restoreSystemposShellFromParent(
      res,
      parentSessionId,
      establishmentId,
    );
    if (restored_systempos) {
      return res.json({
        success: true,
        message: 'Session serveur terminée.',
        data: { restored_systempos: true },
      });
    }

    res.json({
      success: true,
      message: isTerminal
        ? 'Session serveur terminée — saisissez un nouveau PIN.'
        : 'Déconnexion réussie.',
      data: { restored_systempos: false },
    });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    res.json({
      success: true,
      data: serializeUserForClient(req.user),
    });
  } catch (err) {
    next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    const { fullname, email, phonenumber } = req.body;
    const user = await User.findOne({ _id: req.user._id, is_deleted: false })
      .populate('role')
      .populate('establishment');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
    }

    let changed = false;
    if (fullname !== undefined) {
      const name = String(fullname).trim();
      if (!name) {
        return res.status(400).json({ success: false, message: 'Nom complet requis.' });
      }
      user.fullname = name;
      changed = true;
    }
    if (email !== undefined) {
      user.email = String(email).trim() || undefined;
      changed = true;
    }
    if (phonenumber !== undefined) {
      user.phonenumber = String(phonenumber).trim() || undefined;
      changed = true;
    }

    if (!changed) {
      return res.status(400).json({ success: false, message: 'Aucune modification.' });
    }

    user.modified_by = req.user._id;
    await user.save();

    res.json({
      success: true,
      message: 'Profil mis à jour.',
      data: serializeUserForClient(user),
    });
  } catch (err) {
    next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    const { current_password, new_password, confirm_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({
        success: false,
        message: 'Mot de passe actuel et nouveau mot de passe requis.',
      });
    }
    if (new_password !== confirm_password) {
      return res.status(400).json({
        success: false,
        message: 'La confirmation ne correspond pas au nouveau mot de passe.',
      });
    }
    if (String(new_password).length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Le nouveau mot de passe doit contenir au moins 8 caractères.',
      });
    }

    const user = await User.findOne({ _id: req.user._id, is_deleted: false }).select('+password');
    if (!user?.password) {
      return res.status(400).json({
        success: false,
        message: 'Ce compte ne permet pas de modifier le mot de passe.',
      });
    }
    if (!(await comparePassword(current_password, user.password))) {
      return res.status(401).json({
        success: false,
        message: 'Mot de passe actuel incorrect.',
      });
    }

    user.password = await hashPassword(new_password);
    user.modified_by = req.user._id;
    await user.save();

    res.json({ success: true, message: 'Mot de passe modifié.' });
  } catch (err) {
    next(err);
  }
}

async function respondLoginChallenge(req, res, next) {
  try {
    const { action } = req.body;
    const { id } = req.params;

    if (!['approve', 'deny'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Action invalide.' });
    }

    if (action === 'approve') {
      await approveLoginChallenge({
        challengeId: id,
        currentSession: req.session,
        user: req.user,
      });
      clearAuthCookie(res);
      return res.json({
        success: true,
        message: 'Connexion autorisée sur l\'autre appareil. Vous êtes déconnecté ici.',
        data: { logged_out: true },
      });
    }

    await denyLoginChallenge({
      challengeId: id,
      user: req.user,
    });
    return res.json({
      success: true,
      message: 'Connexion refusée.',
      data: { status: 'denied' },
    });
  } catch (err) {
    next(err);
  }
}

async function pollLoginChallenge(req, res, next) {
  try {
    const { id } = req.params;
    const { secret } = req.query;
    if (!secret) {
      return res.status(400).json({ success: false, message: 'Jeton de vérification requis.' });
    }

    const result = pollLoginChallengeStatus({
      challengeId: id,
      secret: String(secret),
    });

    if (result.status === 'approved' && result.token) {
      consumeLoginChallenge(id);
      return sendAuthSuccess(res, {
        token: result.token,
        roleKey: result.roleKey,
        is_pin_session: false,
        requires_shift_start: Boolean(result.requires_shift_start),
        shift_requires_amounts: requiresShiftAmounts(result.roleKey),
        req,
      });
    }

    return res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function restoreSystemposShell(req, res, next) {
  try {
    if (req.headers['x-TouDev-terminal'] !== 'systempos') {
      return res.status(403).json({
        success: false,
        message: 'Terminal SystemPOS requis.',
      });
    }

    const restored = await restoreSystemposShellForTerminal(req, res);
    if (!restored) {
      return res.status(401).json({
        success: false,
        message: 'Session SystemPOS introuvable. Reconnectez le terminal.',
        code: 'SYSTEMPOS_SHELL_MISSING',
      });
    }

    return res.json({
      success: true,
      data: { restored_systempos: true },
    });
  } catch (err) {
    next(err);
  }
}

async function getLoginOptions(req, res, next) {
  try {
    const data = await getPinLoginOptions();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getSystemPosStatus(req, res, next) {
  try {
    const pinOptions = await getPinLoginOptions();
    const systemRole = await Role.findOne({ role_key: 'systempos' });
    const active = await User.findOne({
      role: systemRole?._id,
      is_system_pos: true,
      is_active: true,
      is_deleted: false,
      status: 'actif',
    }).select('username fullname');

    res.json({
      success: true,
      data: {
        has_active_systempos: Boolean(active),
        username: active?.username,
        ...pinOptions,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  login,
  loginPin,
  loginPinDirect,
  loginSystemPos,
  logout,
  logoutPin,
  me,
  getAccess,
  updateProfile,
  changePassword,
  getSystemPosStatus,
  getLoginOptions,
  respondLoginChallenge,
  pollLoginChallenge,
  restoreSystemposShell,
};
