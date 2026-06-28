/** Rôles dont l'activité apparaît dans le journal équipe (pas le journal système). */
const STAFF_ACTIVITY_ACTOR_ROLES = ['waiter', 'cook', 'barman', 'manager', 'submanager'];

/** Rôles autorisés à consulter le journal équipe. */
const STAFF_ACTIVITY_VIEWER_ROLES = ['owner', 'manager', 'submanager', 'superadmin'];

module.exports = {
  STAFF_ACTIVITY_ACTOR_ROLES,
  STAFF_ACTIVITY_VIEWER_ROLES,
};
