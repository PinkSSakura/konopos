import { hasPermission } from './permissions';

export function canViewLicense(user) {
  return hasPermission(user, 'license_view');
}

export const canViewLicenseInfo = canViewLicense;
