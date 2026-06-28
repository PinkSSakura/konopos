/**
 * Permission catalog — source layout from tables.txt
 * - code: PREFIX-00001 (DB unique)
 * - slug: runtime key used in API/UI checks
 * - suggested_default_roles: documentation / SA reference only (not auto-seeded)
 */

const ROLE_TYPES = {
  BACKOFFICE: 'backoffice',
  FRONTOFFICE: 'frontoffice',
  SYSTEMOFFICE: 'systemoffice',
};

const BO = ROLE_TYPES.BACKOFFICE;
const FO = ROLE_TYPES.FRONTOFFICE;
const SO = ROLE_TYPES.SYSTEMOFFICE;
const BO_FO = [BO, FO];
const BO_FO_SO = [BO, FO, SO];

const counters = {};

function nextCode(prefix) {
  counters[prefix] = (counters[prefix] || 0) + 1;
  return `${prefix}-${String(counters[prefix]).padStart(5, '0')}`;
}

function perm({
  prefix,
  slug,
  name,
  module,
  resource,
  action,
  applicable_role_types,
  suggested_default_roles = [],
}) {
  return {
    code: nextCode(prefix),
    slug,
    name,
    module,
    resource,
    action,
    applicable_role_types,
    suggested_default_roles,
  };
}

