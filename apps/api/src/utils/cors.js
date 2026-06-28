const config = require('../config');

function normalizeOrigin(origin) {
  if (!origin) return origin;
  try {
    const url = new URL(origin);
    return `${url.protocol}//${url.host}`;
  } catch {
    return origin.replace(/\/+$/, '');
  }
}

const explicitOrigins = new Set(
  config.corsOrigin.split(',').map((o) => normalizeOrigin(o.trim())).filter(Boolean)
);

function isPrivateLanHost(hostname) {
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true;

  const parts = hostname.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return false;
  }

  if (parts[0] === 10) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;

  return false;
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (explicitOrigins.has(normalizeOrigin(origin))) return true;

  if (!config.allowLanCors) return false;

  try {
    const { hostname, protocol } = new URL(origin);
    return (protocol === 'http:' || protocol === 'https:') && isPrivateLanHost(hostname);
  } catch {
    return false;
  }
}

function createCorsOptions() {
  return {
    origin(origin, callback) {
      callback(null, isAllowedOrigin(origin));
    },
    credentials: true,
  };
}

module.exports = { createCorsOptions, isAllowedOrigin, isPrivateLanHost, normalizeOrigin };
