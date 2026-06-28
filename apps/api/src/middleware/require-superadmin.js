module.exports = function requireSuperAdmin(req, res, next) {
  if (req.user?.role?.role_key === 'superadmin') {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Accès réservé au super administrateur.',
  });
};
