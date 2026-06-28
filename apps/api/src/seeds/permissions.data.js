const { buildPermissionCatalog } = require('./permissions.catalog');

const DEFINITIONS = buildPermissionCatalog();

const PERMISSIONS = DEFINITIONS.map((p) => ({
  code: p.code,
  slug: p.slug,
  name: p.name,
  module: p.module,
  resource: p.resource,
  action: p.action,
  applicable_role_types: JSON.stringify(p.applicable_role_types),
}));

module.exports = PERMISSIONS;
module.exports.DEFINITIONS = DEFINITIONS;
