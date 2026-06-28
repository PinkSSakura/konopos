import { useEffect, useMemo, useState } from 'react';
import { formatLicenseCountdown } from '../utils/licenseDisplay';

export default function useLicenseCountdown(status) {
  const [now, setNow] = useState(() => Date.now());

  const lifetime = Boolean(status?.lifetime);
  const expiresMs = status?.expires_at ? new Date(status.expires_at).getTime() : null;
  const enabled = Boolean(status?.valid && !lifetime && expiresMs);

  useEffect(() => {
    if (!enabled) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [enabled, expiresMs]);

  return useMemo(() => {
    if (!status?.valid) {
      return { remainingMs: 0, countdown: null, expired: true };
    }
    if (lifetime) {
      return { remainingMs: null, countdown: null, expired: false };
    }
    if (!expiresMs) {
      return { remainingMs: 0, countdown: null, expired: true };
    }
    const remainingMs = Math.max(0, expiresMs - now);
    return {
      remainingMs,
      countdown: formatLicenseCountdown(remainingMs),
      expired: remainingMs <= 0,
    };
  }, [status, lifetime, expiresMs, now, enabled]);
}
