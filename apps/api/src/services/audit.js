const { AuditLog, User } = require('../models');
const { STAFF_ACTIVITY_ACTOR_ROLES } = require('../constants/activity-roles');
const { labelAction, labelModule } = require('../utils/auditlabels');

function parseDayBounds(fromStr, toStr) {
  let from = fromStr ? new Date(`${fromStr}T00:00:00`) : null;
  let to = toStr ? new Date(`${toStr}T23:59:59.999`) : null;
  if (from && Number.isNaN(from.getTime())) from = null;
  if (to && Number.isNaN(to.getTime())) to = null;
  if (!from && !to) {
    to = new Date();
    from = new Date();
    from.setDate(from.getDate() - 7);
    from.setHours(0, 0, 0, 0);
  }
  return { from, to };
}

async function logAudit({
  establishment,
  user,
  action,
  module,
  resource,
  resource_id,
  description,
  metadata,
  req,
  success = true,
  audience = 'system',
}) {
  const entry = new AuditLog({
    establishment,
    user: user?._id || user,
    action,
    module,
    resource,
    resource_id,
    description,
    metadata,
    success,
    audience,
    ip: req?.ip || req?.headers?.['x-forwarded-for'],
    user_agent: req?.headers?.['user-agent'],
  });
  await entry.save();
  return entry;
}

/**
 * Journal équipe — visible owner / manager / submanager.
 * N'enregistre que si l'acteur est serveur, cuisine, bar ou encadrement.
 */
async function logStaffActivity({
  establishment,
  user,
  action,
  module,
  resource,
  resource_id,
  description,
  metadata,
  req,
  success = true,
}) {
  const roleKey = user?.role?.role_key || user?.role_key;
  if (!STAFF_ACTIVITY_ACTOR_ROLES.includes(roleKey)) {
    return null;
  }

  return logAudit({
    establishment,
    user,
    action,
    module,
    resource,
    resource_id,
    description,
    metadata,
    req,
    success,
    audience: 'staff',
  });
}

function formatLogRow(row) {
  const actor = row.user;
  return {
    _id: row._id,
    createdAt: row.createdAt,
    action: row.action,
    action_label: labelAction(row.action),
    module: row.module,
    module_label: labelModule(row.module),
    resource: row.resource,
    resource_id: row.resource_id,
    description: row.description,
    success: row.success,
    audience: row.audience || 'system',
    metadata: row.metadata,
    user: actor
      ? {
          _id: actor._id,
          fullname: actor.fullname,
          username: actor.username,
          role_key: actor.role?.role_key,
          role_name: actor.role?.name,
        }
      : null,
  };
}

async function listAuditLogs(establishmentId, query = {}) {
  const { from, to } = parseDayBounds(query.from, query.to);
  const filter = { establishment: establishmentId };

  if (query.scope === 'staff') {
    filter.audience = 'staff';
  } else if (query.scope === 'system') {
    filter.$or = [{ audience: 'system' }, { audience: null }, { audience: { $exists: false } }];
  }

  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = from;
    if (to) filter.createdAt.$lte = to;
  }
  if (query.action) filter.action = query.action;
  if (query.module) filter.module = query.module;
  if (query.user_id) filter.user = query.user_id;

  const limit = Math.min(Number(query.limit) || 100, 500);
  const rows = await AuditLog.find(filter)
    .populate({ path: 'user', select: 'fullname username role', populate: { path: 'role', select: 'role_key name' } })
    .sort({ createdAt: -1 })
    .limit(limit);

  return rows.map(formatLogRow);
}

async function listStaffActivityLogs(establishmentId, query = {}) {
  const { from, to } = parseDayBounds(query.from, query.to);
  const filter = {
    establishment: establishmentId,
    audience: 'staff',
  };

  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = from;
    if (to) filter.createdAt.$lte = to;
  }
  if (query.action) filter.action = query.action;
  if (query.module) filter.module = query.module;

  const users = await User.find({
    establishment: establishmentId,
    is_deleted: false,
  }).populate('role', 'role_key');

  let actorIds = users
    .filter((u) => STAFF_ACTIVITY_ACTOR_ROLES.includes(u.role?.role_key))
    .map((u) => u._id);

  if (query.role_key) {
    actorIds = users
      .filter((u) => u.role?.role_key === query.role_key)
      .map((u) => u._id);
  }

  if (query.user_id) {
    filter.user = query.user_id;
  } else if (actorIds.length) {
    filter.user = { $in: actorIds };
  } else {
    return [];
  }

  const limit = Math.min(Number(query.limit) || 100, 500);
  const rows = await AuditLog.find(filter)
    .populate({ path: 'user', select: 'fullname username role', populate: { path: 'role', select: 'role_key name' } })
    .sort({ createdAt: -1 })
    .limit(limit);

  return rows.map(formatLogRow);
}

module.exports = {
  logAudit,
  logStaffActivity,
  listAuditLogs,
  listStaffActivityLogs,
};
