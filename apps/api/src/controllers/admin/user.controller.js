const { User, Role } = require('../../models');
const { PIN_ROLES, NO_PIN_ROLES, PASSWORD_REQUIRED_ROLES } = require('../../constants/auth');
const { codes, serializers, tenant } = require('../../utils')();
const { generateUserCodes, generateCodeUser, generateMatricule } = codes;
const { serializeUserAdmin, serializeUserList } = serializers;
const { resolveEstablishmentId } = tenant;
const { auth, audit } = require('../../services')();
const { hashPassword } = auth;
const { logAudit } = audit;

async function requireEstablishmentId(req, res) {
  const estId = await resolveEstablishmentId(req);
  if (!estId) {
    res.status(404).json({
      success: false,
      message: 'Créez d\'abord un établissement.',
      code: 'ESTABLISHMENT_REQUIRED',
    });
    return null;
  }
  return estId;
}

async function assertPinUnique(estId, pin, excludeUserId) {
  if (!pin) return null;
  const filter = { establishment: estId, pin, is_deleted: false };
  if (excludeUserId) filter._id = { $ne: excludeUserId };
  const existing = await User.findOne(filter).select('fullname');
  if (existing) {
    const err = new Error('Ce PIN est déjà utilisé dans cet établissement.');
    err.status = 400;
    throw err;
  }
  return null;
}

async function listUsers(req, res, next) {
  try {
    const estId = await requireEstablishmentId(req, res);
    if (!estId) return undefined;
    const filter = { is_deleted: false, establishment: estId };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.role) filter.role = req.query.role;

    const users = await User.find(filter)
      .populate('role', 'name role_key role_type is_hidden status')
      .sort({ fullname: 1 });

    res.json({ success: true, data: serializeUserList(users) });
  } catch (err) {
    next(err);
  }
}

async function getUser(req, res, next) {
  try {
    const estId = await requireEstablishmentId(req, res);
    if (!estId) return undefined;
    const user = await User.findOne({ _id: req.params.id, establishment: estId, is_deleted: false })
      .populate('role');
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
    res.json({ success: true, data: serializeUserAdmin(user) });
  } catch (err) {
    next(err);
  }
}

async function createUser(req, res, next) {
  try {
    const estId = await requireEstablishmentId(req, res);
    if (!estId) return undefined;
    const {
      fullname, username, email, password, role: roleId, pin,
      phonenumber, cin, status, is_system_pos,
    } = req.body;

    if (!fullname || !roleId) {
      return res.status(400).json({ success: false, message: 'Nom et rôle obligatoires.' });
    }

    const role = await Role.findById(roleId);
    if (!role) return res.status(400).json({ success: false, message: 'Rôle invalide.' });

    if (PASSWORD_REQUIRED_ROLES.includes(role.role_key)) {
      if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Identifiant et mot de passe requis.' });
      }
    }

    if (PIN_ROLES.includes(role.role_key) && !pin) {
      return res.status(400).json({ success: false, message: 'PIN à 6 chiffres requis pour ce rôle.' });
    }

    if (NO_PIN_ROLES.includes(role.role_key) && pin) {
      return res.status(400).json({ success: false, message: 'Ce rôle ne peut pas avoir de PIN.' });
    }

    if (pin && !/^\d{6}$/.test(pin)) {
      return res.status(400).json({ success: false, message: 'PIN à 6 chiffres requis.' });
    }

    await assertPinUnique(estId, pin);

    if (is_system_pos) {
      if (role.role_key !== 'systempos') {
        return res.status(400).json({ success: false, message: 'Seul le rôle SystemPOS peut être terminal POS.' });
      }
      await User.updateMany(
        { establishment: estId, is_system_pos: true, is_deleted: false },
        { is_system_pos: false, modified_by: req.user._id }
      );
    }

    const { code_user, matricule } = await generateUserCodes(estId);
    const data = {
      code_user,
      matricule,
      establishment: estId,
      fullname,
      username: username || undefined,
      email,
      role: roleId,
      phonenumber,
      cin,
      status: status || 'actif',
      is_system_pos: Boolean(is_system_pos),
      pin: PIN_ROLES.includes(role.role_key) ? pin : undefined,
      created_by: req.user._id,
    };

    if (password) data.password = await hashPassword(password);

    const user = await User.create(data);
    await user.populate('role', 'name role_key');

    await logAudit({
      establishment: estId,
      user: req.user,
      action: 'create',
      module: 'users',
      resource: 'user',
      resource_id: user._id,
      description: `Utilisateur créé : ${fullname}`,
      req,
    });

    res.status(201).json({ success: true, data: serializeUserAdmin(user) });
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).json({ success: false, message: err.message });
    }
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Identifiant, PIN ou matricule déjà utilisé.' });
    }
    next(err);
  }
}

