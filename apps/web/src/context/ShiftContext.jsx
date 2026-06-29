import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import client from '../api/client';
import { useAuth } from './AuthContext';

const SHIFT_ROLES = ['waiter', 'cook', 'barman'];

const ShiftContext = createContext(null);

export function ShiftProvider({ children }) {
  const { isAuthenticated, user } = useAuth();
  const roleKey = user?.role?.role_key;
  const usesShifts = SHIFT_ROLES.includes(roleKey);

  const [shiftMeta, setShiftMeta] = useState(null);
  const [loading, setLoading] = useState(false);

  const refreshShift = useCallback(async () => {
    if (!isAuthenticated || !usesShifts) {
      setShiftMeta(null);
      return null;
    }
    setLoading(true);
    try {
      const res = await client.get('/shifts/current');
      const data = res.data.data || null;
      setShiftMeta(data);
      return data;
    } catch {
      setShiftMeta(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, usesShifts]);

  useEffect(() => {
    refreshShift();
  }, [refreshShift]);

  const activeShift = shiftMeta?.active_shift || null;
  const isWaiter = roleKey === 'waiter';
  const isShiftGated = Boolean(
    isWaiter
      ? !loading && !activeShift
      : usesShifts
        && shiftMeta?.required
        && shiftMeta?.manual_start_required
        && !activeShift
  );

  const value = useMemo(
    () => ({
      shiftMeta,
      activeShift,
      isShiftGated,
      loading,
      refreshShift,
    }),
    [shiftMeta, activeShift, isShiftGated, loading, refreshShift]
  );

  return <ShiftContext.Provider value={value}>{children}</ShiftContext.Provider>;
}

export function useShift() {
  const ctx = useContext(ShiftContext);
  if (!ctx) throw new Error('useShift doit être utilisé dans ShiftProvider');
  return ctx;
}
