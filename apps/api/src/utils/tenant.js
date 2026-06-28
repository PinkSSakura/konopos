const { Role, Establishment } = require('../models');

async function resolveRoleKey(user) {
  if (!user?.role) return null;
  if (user.role.role_key) return user.role.role_key;
  const roleId = user.role._id || user.role;
  const role = await Role.findById(roleId).select('role_key').lean();
  return role?.role_key || null;
}

function getUserEstablishmentId(user) {
  if (!user?.establishment) return null;
  const est = user.establishment;
  return est._id || est;
}

async function findEstablishmentForUser(user) {
  const directId = getUserEstablishmentId(user);
  if (directId) {
    const establishment = await Establishment.findById(directId);
    if (establishment && !establishment.is_deleted) {
      return establishment;
    }
  }

  const roleKey = await resolveRoleKey(user);
  if (roleKey === 'superadmin') {
    const complete = await Establishment.findOne({ is_deleted: false, is_setup_complete: true });
    if (complete) return complete;
    return Establishment.findOne({ is_deleted: false }).sort({ createdAt: 1 });
  }

  return Establishment.findOne({ is_deleted: false, is_setup_complete: true });
}

async function resolveEstablishmentId(req) {
  const directId = getUserEstablishmentId(req.user);
  if (directId) {
    const est = await Establishment.findById(directId).select('_id is_deleted');
    if (est && !est.is_deleted) return est._id;
  }

  const roleKey = await resolveRoleKey(req.user);
  if (roleKey === 'superadmin') {
    const doc = await Establishment.findOne({
      is_deleted: false,
      is_setup_complete: true,
    }).select('_id');
    if (doc) return doc._id;
    const fallback = await Establishment.findOne({ is_deleted: false })
      .select('_id')
      .sort({ createdAt: 1 });
    return fallback?._id || null;
  }

  return null;
}

module.exports = {
  resolveRoleKey,
  getUserEstablishmentId,
  findEstablishmentForUser,
  resolveEstablishmentId,
};
