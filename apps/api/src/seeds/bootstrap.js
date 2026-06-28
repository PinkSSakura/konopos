const { Role, Permission, RolePermission, User } = require('../models');
const ROLES = require('./roles.data');
const PERMISSIONS = require('./permissions.data');
const ROLE_PERMISSIONS = require('./role-permissions.data');
const { auth } = require('../services')();
const { hashPassword } = auth;

async function ensureRolesAndPermissions() {
  for (const r of ROLES) {
    await Role.findOneAndUpdate(
      { role_key: r.role_key },
      { $set: r },
      { upsert: true, new: true }
    );
  }

  const permissionDocs = [];
  for (const p of PERMISSIONS) {
    const doc = await Permission.findOneAndUpdate(
      { code_permission: p.code },
      {
        $set: {
          code_permission: p.code,
          slug: p.slug,
          name: p.name,
          module: p.module,
          resource: p.resource,
          action: p.action,
          applicable_role_types: p.applicable_role_types,
        },
      },
      { upsert: true, new: true }
    );
    permissionDocs.push(doc);
  }

  const validCodes = PERMISSIONS.map((p) => p.code);
  await Permission.updateMany(
    { code_permission: { $nin: validCodes }, is_deleted: false },
    { $set: { is_deleted: true } }
  );

  const superadminRole = await Role.findOne({ role_key: 'superadmin' });
  for (const perm of permissionDocs) {
    await RolePermission.findOneAndUpdate(
      { role: superadminRole._id, permission: perm._id, establishment: null },
      {
        $set: {
          role: superadminRole._id,
          permission: perm._id,
          establishment: null,
          is_active: true,
          is_deleted: false,
        },
      },
      { upsert: true }
    );
  }

  const permByCode = Object.fromEntries(permissionDocs.map((p) => [p.code_permission, p]));
  for (const [roleKey, codes] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await Role.findOne({ role_key: roleKey });
    if (!role) continue;

    const allowedPermIds = [];
    for (const code of codes) {
      const perm = permByCode[code];
      if (!perm) continue;
      allowedPermIds.push(perm._id);
      await RolePermission.findOneAndUpdate(
        { role: role._id, permission: perm._id, establishment: null },
        {
          $set: {
            role: role._id,
            permission: perm._id,
            establishment: null,
            is_active: true,
            is_deleted: false,
          },
        },
        { upsert: true }
      );
    }

    const revokeQuery = {
      role: role._id,
      establishment: null,
    };
    if (allowedPermIds.length) {
      revokeQuery.permission = { $nin: allowedPermIds };
    }
    await RolePermission.updateMany(
      revokeQuery,
      { $set: { is_active: false, is_deleted: true } }
    );
  }
}

async function ensureDefaultSuperadmin() {
  const role = await Role.findOne({ role_key: 'superadmin' });
  if (!role) {
    throw new Error('Rôle superadmin introuvable après bootstrap des rôles.');
  }

  const username = process.env.SUPERADMIN_USERNAME || 'superadmin';
  const password = process.env.SUPERADMIN_PASSWORD || 'SuperAdmin@123';
  const fullname = process.env.SUPERADMIN_FULLNAME || 'Super Admin';
  const email = process.env.SUPERADMIN_EMAIL || 'superadmin@local.pos';

  const existing = await User.findOne({
    role: role._id,
    is_deleted: false,
  }).select('_id username');
  if (existing) return existing;

  const hashed = await hashPassword(password);
  return User.create({
    role: role._id,
    username,
    fullname,
    email,
    password: hashed,
    status: 'actif',
  });
}

async function ensureBootstrapData() {
  await ensureRolesAndPermissions();
  await ensureDefaultSuperadmin();
}

module.exports = { ensureBootstrapData };
