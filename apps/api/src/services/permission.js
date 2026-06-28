const { RolePermission, Permission } = require('../models');
const { resolveRoleKey } = require('../utils/tenant');

async function findPermissionRecord(permissionKey) {
  if (!permissionKey) return null;
  return Permission.findOne({
    is_deleted: false,
    is_active: true,
    $or: [
      { slug: permissionKey },
      { code_permission: permissionKey },
    ],
  });
}

async function userHasPermission(user, permissionKey, establishmentId) {
  if (!user?.role) return false;

  const roleKey = await resolveRoleKey(user);
  if (roleKey === 'superadmin') return true;

  const permission = await findPermissionRecord(permissionKey);
  if (!permission) return false;

  const query = {
    role: user.role._id || user.role,
    permission: permission._id,
    is_active: true,
    is_deleted: false,
  };
  if (establishmentId) {
    query.$or = [{ establishment: establishmentId }, { establishment: null }];
  }

  const grant = await RolePermission.findOne(query);
  return Boolean(grant);
}

async function getUserPermissionCodes(user, establishmentId) {
  if (!user?.role) return [];

  const roleKey = await resolveRoleKey(user);
  if (roleKey === 'superadmin') {
    const permissions = await Permission.find({ is_deleted: false, is_active: true })
      .select('slug code_permission');
    return permissions.map((permission) => permission.slug || permission.code_permission);
  }

  const roleId = user.role._id || user.role;
  const query = {
    role: roleId,
    is_active: true,
    is_deleted: false,
  };
  if (establishmentId) {
    query.$or = [{ establishment: establishmentId }, { establishment: null }];
  }

  const grants = await RolePermission.find(query).populate('permission');
  const codes = new Set();
  for (const grant of grants) {
    const slug = grant.permission?.slug || grant.permission?.code_permission;
    if (slug && !grant.permission.is_deleted) codes.add(slug);
  }
  return [...codes];
}

module.exports = { userHasPermission, getUserPermissionCodes, resolveRoleKey, findPermissionRecord };
