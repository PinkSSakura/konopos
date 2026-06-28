import React, {
  createContext, useContext, useEffect, useMemo, useState,
} from 'react';
import { useAuth } from './AuthContext';

const STORAGE_KEY = 'TouDev_touch_mode';

const TouchModeContext = createContext(null);

export function TouchModeProvider({ children }) {
  const { user, isPinSession } = useAuth();
  const [touchMode, setTouchMode] = useState(() => {
    try {
      if (user?.role?.role_key === 'systempos') return true;
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const roleKey = user?.role?.role_key;
    if (roleKey === 'systempos' || isPinSession) {
      setTouchMode(true);
    }
  }, [user?.role?.role_key, isPinSession]);

  useEffect(() => {
    document.documentElement.classList.toggle('touch-mode', touchMode);
    localStorage.setItem(STORAGE_KEY, touchMode ? '1' : '0');
  }, [touchMode]);

  const toggleTouchMode = () => setTouchMode((v) => !v);

  const value = useMemo(
    () => ({ touchMode, setTouchMode, toggleTouchMode }),
    [touchMode]
  );

  return (
    <TouchModeContext.Provider value={value}>
      {children}
    </TouchModeContext.Provider>
  );
}

export function useTouchMode() {
  const ctx = useContext(TouchModeContext);
  if (!ctx) throw new Error('useTouchMode doit être utilisé dans TouchModeProvider');
  return ctx;
}

/** Optional hook — returns defaults when provider missing (e.g. login before wrap) */
export function useTouchModeOptional() {
  const ctx = useContext(TouchModeContext);
  return ctx || { touchMode: false, setTouchMode: () => {}, toggleTouchMode: () => {} };
}
