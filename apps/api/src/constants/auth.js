/** Rôles avec PIN 6 chiffres (unique par établissement) */
const PIN_ROLES = ['waiter', 'manager', 'submanager', 'cook', 'barman'];

/** Rôles interdits d'avoir un PIN */
const NO_PIN_ROLES = [];

/** Rôles avec identifiant + mot de passe obligatoires à la création */
const PASSWORD_REQUIRED_ROLES = [
  'owner',
  'manager',
  'submanager',
  'waiter',
  'barman',
  'cook',
  'systempos',
];

module.exports = {
  PIN_ROLES,
  NO_PIN_ROLES,
  PASSWORD_REQUIRED_ROLES,
};
