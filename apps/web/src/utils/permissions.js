export function isSuperAdmin(user) {
  if (!user) return false;
  if (user === 'superadmin') return true;
  return user?.role?.role_key === 'superadmin';
}

export function getPermissionCodes(user) {
  if (!user) return [];
  if (Array.isArray(user.permissions)) return user.permissions;
  return [];
}

export function hasPermission(user, code) {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  return getPermissionCodes(user).includes(code);
}

export function hasAnyPermission(user, codes = []) {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  const granted = getPermissionCodes(user);
  return codes.some((code) => granted.includes(code));
}

export function hasAllPermissions(user, codes = []) {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  const granted = getPermissionCodes(user);
  return codes.every((code) => granted.includes(code));
}

export const MENU_ADMIN_PERMISSIONS = [
  'category_view',
  'subcategory_view',
  'item_view',
  'extra_view',
  'category_create',
  'subcategory_create',
  'item_create',
  'extra_create',
];

export function canAccessMenuAdmin(user) {
  return hasAnyPermission(user, MENU_ADMIN_PERMISSIONS);
}

export function canViewCatalog(user) {
  return hasPermission(user, 'catalog_view');
}

export function canViewTables(user) {
  return hasPermission(user, 'table_view');
}

export function canViewKdsFood(user) {
  return hasPermission(user, 'kds_food');
}

export function canViewKdsDrink(user) {
  return hasPermission(user, 'kds_drink');
}

export function canViewKdsBoth(user) {
  return hasPermission(user, 'kds_both');
}
