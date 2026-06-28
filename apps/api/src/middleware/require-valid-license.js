const { license: licenseService } = require('../services')();

module.exports = async function requireValidLicense(req, res, next) {
  try {
    const status = await licenseService.getLicenseStatus();
    if (status.valid) {
      req.license = status;
      return next();
    }

    return res.status(403).json({
      success: false,
      code: status.code || 'LICENSE_INVALID',
      message: status.message || 'Licence requise.',
      data: {
        fingerprint: status.fingerprint,
        expires_at: status.expires_at || null,
      },
    });
  } catch (err) {
    next(err);
  }
};
