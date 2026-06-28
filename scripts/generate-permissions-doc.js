const fs = require('fs');
const path = require('path');
const { DEFINITIONS } = require('../apps/api/src/seeds/permissions.data.js');
const ROLE_PERMISSIONS = require('../apps/api/src/seeds/role-permissions.data.js');

const ROLES = [
  { role_key: 'superadmin', name: 'Super Admin', display_name: 'SUPERADMIN', role_type: 'backoffice' },
  { role_key: 'owner', name: 'Propriétaire', display_name: 'PROPRIÉTAIRE', role_type: 'backoffice' },
  { role_key: 'manager', name: 'Manager', display_name: 'MANAGER', role_type: 'backoffice' },
  { role_key: 'submanager', name: 'Sous-manager', display_name: 'SOUS-MANAGER', role_type: 'backoffice' },
  { role_key: 'waiter', name: 'Serveur', display_name: 'SERVEUR', role_type: 'frontoffice' },
  { role_key: 'barman', name: 'Barman', display_name: 'BARMAN', role_type: 'frontoffice' },
  { role_key: 'cook', name: 'Cuisinier', display_name: 'CUISINIER', role_type: 'frontoffice' },
  { role_key: 'systempos', name: 'SystemPOS', display_name: 'SYSTEMPOS', role_type: 'systemoffice' },
];

const MODULE_INFO = {
  analytics: { label: 'Analytics', area: 'Back-office / staff' },
  menu: { label: 'Menu', area: 'Back-office / frontoffice' },
  audit: { label: 'Audit', area: 'Back-office' },
  activity: { label: 'Journal équipe', area: 'Back-office' },
  backup: { label: 'Backup', area: 'Système' },
  catalog: { label: 'Catalogue POS', area: 'Opérations' },
  clients: { label: 'Clients', area: 'Caisse / admin' },
  establishment: { label: 'Établissement', area: 'Admin' },
  expenses: { label: 'Dépenses', area: 'Admin' },
  printers: { label: 'Imprimantes & tickets', area: 'POS / admin' },
  kds: { label: 'KDS', area: 'Production' },
  license: { label: 'Licence', area: 'Admin' },
  orders: { label: 'Commandes', area: 'POS' },
  payments: { label: 'Paiements', area: 'Caisse' },
  permissions: { label: 'Permissions', area: 'Admin' },
  reports: { label: 'Rapports', area: 'Admin / staff' },
  roles: { label: 'Rôles', area: 'Superadmin' },
  shifts: { label: 'Shifts', area: 'Opérations' },
  floor: { label: 'Salles (floor)', area: 'Salle' },
  tables: { label: 'Tables', area: 'Salle' },
  users: { label: 'Utilisateurs', area: 'Admin' },
};

const OPERATIONAL = ROLES.map((r) => r.role_key).filter((k) => k !== 'superadmin');
const ALL_SLUGS = DEFINITIONS.map((p) => p.slug);

const lines = [];
lines.push('# KonoPOS — Modules, rôles & permissions');
lines.push('');
lines.push('> Rebuilt from `tables.txt` via `apps/api/src/seeds/permissions.catalog.js`.');
lines.push('> **Runtime key:** `slug` (ex. `order_create`). **DB code:** `PREFIX-00001` (ex. `ORD-00004`).');
lines.push('> **Default grants:** only **Super Admin** at seed — assign other roles in **Rôles & permissions**.');
lines.push('');
lines.push('| Élément | Valeur |');
lines.push('|---------|--------|');
lines.push(`| Permissions | **${DEFINITIONS.length}** |`);
lines.push(`| Rôles | **${ROLES.length}** |`);
lines.push('| SA default grants | **All permissions** |');
lines.push('| Other roles default grants | **None** (configure in UI) |');
lines.push('');
lines.push('## Rôles');
lines.push('');
lines.push('| role_key | display_name | Type | code_role |');
lines.push('|----------|--------------|------|-----------|');
const roleCodes = {
  superadmin: 'SA00000', owner: 'OW00000', manager: 'MG00000', submanager: 'SM00000',
  waiter: 'WT00000', barman: 'BR00000', cook: 'CK00000', systempos: 'SY00000',
};
for (const r of ROLES) {
  lines.push(`| \`${r.role_key}\` | ${r.display_name} | \`${r.role_type}\` | \`${roleCodes[r.role_key]}\` |`);
}
lines.push('');
lines.push('---');
lines.push('');
lines.push('## Modules & permissions');
lines.push('');

const modules = [...new Set(DEFINITIONS.map((p) => p.module))].sort();
for (const mod of modules) {
  const info = MODULE_INFO[mod] || { label: mod, area: '—' };
  const perms = DEFINITIONS.filter((p) => p.module === mod);
  lines.push(`### ${info.label} (\`${mod}\`) — ${info.area}`);
  lines.push('');
  lines.push('| Code | Slug (runtime) | Nom | Suggested roles* |');
  lines.push('|------|----------------|-----|------------------|');
  for (const p of perms) {
    const suggested = p.suggested_default_roles?.length
      ? p.suggested_default_roles.map((k) => `\`${k}\``).join(', ')
      : '—';
    lines.push(`| \`${p.code}\` | \`${p.slug}\` | ${p.name} | ${suggested} |`);
  }
  lines.push('');
  lines.push('*Suggested roles = reference from `tables.txt` only — not auto-assigned at seed.*');
  lines.push('');
}

lines.push('---');
lines.push('');
lines.push('## Assignation par rôle (seed)');
lines.push('');
for (const roleKey of OPERATIONAL) {
  const allowed = ROLE_PERMISSIONS[roleKey] || [];
  lines.push(`- **${roleKey}:** ${allowed.length ? allowed.join(', ') : '_aucune — à configurer par SA_'}`);
}
lines.push('- **superadmin:** toutes les permissions');
lines.push('');
lines.push('---');
lines.push('');
lines.push('## Notes');
lines.push('');
lines.push('1. Utiliser les **slugs** dans le code (`requirePermission(\'order_create\')`).');
lines.push('2. Les codes `XXX-00001` sont stables en base pour l’UI admin.');
lines.push('3. `floor_*` remplace l’ancien module `room_*`.');
lines.push('4. `client_*` remplace `customer_*`.');
lines.push('5. `item_*` remplace `menu_item_*`.');
lines.push('6. Soft-delete permissions utilisent `*_softdelete` au lieu de `*.delete`.');
lines.push('');

fs.writeFileSync(path.join(__dirname, '..', 'MODULES-AND-PERMISSIONS.md'), lines.join('\n'), 'utf8');
console.log(`Wrote MODULES-AND-PERMISSIONS.md (${DEFINITIONS.length} permissions)`);