async function updateUser(req, res, next) {
  try {
    const estId = await requireEstablishmentId(req, res);
    if (!estId) return undefined;
    const user = await User.findOne({ _id: req.params.id, establishment: estId, is_deleted: false }).populate('role');
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });

    const {
      fullname, username, email, password, role: roleId, pin,
      phonenumber, cin, status, is_system_pos, is_active,
    } = req.body;

    if (!user.code_user) {
      user.code_user = await generateCodeUser(estId);
    }
    if (!user.matricule) {
      user.matricule = await generateMatricule(estId);
    }

    if (fullname) user.fullname = fullname;
    if (username !== undefined) user.username = username || undefined;
    if (email !== undefined) user.email = email;
    if (phonenumber !== undefined) user.phonenumber = phonenumber;
    if (cin !== undefined) user.cin = cin;
    if (status) user.status = status;
    if (typeof is_active === 'boolean') user.is_active = is_active;

    let roleKey = user.role?.role_key;

    if (roleId) {
      const role = await Role.findById(roleId);
      if (!role) return res.status(400).json({ success: false, message: 'Rôle invalide.' });
      if (role.role_key === 'superadmin') {
        return res.status(400).json({
          success: false,
          message: 'Attribuez le rôle Super Admin uniquement à la création du compte.',
        });
      }
      user.role = roleId;
      roleKey = role.role_key;
    }

    if (password) user.password = await hashPassword(password);

    if (pin !== undefined) {
      if (NO_PIN_ROLES.includes(roleKey) && pin) {
        return res.status(400).json({ success: false, message: 'Ce rôle ne peut pas avoir de PIN.' });
      }
      if (pin && !/^\d{6}$/.test(pin)) {
        return res.status(400).json({ success: false, message: 'PIN à 6 chiffres requis.' });
      }
      if (pin) await assertPinUnique(estId, pin, user._id);
      user.pin = PIN_ROLES.includes(roleKey) ? pin : undefined;
    }

    if (is_system_pos === true) {
      const role = await Role.findById(user.role);
      if (role?.role_key !== 'systempos') {
        return res.status(400).json({ success: false, message: 'Rôle incompatible avec SystemPOS.' });
      }
      await User.updateMany(
        { establishment: estId, is_system_pos: true, is_deleted: false, _id: { $ne: user._id } },
        { is_system_pos: false, modified_by: req.user._id }
      );
      user.is_system_pos = true;
    } else if (is_system_pos === false) {
      user.is_system_pos = false;
    }

    user.modified_by = req.user._id;
    await user.save();
    await user.populate('role', 'name role_key');

    await logAudit({
      establishment: estId,
      user: req.user,
      action: 'update',
      module: 'users',
      resource: 'user',
      resource_id: user._id,
      req,
    });

    res.json({ success: true, data: serializeUserAdmin(user) });
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).json({ success: false, message: err.message });
    }
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Identifiant ou PIN déjà utilisé.' });
    }
    next(err);
  }
}

async function deleteUser(req, res, next) {
  try {
    const estId = await requireEstablishmentId(req, res);
    if (!estId) return undefined;
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Vous ne pouvez pas supprimer votre propre compte.' });
    }

    const user = await User.findOne({ _id: req.params.id, establishment: estId, is_deleted: false }).populate('role');
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });

    if (user.role?.role_key === 'superadmin') {
      const count = await User.countDocuments({
        establishment: estId,
        role: user.role._id,
        is_deleted: false,
      });
      if (count <= 1) {
        return res.status(400).json({ success: false, message: 'Impossible de supprimer le dernier Super Admin.' });
      }
    }

    user.is_deleted = true;
    user.deleted_at = new Date();
    user.deleted_by = req.user._id;
    user.is_active = false;
    user.status = 'inactif';
    await user.save();

    res.json({ success: true, message: 'Utilisateur supprimé (soft delete).' });
  } catch (err) {
    next(err);
  }
}

module.exports = { listUsers, getUser, createUser, updateUser, deleteUser };
