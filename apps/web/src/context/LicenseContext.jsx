import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import client from '../api/client';

const BACKGROUND_CHECK_MS = 5 * 60_000;

const LicenseContext = createContext(null);

export function LicenseProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  const [status, setStatus] = useState(null);

  const refresh = useCallback(async ({ background = false } = {}) => {
    if (!background) {
      setLoading(true);
    }
    try {
      const res = await client.get('/license/status');
      const data = res.data.data;
      setStatus(data);
      setValid(Boolean(data?.valid));
      return data;
    } catch {
      if (!background) {
        setStatus(null);
        setValid(false);
      }
      return null;
    } finally {
      if (!background) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(() => refresh({ background: true }), BACKGROUND_CHECK_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const value = useMemo(
    () => ({ valid, loading, status, refresh }),
    [valid, loading, status, refresh]
  );

  return (
    <LicenseContext.Provider value={value}>
      {children}
    </LicenseContext.Provider>
  );
}

export function useLicense() {
  const ctx = useContext(LicenseContext);
  if (!ctx) throw new Error('useLicense doit être utilisé dans LicenseProvider');
  return ctx;
}
