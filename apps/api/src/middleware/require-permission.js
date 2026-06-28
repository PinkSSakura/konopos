const { permission } = require('../services')();
const { userHasPermission } = permission;


function requirePermission(permissionCode) {
  return async (req, res, next) => {
    try {
      const allowed = await userHasPermission(
        req.user,
        permissionCode,
        req.user?.establishment?._id
      );
      if (!allowed) {
        return res.status(403).json({ success: false, message: 'Permission refusée.' });
      }
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = requirePermission;
