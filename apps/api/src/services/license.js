const os = require('os');
const crypto = require('crypto');
const { execSync } = require('child_process');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { getDb } = require('../db/sqlite');
const { deleteModelData } = require('../db/model-schemas');
const { InstallationLicense } = require('../models');

function readWindowsUuid() {
  if (process.platform !== 'win32') return null;
  try {
    const output = execSync('wmic csproduct get uuid', { encoding: 'utf8', windowsHide: true });
    const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    return lines[1] || null;
  } catch {
    return null;
  }
}

function collectMacAddresses() {
  const nets = os.networkInterfaces();
  return Object.values(nets)
    .flat()
    .filter((net) => net && !net.internal && net.mac && net.mac !== '00:00:00:00:00:00')
    .map((net) => net.mac.toLowerCase())
    .sort();
}

function getMachineFingerprint() {
  const parts = [
    os.hostname(),
    os.platform(),
    os.arch(),
    collectMacAddresses().join('|'),
    readWindowsUuid(),
  ].filter(Boolean);

  return crypto.createHash('sha256').update(parts.join('::')).digest('hex');
}

const LICENSE_PERIODS = {
  week: { days: 7, label: '1 semaine' },
  month: { days: 30, label: '1 mois' },
  '3months': { days: 90, label: '3 mois' },
  '6months': { days: 180, label: '6 mois' },
  year: { days: 365, label: '1 an' },
  lifetime: { label: 'À vie', lifetime: true },
  custom: { label: 'Personnalisé', custom: true },
};

const MAX_CUSTOM_DAYS = 3660;

function getSigningSecret() {
  return config.licenseSigningSecret || config.jwtSecret;
}

function periodOptions() {
  return Object.entries(LICENSE_PERIODS).map(([key, value]) => ({
    key,
    label: value.label,
    days: value.lifetime || value.custom ? null : value.days,
    lifetime: Boolean(value.lifetime),
    custom: Boolean(value.custom),
  }));
}

function isCustomPeriod(periodKey) {
  return periodKey === 'custom';
}

function formatCustomPeriodLabel(issuedAt, expiresAt) {
  const days = Math.max(
    1,
    Math.ceil((expiresAt.getTime() - issuedAt.getTime()) / (24 * 60 * 60 * 1000))
  );
  return `Personnalisé (${days} jour${days > 1 ? 's' : ''})`;
}

function resolveCustomLicenseTiming({ customDays, expiresAt, issuedAt = new Date() }) {
  const issued = new Date(issuedAt.getTime());

  if (expiresAt != null && expiresAt !== '') {
    const expiry = new Date(expiresAt);
    if (Number.isNaN(expiry.getTime())) {
      throw Object.assign(new Error('Date d\'expiration invalide.'), { status: 400 });
    }
    if (expiry.getTime() <= issued.getTime()) {
      throw Object.assign(
        new Error('La date d\'expiration doit être postérieure à maintenant.'),
        { status: 400 }
      );
    }
    return {
      expiresAt: expiry,
      label: formatCustomPeriodLabel(issued, expiry),
    };
  }

  const days = Number.parseInt(String(customDays), 10);
  if (!Number.isFinite(days) || days < 1 || days > MAX_CUSTOM_DAYS) {
    throw Object.assign(
      new Error(`Indiquez un nombre de jours entre 1 et ${MAX_CUSTOM_DAYS}.`),
      { status: 400 }
    );
  }

  const expiry = new Date(issued.getTime());
  expiry.setUTCDate(expiry.getUTCDate() + days);
  return {
    expiresAt: expiry,
    label: `Personnalisé (${days} jour${days > 1 ? 's' : ''})`,
  };
}

function getPeriodLabel(periodKey, record = null) {
  if (isCustomPeriod(periodKey) && record?.expires_at && record?.issued_at) {
    return formatCustomPeriodLabel(new Date(record.issued_at), new Date(record.expires_at));
  }
  return LICENSE_PERIODS[periodKey]?.label || periodKey;
}

function isLifetimePeriod(periodKey) {
  return Boolean(LICENSE_PERIODS[periodKey]?.lifetime);
}

function computeExpiresAt(periodKey, issuedAt = new Date()) {
  const period = LICENSE_PERIODS[periodKey];
  if (!period) throw new Error('Période de licence invalide.');
  if (period.lifetime) return null;
  const expires = new Date(issuedAt.getTime());
  expires.setUTCDate(expires.getUTCDate() + period.days);
  return expires;
}

