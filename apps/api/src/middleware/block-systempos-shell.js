function blockSystemposShell(req, res, next) {
  if (req.session?.is_pin_session) {
    return next();
  }
  if (req.user?.role?.role_key === 'systempos') {
    return res.status(403).json({
      success: false,
      message: 'Terminal SystemPOS — saisissez un PIN pour continuer.',
      code: 'SYSTEMPOS_SHELL',
    });
  }
  return next();
}

module.exports = blockSystemposShell;
