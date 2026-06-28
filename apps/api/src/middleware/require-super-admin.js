function requireSuperAdmin(req, res, next) {
  if (req.user?.role?.role_key !== 'superadmin') {
    return res.status(403).json({
      success: false,
      message: 'Accès réservé au Super Admin.',
    });
  }
  return next();
}

module.exports = requireSuperAdmin;
