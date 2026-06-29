const { query } = require('../utils')();
const { getEstablishmentId } = query;
const { shift } = require('../services')();
const { requiresManualShiftStart, findActiveShift, resolveEstablishmentForUser } = shift;

async function requireOpenShift(req, res, next) {
  try {
    const roleKey = req.user?.role?.role_key;
    const establishment = await resolveEstablishmentForUser(req.user);
    if (!requiresManualShiftStart(roleKey, establishment)) return next();

    const estId = getEstablishmentId(req);
    const active = await findActiveShift(req.user._id, estId);
    if (!active) {
      const msg = roleKey === 'waiter'
        ? 'Aucun shift ouvert. Demandez à un administrateur de démarrer votre shift.'
        : 'Shift fermé. Ouvrez un shift pour continuer.';
      return res.status(423).json({
        success: false,
        message: msg,
        code: 'SHIFT_REQUIRED',
      });
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = requireOpenShift;