function signLicenseToken({ fingerprint, periodKey, issuedAt, expiresAt }) {
  const payload = {
    fp: fingerprint,
    period: periodKey,
    iat: Math.floor(issuedAt.getTime() / 1000),
  };
  if (!expiresAt) {
    return jwt.sign(payload, getSigningSecret());
  }
  return jwt.sign(payload, getSigningSecret(), {
    expiresIn: Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
  });
}

function verifyLicenseToken(token, fingerprint) {
  const payload = jwt.verify(token, getSigningSecret());
  if (payload.fp !== fingerprint) {
    const err = new Error('Licence liée à une autre machine.');
    err.code = 'LICENSE_FINGERPRINT_MISMATCH';
    throw err;
  }
  return payload;
}

function parseLicenseDate(value) {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Resolve expiry from DB fields, or recompute from period + issued_at if missing (legacy rows). */
function resolveRecordExpiry(record) {
  const lifetime = isLifetimePeriod(record.period_key);
  if (lifetime) {
    return { expiresAt: null, lifetime: true, issuedAt: parseLicenseDate(record.issued_at) };
  }

  let expiresAt = parseLicenseDate(record.expires_at);
  const issuedAt = parseLicenseDate(record.issued_at);

  if (!expiresAt && issuedAt && record.period_key && LICENSE_PERIODS[record.period_key]?.days) {
    expiresAt = computeExpiresAt(record.period_key, issuedAt);
  }

  if (!expiresAt && record.license_token) {
    try {
      const payload = jwt.decode(record.license_token);
      if (payload?.exp) {
        expiresAt = new Date(payload.exp * 1000);
      } else if (payload?.iat && record.period_key && LICENSE_PERIODS[record.period_key]?.days) {
        expiresAt = computeExpiresAt(record.period_key, new Date(payload.iat * 1000));
      }
    } catch {
      /* ignore */
    }
  }

  return { expiresAt, lifetime: false, issuedAt };
}

function toIsoOrNull(date) {
  if (!date) return null;
  return date instanceof Date ? date.toISOString() : String(date);
}

async function repairLicenseRecordExpiry(record, expiresAt) {
  if (!record?._id || !expiresAt || isLifetimePeriod(record.period_key)) return;
  const iso = toIsoOrNull(expiresAt);
  if (!iso) return;

  const existing = parseLicenseDate(record.expires_at);
  if (existing && Math.abs(existing.getTime() - expiresAt.getTime()) < 1000) return;

  const plain = typeof record.toObject === 'function' ? record.toObject() : { ...record };
  await InstallationLicense.create({
    ...plain,
    expires_at: iso,
  });
}

async function getActiveLicenseRecord(fingerprint = getMachineFingerprint()) {
  const rows = await InstallationLicense.find({
    machine_fingerprint: fingerprint,
    is_active: true,
    is_deleted: false,
  });

  const sorted = [...rows].sort((a, b) => {
    const aTime = a.expires_at ? new Date(a.expires_at).getTime() : Number.POSITIVE_INFINITY;
    const bTime = b.expires_at ? new Date(b.expires_at).getTime() : Number.POSITIVE_INFINITY;
    return bTime - aTime;
  });

  return sorted[0] || null;
}

async function getLicenseStatus() {
  const fingerprint = getMachineFingerprint();
  const record = await getActiveLicenseRecord(fingerprint);

  if (!record?.license_token) {
    return {
      valid: false,
      fingerprint,
      code: 'LICENSE_MISSING',
      message: 'Aucune licence active pour cette machine.',
    };
  }

  try {
    verifyLicenseToken(record.license_token, fingerprint);
    const { expiresAt, lifetime, issuedAt } = resolveRecordExpiry(record);

    if (!lifetime && !expiresAt) {
      return {
        valid: false,
        fingerprint,
        period: record.period_key,
        period_label: getPeriodLabel(record.period_key, record),
        issued_at: record.issued_at ?? toIsoOrNull(issuedAt),
        expires_at: null,
        lifetime: false,
        days_remaining: 0,
        license_key: record.license_key,
        code: 'LICENSE_INCOMPLETE',
        message: 'Licence corrompue — révoquez puis réactivez la licence sur cette machine.',
      };
    }

    if (!lifetime && expiresAt) {
      await repairLicenseRecordExpiry(record, expiresAt);
    }

    const now = Date.now();
    const valid = lifetime || expiresAt.getTime() > now;
    const expiresIso = toIsoOrNull(expiresAt);

    return {
      valid,
      fingerprint,
      period: record.period_key,
      period_label: getPeriodLabel(record.period_key, record),
      issued_at: record.issued_at ?? toIsoOrNull(issuedAt),
      expires_at: expiresIso,
      lifetime,
      days_remaining: lifetime
        ? null
        : valid
          ? Math.max(0, Math.ceil((expiresAt.getTime() - now) / (24 * 60 * 60 * 1000)))
          : 0,
      license_key: record.license_key,
      code: valid ? 'LICENSE_VALID' : 'LICENSE_EXPIRED',
      message: valid ? 'Licence active.' : 'Licence expirée.',
    };
  } catch (err) {
    const { expiresAt, lifetime, issuedAt } = resolveRecordExpiry(record);
    const isExpired = err.name === 'TokenExpiredError';
    return {
      valid: false,
      fingerprint,
      period: record.period_key,
      period_label: getPeriodLabel(record.period_key, record),
      issued_at: record.issued_at ?? toIsoOrNull(issuedAt),
      expires_at: toIsoOrNull(expiresAt) ?? record.expires_at ?? null,
      lifetime,
      days_remaining: lifetime ? null : 0,
      license_key: record.license_key,
      code: isExpired ? 'LICENSE_EXPIRED' : (err.code || 'LICENSE_INVALID'),
      message: isExpired ? 'Licence expirée.' : (err.message || 'Licence invalide.'),
    };
  }
}

async function activateLicense({ periodKey, customDays, expiresAt, issuedBy }) {
  if (!LICENSE_PERIODS[periodKey]) {
    const err = new Error('Période de licence invalide.');
    err.status = 400;
    throw err;
  }

  const fingerprint = getMachineFingerprint();
  const issuedAt = new Date();
  let resolvedExpiresAt;
  let periodLabel;

  if (isCustomPeriod(periodKey)) {
    const resolved = resolveCustomLicenseTiming({ customDays, expiresAt, issuedAt });
    resolvedExpiresAt = resolved.expiresAt;
    periodLabel = resolved.label;
  } else {
    resolvedExpiresAt = computeExpiresAt(periodKey, issuedAt);
    periodLabel = LICENSE_PERIODS[periodKey].label;
  }

  const licenseToken = signLicenseToken({
    fingerprint,
    periodKey,
    issuedAt,
    expiresAt: resolvedExpiresAt,
  });

  await InstallationLicense.updateMany(
    {
      machine_fingerprint: fingerprint,
      is_deleted: false,
    },
    {
      is_active: false,
      modified_by: issuedBy,
    }
  );

  const licenseKeySuffix = isCustomPeriod(periodKey)
    ? `C${Math.ceil((resolvedExpiresAt.getTime() - issuedAt.getTime()) / (24 * 60 * 60 * 1000))}D`
    : periodKey.toUpperCase();
  const licenseKey = `KONO-${licenseKeySuffix}-${fingerprint.slice(0, 8).toUpperCase()}`;

  const record = await InstallationLicense.create({
    machine_fingerprint: fingerprint,
    period_key: periodKey,
    license_key: licenseKey,
    license_token: licenseToken,
    issued_at: issuedAt.toISOString(),
    expires_at: resolvedExpiresAt ? resolvedExpiresAt.toISOString() : null,
    is_active: true,
    created_by: issuedBy,
    modified_by: issuedBy,
  });

  const status = await getLicenseStatus();
  if (!isLifetimePeriod(periodKey) && status.code === 'LICENSE_INCOMPLETE') {
    const err = new Error('La licence n\'a pas pu être enregistrée correctement. Réessayez.');
    err.status = 500;
    throw err;
  }

  return {
    ...status,
    period_label: periodLabel || status.period_label,
    record_id: record._id,
  };
}

async function revokeAllLicenses() {
  const fingerprint = getMachineFingerprint();
  const rows = await InstallationLicense.find({
    machine_fingerprint: fingerprint,
  });

  const db = getDb();
  for (const row of rows) {
    deleteModelData(db, 'InstallationLicense', row._id);
  }

  return {
    ...(await getLicenseStatus()),
    revoked_count: rows.length,
  };
}

module.exports = {
  LICENSE_PERIODS,
  MAX_CUSTOM_DAYS,
  periodOptions,
  getMachineFingerprint,
  getLicenseStatus,
  activateLicense,
  revokeAllLicenses,
  verifyLicenseToken,
  resolveCustomLicenseTiming,
};
