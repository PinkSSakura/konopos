const { Role, Permission, RolePermission } = require('../../models');
const { query, serializers } = require('../../utils')();
const { getEstablishmentId } = query;
const { mapList, serializeRoleList, serializeRolePermissionsPayload } = serializers;
const { audit } = require('../../services')();
const { logAudit } = audit;

async function listRoles(req, res, next) {
  try {
    const roles = await Role.find({ is_deleted: false }).sort({ role_type: 1, name: 1 });
    res.json({ success: true, data: mapList(roles, serializeRoleList) });
  } catch (err) {
    next(err);
  }
}

async function getRole(req, res, next) {
  try {
    const role = await Role.findOne({ _id: req.params.id, is_deleted: false });
    if (!role) return res.status(404).json({ success: false, message: 'Rôle introuvable.' });
    res.json({ success: true, data: serializeRoleList(role) });
  } catch (err) {
    next(err);
  }
}

async function updateRole(req, res, next) {
  try {
    const role = await Role.findOne({ _id: req.params.id, is_deleted: false });
    if (!role) return res.status(404).json({ success: false, message: 'Rôle introuvable.' });

    if (role.role_key === 'superadmin') {
      return res.status(400).json({ success: false, message: 'Le rôle Super Admin ne peut pas être modifié.' });
    }

    const { name, abreviation, status, is_active } = req.body;
    if (name) role.name = name;
    if (abreviation !== undefined) role.abreviation = abreviation;
    if (status) role.status = status;
    if (typeof is_active === 'boolean') role.is_active = is_active;
    role.modified_by = req.user._id;
    await role.save();

    res.json({ success: true, data: serializeRoleList(role) });
  } catch (err) {
    next(err);
  }
}

async function listPermissions(req, res, next) {
  try {
    const permissions = await Permission.find({ is_deleted: false }).sort({ module: 1, resource: 1, action: 1 });
    const byModule = {};
    for (const p of permissions) {
      if (!byModule[p.module]) byModule[p.module] = [];
      byModule[p.module].push(p);
    }
    res.json({ success: true, data: { permissions, byModule } });
  } catch (err) {
    next(err);
  }
}

async function getRolePermissions(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const role = await Role.findOne({ _id: req.params.id, is_deleted: false });
    if (!role) return res.status(404).json({ success: false, message: 'Rôle introuvable.' });

    const allPerms = await Permission.find({ is_deleted: false }).sort({
      module: 1,
      resource: 1,
      action: 1,
      code_permission: 1,
    });
    const grants = await RolePermission.find({
      role: role._id,
      $or: [{ establishment: estId }, { establishment: null }],
      is_deleted: false,
    }).populate('permission');

    const grantMap = {};
    for (const g of grants) {
      const code = g.permission?.code_permission;
      if (code) grantMap[code] = { is_active: g.is_active, id: g._id, permission_id: g.permission._id };
    }

    const matrix = allPerms.map((p) => ({
      permission: p,
      granted: Boolean(grantMap[p.code_permission]?.is_active),
      role_permission_id: grantMap[p.code_permission]?.id,
    }));

    res.json({
      success: true,
      data: serializeRolePermissionsPayload({
        role,
        matrix,
        is_superadmin: role.role_key === 'superadmin',
      }),
    });
  } catch (err) {
    next(err);
  }
}

async function updateRolePermissions(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const role = await Role.findOne({ _id: req.params.id, is_deleted: false });
    if (!role) return res.status(404).json({ success: false, message: 'Rôle introuvable.' });

    if (role.role_key === 'superadmin') {
      return res.status(400).json({
        success: false,
        message: 'Les permissions du Super Admin sont complètes et non modifiables.',
      });
    }

    const { grants } = req.body;
    if (!Array.isArray(grants)) {
      return res.status(400).json({ success: false, message: 'Format grants invalide.' });
    }

    for (const { permission_id, granted } of grants) {
      const permission = await Permission.findById(permission_id);
      if (!permission) continue;

      await RolePermission.findOneAndUpdate(
        { role: role._id, permission: permission_id, establishment: estId },
        {
          $set: {
            role: role._id,
            permission: permission_id,
            establishment: estId,
            is_active: Boolean(granted),
            granted_by: req.user._id,
            is_deleted: false,
          },
        },
        { upsert: true }
      );
    }

    await logAudit({
      establishment: estId,
      user: req.user,
      action: 'update',
      module: 'permissions',
      resource: 'role',
      resource_id: role._id,
      description: `Permissions mises à jour : ${role.name}`,
      metadata: { grants_count: grants.length },
      req,
    });

    res.json({ success: true, message: 'Permissions enregistrées.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listRoles,
  getRole,
  updateRole,
  listPermissions,
  getRolePermissions,
  updateRolePermissions,
};