function buildPermissionCatalog() {
  counters.PREFIX = 0;
  Object.keys(counters).forEach((k) => { counters[k] = 0; });

  const list = [];

  const add = (entry) => {
    list.push(perm(entry));
    return list[list.length - 1];
  };

  const menuCrud = (prefix, resource, label, uploadSlug) => {
    const actions = [
      ['view', `${resource}_view`, `Voir ${label}`],
      ['create', `${resource}_create`, `Créer ${label}`],
      ['update', `${resource}_update`, `Modifier ${label}`],
      ['softdelete', `${resource}_softdelete`, `Supprimer ${label}`],
      ['restore', `${resource}_restore`, `Restaurer ${label}`],
      ['view_deleted', `${resource}_view_deleted`, `Voir ${label} supprimés`],
    ];
    for (const [action, slug, name] of actions) {
      add({
        prefix,
        slug,
        name,
        module: 'menu',
        resource,
        action,
        applicable_role_types: BO_FO,
        suggested_default_roles: ['superadmin', 'owner', 'manager', 'submanager', 'waiter'],
      });
    }
    if (uploadSlug) {
      add({
        prefix,
        slug: uploadSlug,
        name: `Image ${label}`,
        module: 'menu',
        resource,
        action: 'upload_image',
        applicable_role_types: BO_FO,
        suggested_default_roles: ['superadmin', 'owner', 'manager', 'submanager', 'waiter'],
      });
    }
  };

  // Analytics
  add({ prefix: 'ANA', slug: 'view_dashboard', name: 'Tableau de bord business', module: 'analytics', resource: 'dashboard', action: 'view', applicable_role_types: BO_FO, suggested_default_roles: ['superadmin', 'owner', 'manager', 'submanager'] });
  add({ prefix: 'ANA', slug: 'self_dashboard', name: 'Tableau de bord personnel', module: 'analytics', resource: 'dashboard', action: 'self', applicable_role_types: BO_FO, suggested_default_roles: ['superadmin', 'owner', 'manager', 'submanager', 'waiter'] });
  add({ prefix: 'ANA', slug: 'export_pdf', name: 'Export PDF analytics', module: 'analytics', resource: 'dashboard', action: 'export_pdf', applicable_role_types: BO_FO, suggested_default_roles: ['superadmin', 'owner', 'manager', 'submanager'] });

  // Menu
  menuCrud('CAT', 'category', 'catégorie', 'category_upload_image');
  menuCrud('SUB', 'subcategory', 'sous-catégorie', 'subcategory_upload_image');
  menuCrud('EXT', 'extra', 'extra', 'extra_upload_image');
  menuCrud('ITM', 'item', 'article', 'item_upload_image');

  // Audit & activity
  add({ prefix: 'AUD', slug: 'audit_view', name: 'Voir journal audit système', module: 'audit', resource: 'audit', action: 'view', applicable_role_types: [BO], suggested_default_roles: ['superadmin', 'owner'] });
  add({ prefix: 'ACT', slug: 'activity_view', name: 'Voir journal activité équipe', module: 'activity', resource: 'activity', action: 'view', applicable_role_types: [BO], suggested_default_roles: ['superadmin', 'owner', 'manager', 'submanager'] });

  // Backup
  add({ prefix: 'BAK', slug: 'backup_export', name: 'Exporter sauvegarde', module: 'backup', resource: 'backup', action: 'export', applicable_role_types: [BO], suggested_default_roles: ['superadmin'] });
  add({ prefix: 'BAK', slug: 'backup_import', name: 'Importer sauvegarde', module: 'backup', resource: 'backup', action: 'import', applicable_role_types: [BO], suggested_default_roles: ['superadmin'] });

  // Catalog
  add({ prefix: 'CTL', slug: 'catalog_view', name: 'Voir catalogue (POS/KDS)', module: 'catalog', resource: 'catalog', action: 'view', applicable_role_types: BO_FO_SO, suggested_default_roles: ['superadmin', 'owner', 'manager', 'submanager', 'waiter', 'systempos'] });

  // Clients
  const clientActions = [
    ['view', 'client_view', 'Voir clients'],
    ['create', 'client_create', 'Créer client'],
    ['update', 'client_update', 'Modifier client'],
    ['softdelete', 'client_softdelete', 'Supprimer client'],
    ['restore', 'client_restore', 'Restaurer client'],
    ['view_deleted', 'client_view_deleted', 'Voir clients supprimés'],
    ['manage_savings', 'client_manage_savings', 'Gérer épargne client'],
    ['manage_debt', 'client_manage_debt', 'Gérer dette client'],
  ];
  for (const [action, slug, name] of clientActions) {
    add({ prefix: 'CLI', slug, name, module: 'clients', resource: 'client', action, applicable_role_types: BO_FO, suggested_default_roles: ['superadmin', 'owner', 'manager', 'submanager', 'waiter'] });
  }

  // Establishment
  const estActions = [
    ['view', 'establishment_view', 'Voir établissement'],
    ['update', 'establishment_update', 'Modifier établissement'],
    ['upload_image', 'establishment_upload_image', 'Logo établissement'],
    ['legal_update', 'establishment_legal_update', 'Infos légales / fiscales'],
    ['options_update', 'establishment_options_update', 'Options métier (tables, KDS, shifts)'],
  ];
  for (const [action, slug, name] of estActions) {
    add({ prefix: 'EST', slug, name, module: 'establishment', resource: 'establishment', action, applicable_role_types: [BO], suggested_default_roles: ['superadmin', 'owner', 'manager', 'submanager'] });
  }

  // Expenses
  const expenseActions = [
    ['view', 'expense_view', 'Voir dépenses'],
    ['create', 'expense_create', 'Créer dépense'],
    ['update', 'expense_update', 'Modifier dépense'],
    ['softdelete', 'expense_softdelete', 'Supprimer dépense'],
    ['restore', 'expense_restore', 'Restaurer dépense'],
    ['view_deleted', 'expense_view_deleted', 'Voir dépenses supprimées'],
  ];
  for (const [action, slug, name] of expenseActions) {
    add({ prefix: 'EXP', slug, name, module: 'expenses', resource: 'expense', action, applicable_role_types: BO_FO, suggested_default_roles: ['superadmin', 'owner', 'manager', 'submanager', 'waiter'] });
  }

  // Printers (config)
  const printerConfig = [
    ['create', 'printer_create', 'Créer imprimante'],
    ['update', 'printer_update', 'Modifier imprimante'],
    ['delete', 'printer_delete', 'Supprimer imprimante'],
    ['view', 'printer_view', 'Voir imprimantes'],
    ['print_preview', 'printer_print_preview', 'Aperçu impression'],
  ];
  for (const [action, slug, name] of printerConfig) {
    add({ prefix: 'PRT', slug, name, module: 'printers', resource: 'printer', action, applicable_role_types: BO_FO, suggested_default_roles: ['superadmin', 'owner', 'manager', 'submanager'] });
  }

  // Print actions
  const printActions = [
    ['receipt', 'print_receipt', 'Imprimer ticket caisse'],
    ['payment_receipt', 'print_payment_receipt', 'Imprimer ticket paiement'],
    ['reprint', 'print_reprint', 'Réimprimer'],
    ['kitchen', 'print_kitchen', 'Imprimer bon cuisine'],
    ['bar', 'print_bar', 'Imprimer bon bar'],
    ['kitchen_bar', 'print_kitchen_bar', 'Imprimer bon cuisine/bar'],
    ['daily_code', 'print_daily_code', 'Imprimer code du jour'],
    ['order', 'print_order', 'Imprimer commande'],
    ['close_report', 'print_close_report', 'Imprimer rapport clôture'],
    ['close_report_waiters', 'print_close_report_waiters', 'Rapport clôture serveurs'],
    ['close_report_barmans', 'print_close_report_barmans', 'Rapport clôture bar'],
    ['close_report_cooks', 'print_close_report_cooks', 'Rapport clôture cuisine'],
  ];
  for (const [action, slug, name] of printActions) {
    add({ prefix: 'PRN', slug, name, module: 'printers', resource: 'print', action, applicable_role_types: BO_FO, suggested_default_roles: ['superadmin', 'owner', 'manager', 'submanager', 'waiter', 'cook', 'barman'] });
  }

  // KDS
  add({ prefix: 'KDS', slug: 'kds_food', name: 'Écran cuisine', module: 'kds', resource: 'kds', action: 'food', applicable_role_types: BO_FO, suggested_default_roles: ['superadmin', 'owner', 'manager', 'submanager', 'cook', 'systempos'] });
  add({ prefix: 'KDS', slug: 'kds_drink', name: 'Écran bar', module: 'kds', resource: 'kds', action: 'drink', applicable_role_types: BO_FO, suggested_default_roles: ['superadmin', 'owner', 'manager', 'submanager', 'barman', 'systempos'] });
  add({ prefix: 'KDS', slug: 'kds_both', name: 'Écran cuisine + bar', module: 'kds', resource: 'kds', action: 'both', applicable_role_types: BO_FO_SO, suggested_default_roles: ['superadmin', 'owner', 'manager', 'submanager', 'waiter', 'systempos'] });

  // License
  add({ prefix: 'LIC', slug: 'license_view', name: 'Voir licence', module: 'license', resource: 'license', action: 'view', applicable_role_types: [BO], suggested_default_roles: ['superadmin', 'owner', 'manager', 'submanager'] });
  add({ prefix: 'LIC', slug: 'license_activate', name: 'Activer licence', module: 'license', resource: 'license', action: 'activate', applicable_role_types: [BO], suggested_default_roles: ['superadmin'] });
  add({ prefix: 'LIC', slug: 'license_revoke', name: 'Révoquer licence', module: 'license', resource: 'license', action: 'revoke', applicable_role_types: [BO], suggested_default_roles: ['superadmin'] });

  // Orders
  const orderActions = [
    ['view', 'order_view', 'Voir commandes'],
    ['history', 'order_history', 'Historique commandes'],
    ['view_all', 'order_view_all', 'Voir toutes les commandes'],
    ['create', 'order_create', 'Créer commande'],
    ['update', 'order_update', 'Modifier commande'],
    ['cancel', 'order_cancel', 'Annuler commande'],
    ['send', 'order_send', 'Envoyer cuisine / bar'],
    ['mark_served', 'order_mark_served', 'Marquer servi'],
    ['mark_cancelled', 'order_mark_cancelled', 'Marquer annulé'],
    ['item_void', 'order_item_void', 'Annuler article servi / correction'],
  ];
  for (const [action, slug, name] of orderActions) {
    add({ prefix: 'ORD', slug, name, module: 'orders', resource: 'order', action, applicable_role_types: BO_FO_SO, suggested_default_roles: ['superadmin', 'owner', 'manager', 'submanager', 'waiter', 'cook', 'barman', 'systempos'] });
  }
  const orderAllActions = [
    ['update_all', 'order_update_all', 'Modifier toute commande (tous serveurs)'],
    ['cancel_all', 'order_cancel_all', 'Annuler toute commande (tous serveurs)'],
    ['send_all', 'order_send_all', 'Envoyer cuisine — toute commande'],
    ['mark_served_all', 'order_mark_served_all', 'Service — toute commande'],
    ['print_all', 'order_print_all', 'Imprimer — toute commande'],
  ];
  for (const [action, slug, name] of orderAllActions) {
    add({ prefix: 'ORD', slug, name, module: 'orders', resource: 'order', action, applicable_role_types: BO_FO, suggested_default_roles: ['superadmin', 'owner', 'manager', 'submanager'] });
  }

  // Payments
  const payActions = [
    ['process', 'payment_process', 'Encaisser'],
    ['history', 'payment_history', 'Historique paiements'],
    ['day_close', 'payment_day_close', 'Clôture journalière'],
    ['cancel', 'payment_cancel', 'Annuler paiement'],
    ['code_lookup', 'payment_code_lookup', 'Recherche par code du jour'],
  ];
  for (const [action, slug, name] of payActions) {
    add({ prefix: 'PAY', slug, name, module: 'payments', resource: 'payment', action, applicable_role_types: BO_FO_SO, suggested_default_roles: ['superadmin', 'owner', 'manager', 'submanager', 'waiter', 'systempos'] });
  }
  add({ prefix: 'PAY', slug: 'payment_process_all', name: 'Encaisser — toute commande', module: 'payments', resource: 'payment', action: 'process_all', applicable_role_types: BO_FO, suggested_default_roles: ['superadmin', 'owner', 'manager', 'submanager'] });
  add({ prefix: 'PAY', slug: 'payment_cancel_all', name: 'Annuler paiement — toute commande', module: 'payments', resource: 'payment', action: 'cancel_all', applicable_role_types: BO_FO, suggested_default_roles: ['superadmin', 'owner', 'manager', 'submanager'] });

  // Permissions matrix
  add({ prefix: 'PRM', slug: 'permission_view', name: 'Voir matrice permissions', module: 'permissions', resource: 'permission', action: 'view', applicable_role_types: [BO], suggested_default_roles: ['superadmin', 'owner', 'manager', 'submanager'] });
  add({ prefix: 'PRM', slug: 'permission_assign', name: 'Attribuer permissions', module: 'permissions', resource: 'permission', action: 'assign', applicable_role_types: [BO], suggested_default_roles: ['superadmin', 'owner', 'manager', 'submanager'] });

  // Reports
  add({ prefix: 'RPT', slug: 'report_export_staff', name: 'Export PDF personnel (équipe)', module: 'reports', resource: 'staff_report', action: 'export', applicable_role_types: BO_FO, suggested_default_roles: ['superadmin', 'owner', 'manager', 'submanager'] });
  add({ prefix: 'RPT', slug: 'report_self_export', name: 'Export PDF personnel (soi)', module: 'reports', resource: 'staff_report', action: 'export_self', applicable_role_types: BO_FO, suggested_default_roles: ['superadmin', 'owner', 'manager', 'submanager', 'waiter', 'cook', 'barman'] });

  // Roles
  const roleActions = [
    ['create', 'role_create', 'Créer rôle'],
    ['update', 'role_update', 'Modifier rôle'],
    ['delete', 'role_delete', 'Supprimer rôle'],
    ['assign', 'role_assign', 'Attribuer rôle'],
    ['restore', 'role_restore', 'Restaurer rôle'],
    ['view_deleted', 'role_view_deleted', 'Voir rôles supprimés'],
  ];
  for (const [action, slug, name] of roleActions) {
    add({ prefix: 'ROL', slug, name, module: 'roles', resource: 'role', action, applicable_role_types: [BO], suggested_default_roles: ['superadmin'] });
  }

  // Shifts
  const shiftActions = [
    ['view_all', 'shift_view_all', 'Voir tous les shifts'],
    ['view_own', 'shift_view_own', 'Voir son shift'],
    ['history', 'shift_history', 'Historique shifts'],
    ['plan_view', 'shift_plan_view', 'Voir planning shifts'],
    ['plan_create', 'shift_plan_create', 'Créer planning'],
    ['plan_update', 'shift_plan_update', 'Modifier planning'],
    ['plan_delete', 'shift_plan_delete', 'Supprimer planning'],
    ['manage', 'shift_manage', 'Gérer shifts serveurs (ouvrir / clôturer)'],
    ['configure', 'shift_configure', 'Configurer shifts établissement'],
  ];
  for (const [action, slug, name] of shiftActions) {
    const defaults = ['manage', 'configure'].includes(action)
      ? ['superadmin', 'owner', 'manager', 'submanager']
      : ['superadmin', 'owner', 'manager', 'submanager', 'waiter', 'cook', 'barman'];
    add({ prefix: 'SHF', slug, name, module: 'shifts', resource: 'shift', action, applicable_role_types: BO_FO, suggested_default_roles: defaults });
  }

  // Floor
  const floorActions = [
    ['create', 'floor_create', 'Créer salle'],
    ['update', 'floor_update', 'Modifier salle'],
    ['delete', 'floor_delete', 'Supprimer salle'],
    ['view', 'floor_view', 'Voir salles'],
  ];
  for (const [action, slug, name] of floorActions) {
    add({ prefix: 'FLR', slug, name, module: 'floor', resource: 'floor', action, applicable_role_types: BO_FO, suggested_default_roles: ['superadmin', 'owner', 'manager', 'submanager', 'waiter'] });
  }

  // Tables
  const tableActions = [
    ['create', 'table_create', 'Créer table'],
    ['update', 'table_update', 'Modifier table'],
    ['delete', 'table_delete', 'Supprimer table'],
    ['merge', 'table_merge', 'Fusionner tables'],
    ['split', 'table_split', 'Séparer tables'],
    ['assign', 'table_assign', 'Assigner table'],
    ['view', 'table_view', 'Voir tables / plan'],
  ];
  for (const [action, slug, name] of tableActions) {
    add({ prefix: 'TBL', slug, name, module: 'tables', resource: 'table', action, applicable_role_types: BO_FO, suggested_default_roles: ['superadmin', 'owner', 'manager', 'submanager', 'waiter'] });
  }
  add({ prefix: 'TBL', slug: 'table_manage_all', name: 'Gérer tables occupées (tous serveurs)', module: 'tables', resource: 'table', action: 'manage_all', applicable_role_types: BO_FO, suggested_default_roles: ['superadmin', 'owner', 'manager', 'submanager'] });

  // Users
  const userActions = [
    ['create', 'user_create', 'Créer utilisateur'],
    ['update', 'user_update', 'Modifier utilisateur'],
    ['softdelete', 'user_softdelete', 'Supprimer utilisateur'],
    ['view_profile', 'user_view_profile', 'Voir son profil'],
    ['view', 'user_view', 'Voir utilisateurs'],
    ['view_sessions', 'user_view_sessions', 'Voir utilisateurs connectés'],
    ['restore', 'user_restore', 'Restaurer utilisateur'],
    ['view_deleted', 'user_view_deleted', 'Voir utilisateurs supprimés'],
    ['force_logout', 'user_force_logout', 'Forcer déconnexion'],
  ];
  const userMgmtRoles = ['superadmin', 'owner', 'manager', 'submanager'];
  for (const [action, slug, name] of userActions) {
    const suggested = ['view_sessions', 'force_logout'].includes(action)
      ? userMgmtRoles
      : ['superadmin', 'owner', 'manager', 'submanager', 'waiter', 'cook', 'barman'];
    add({ prefix: 'USR', slug, name, module: 'users', resource: 'user', action, applicable_role_types: BO_FO, suggested_default_roles: suggested });
  }

  return list;
}

module.exports = { buildPermissionCatalog, ROLE_TYPES };
