const { kds } = require('../utils')();
const { isKitchenStaffRole } = kds;


/** Cuisine / bar : consultation des commandes uniquement */
function blockKitchenStaff(req, res, next) {
  if (isKitchenStaffRole(req.user?.role?.role_key)) {
    return res.status(403).json({
      success: false,
      message: 'Accès lecture seule pour ce rôle.',
    });
  }
  return next();
}

module.exports = blockKitchenStaff;
