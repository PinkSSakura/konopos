export function canViewLicense(user) {
  return user?.role?.role_key === 'superadmin';
}

export const canViewLicenseInfo = canViewLicense;
