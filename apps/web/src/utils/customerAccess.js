import { hasAnyPermission, hasPermission } from './permissions';

export function canViewCustomers(user) {
  return hasPermission(user, 'client_view');
}

export function canManageCustomers(user) {
  return hasAnyPermission(user, [
    'client_create',
    'client_update',
    'client_softdelete',
    'client_manage_savings',
    'client_manage_debt',
  ]);
}
