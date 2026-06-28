const { resolveEstablishmentId } = require('./tenant');

function baseQuery(establishmentId, { includeDeleted = false } = {}) {
  const q = { establishment: establishmentId };
  if (!includeDeleted) q.is_deleted = false;
  return q;
}

function getEstablishmentId(req) {
  const est = req.user?.establishment;
  return est?._id || est;
}

module.exports = { baseQuery, getEstablishmentId, resolveEstablishmentId };
