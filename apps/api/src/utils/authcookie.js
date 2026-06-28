const config = require('../config');

const COOKIE_NAME = 'TouDev_session';

function cookieBaseOptions() {
  const isProd = config.env === 'production';
  // Local Electron/desktop serves UI over http://127.0.0.1 — Secure cookies are rejected.
  const localPos = process.env.TouDev_LOCAL_POS === 'true'
    || process.env.TouDev_LOCAL_POS === '1';
  return {
    httpOnly: true,
    secure: isProd && !localPos,
    sameSite: 'lax',
    path: '/',
  };
}

function getSessionMaxAgeMs(roleKey) {
  if (roleKey === 'superadmin') {
    const raw = process.env.JWT_SUPERADMIN_EXPIRES_IN || '7d';
    if (raw.endsWith('d')) return Number(raw.slice(0, -1)) * 24 * 60 * 60 * 1000;
    if (raw.endsWith('h')) return Number(raw.slice(0, -1)) * 60 * 60 * 1000;
    return config.sessionTimeoutMinutes * 60 * 1000;
  }
  if (roleKey === 'systempos') {
    return config.systemposSessionTimeoutMinutes * 60 * 1000;
  }
  return config.sessionTimeoutMinutes * 60 * 1000;
}

function setAuthCookie(res, token, roleKey) {
  res.cookie(COOKIE_NAME, token, {
    ...cookieBaseOptions(),
    maxAge: getSessionMaxAgeMs(roleKey),
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, cookieBaseOptions());
}

function parseCookies(req) {
  const header = req.headers.cookie;
  if (!header) return {};
  return Object.fromEntries(
    header.split(';').map((part) => {
      const [key, ...rest] = part.trim().split('=');
      return [key, decodeURIComponent(rest.join('='))];
    }),
  );
}

function getTokenFromRequest(req) {
  const fromCookie = parseCookies(req)[COOKIE_NAME];
  if (fromCookie) return fromCookie;

  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);

  return null;
}

module.exports = {
  COOKIE_NAME,
  setAuthCookie,
  clearAuthCookie,
  getTokenFromRequest,
  parseCookies,
};
