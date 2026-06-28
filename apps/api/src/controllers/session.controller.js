const { query } = require('../utils')();
const { getEstablishmentId } = query;
const { session } = require('../services')();
const { listActiveSessions, forceLogoutSession } = session;

async function list(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const data = await listActiveSessions(estId, req.session?._id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function forceLogout(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    await forceLogoutSession({
      sessionId: req.params.id,
      establishmentId: estId,
      forcedBy: req.user,
      req,
    });
    res.json({ success: true, message: 'Session déconnectée.' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    return next(err);
  }
}

module.exports = { list, forceLogout };
