const { permission } = require('../services')();
const { userHasPermission } = permission;


function requireAnyPermission(permissionCodes) {
  const codes = Array.isArray(permissionCodes) ? permissionCodes : [permissionCodes];
  return async (req, res, next) => {
    try {
      const estId = req.user?.establishment?._id;
      for (const code of codes) {
        // eslint-disable-next-line no-await-in-loop
        const allowed = await userHasPermission(req.user, code, estId);
        if (allowed) return next();
      }
      return res.status(403).json({ success: false, message: 'Permission refusée.' });
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = requireAnyPermission;
