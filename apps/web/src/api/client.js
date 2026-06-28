import axios from 'axios';
import { applyMinimumLoadingDelay } from '../utils/minimumLoading';
import { clearLegacyAuthStorage } from '../utils/authStorage';
import { getTerminalRequestHeaders, isSystemTerminalContext } from '../utils/terminalContext';

const baseURL = import.meta.env.VITE_API_URL || '/api';

/** Session probes — 401 here must not hard-redirect (avoids race after login). */
const AUTH_PROBE_PATHS = ['/auth/me', '/auth/access'];

function isAuthProbeRequest(url) {
  const path = String(url || '');
  return AUTH_PROBE_PATHS.some((probe) => path.includes(probe));
}

function isLoginRequest(url) {
  const path = String(url || '');
  return path.includes('/auth/login');
}

function isLoginChallengeRequest(url) {
  return String(url || '').includes('/auth/login-challenge/');
}

function isLogoutPinRequest(url) {
  return String(url || '').includes('/auth/logout/pin');
}

function isRestoreShellRequest(url) {
  return String(url || '').includes('/auth/restore-systempos-shell');
}

async function tryRestoreSystemposShell() {
  if (!isSystemTerminalContext()) return;
  try {
    await fetch(`${baseURL}/auth/restore-systempos-shell`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...getTerminalRequestHeaders(),
      },
    });
  } catch {
    /* best effort before redirect to PIN */
  }
}

const client = axios.create({
  baseURL,
  timeout: 30000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use((config) => {
  config.metadata = { startedAt: Date.now() };
  config.headers = {
    ...config.headers,
    ...getTerminalRequestHeaders(),
  };
  return config;
});

client.interceptors.response.use(
  async (res) => {
    await applyMinimumLoadingDelay(
      res.config?.metadata?.startedAt,
      undefined,
      res.config?.method,
    );
    return res;
  },
  async (err) => {
    await applyMinimumLoadingDelay(
      err.config?.metadata?.startedAt,
      undefined,
      err.config?.method,
    );
    if (
      err.response?.status === 401
      && !isLoginRequest(err.config?.url)
      && !isLoginChallengeRequest(err.config?.url)
      && !isLogoutPinRequest(err.config?.url)
      && !isRestoreShellRequest(err.config?.url)
      && !isAuthProbeRequest(err.config?.url)
    ) {
      clearLegacyAuthStorage();
      const path = window.location.pathname;
      if (isSystemTerminalContext() && !path.startsWith('/pin')) {
        await tryRestoreSystemposShell();
        window.location.href = '/pin';
      } else if (
        !path.startsWith('/setup')
        && !path.startsWith('/login')
        && !path.startsWith('/pin')
        && !path.startsWith('/cds')
      ) {
        window.location.href = '/login';
      }
    }
    if (
      err.response?.status === 423
      && err.response?.data?.code === 'SHIFT_REQUIRED'
      && !window.location.pathname.startsWith('/shift')
    ) {
      window.location.href = '/shift';
    }
    if (
      err.response?.status === 403
      && err.response?.data?.code === 'SYSTEMPOS_SHELL'
      && !window.location.pathname.startsWith('/pin')
    ) {
      window.location.href = '/pin';
    }
    return Promise.reject(err);
  },
);

export default client;
