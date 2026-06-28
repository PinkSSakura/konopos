/**
 * Rôles direction / super utilisateur — inclure superadmin dans toute nouvelle fonctionnalité réservée à la gestion.
 */
export const LEADERSHIP_ROLES = ['superadmin', 'owner', 'manager'];

/** Dépenses : consultation et gestion */
export const EXPENSE_ROLES = ['superadmin', 'owner', 'manager', 'submanager'];

/** Tableau de bord analytique (revenus, pertes, périodes jour/semaine/mois/année) */
export const ANALYTICS_ROLES = ['superadmin', 'owner', 'manager'];

/** Export rapports personnel journalier (équipe) */
export const STAFF_REPORT_LEADERSHIP_ROLES = ['superadmin', 'owner', 'manager', 'submanager'];

export function isLeadershipRole(roleKey) {
  return LEADERSHIP_ROLES.includes(roleKey);
}
