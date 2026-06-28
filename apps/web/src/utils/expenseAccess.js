import { hasAnyPermission, hasPermission } from './permissions';

export function canManageExpenses(user) {
  return hasPermission(user, 'expense_view');
}

export function canEditExpenses(user) {
  return hasAnyPermission(user, [
    'expense_create',
    'expense_update',
    'expense_softdelete',
  ]);
}
