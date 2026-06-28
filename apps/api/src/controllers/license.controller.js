const { serializers } = require('../utils')();
const { serializeLicenseStatusPublic } = serializers;
const { license: licenseService } = require('../services')();


async function getStatus(req, res, next) {
  try {
    const data = await licenseService.getLicenseStatus();
    res.json({ success: true, data: serializeLicenseStatusPublic(data) });
  } catch (err) {
    next(err);
  }
}

async function getFingerprint(req, res, next) {
  try {
    res.json({
      success: true,
      data: {
        fingerprint: licenseService.getMachineFingerprint(),
      },
    });
  } catch (err) {
    next(err);
  }
}

async function activate(req, res, next) {
  try {
    const { period, days, expires_at: expiresAt } = req.body;
    const raw = await licenseService.activateLicense({
      periodKey: period,
      customDays: days,
      expiresAt,
      issuedBy: req.user._id,
    });
    res.json({
      success: true,
      data: serializeLicenseStatusPublic(raw),
      message: 'Licence activée pour cette machine.',
    });
  } catch (err) {
    next(err);
  }
}

async function revoke(req, res, next) {
  try {
    const raw = await licenseService.revokeAllLicenses();
    res.json({
      success: true,
      data: {
        ...serializeLicenseStatusPublic(raw),
        revoked_count: raw.revoked_count,
      },
      message: raw.revoked_count
        ? 'Licence révoquée et supprimée de cette installation.'
        : 'Aucune licence à révoquer.',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getStatus,
  getFingerprint,
  activate,
  revoke,
};
