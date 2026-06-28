const { query } = require('../utils')();
const { resolveEstablishmentId } = query;
const { audit } = require('../services')();
const { listAuditLogs, listStaffActivityLogs } = audit;
const { STAFF_ACTIVITY_VIEWER_ROLES } = require('../constants/activity-roles');

async function listSystemAudit(req, res, next) {
  try {
    const estId = await resolveEstablishmentId(req);
    if (!estId) {
      return res.status(404).json({ success: false, message: 'Établissement introuvable.' });
    }
    const data = await listAuditLogs(estId, req.query);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function listStaffActivity(req, res, next) {
  try {
    const roleKey = req.user?.role?.role_key;
    if (!STAFF_ACTIVITY_VIEWER_ROLES.includes(roleKey)) {
      return res.status(403).json({
        success: false,
        message: 'Accès réservé à la direction.',
      });
    }

    const estId = await resolveEstablishmentId(req);
    if (!estId) {
      return res.status(404).json({ success: false, message: 'Établissement introuvable.' });
    }

    const data = await listStaffActivityLogs(estId, req.query);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listSystemAudit,
  listStaffActivity,
};
