const ACTION_LABELS = {
  login: 'Connexion',
  login_failed: 'Échec connexion',
  pin_login: 'Connexion PIN',
  pin_login_failed: 'Échec PIN',
  logout: 'Déconnexion',
  create: 'Création',
  update: 'Modification',
  delete: 'Suppression',
  checkout: 'Encaissement',
  void: 'Annulation paiement',
  cancel: 'Annulation commande',
  send_kitchen: 'Envoi cuisine / bar',
  void_item: 'Annulation article',
  replace_item: 'Remplacement article',
  mark_delivered: 'Commande livrée',
  shift_start: 'Ouverture shift',
  shift_close: 'Clôture shift',
  daily_close: 'Clôture journalière',
  permission_change: 'Modification permissions',
  setup: 'Configuration initiale',
};

const MODULE_LABELS = {
  auth: 'Authentification',
  orders: 'Commandes',
  payments: 'Paiements',
  shifts: 'Shifts',
  menu: 'Menu',
  users: 'Utilisateurs',
  roles: 'Rôles',
  establishment: 'Établissement',
  setup: 'Installation',
};

function labelAction(action) {
  return ACTION_LABELS[action] || action || '—';
}

function labelModule(module) {
  return MODULE_LABELS[module] || module || '—';
}

module.exports = {
  ACTION_LABELS,
  MODULE_LABELS,
  labelAction,
  labelModule,
};
