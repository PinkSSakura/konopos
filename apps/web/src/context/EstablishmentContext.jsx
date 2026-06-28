import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import client from '../api/client';
import { useAuth } from './AuthContext';
import { useLicense } from './LicenseContext';
import {
  ESTABLISHMENT_CAP,
  getEstablishmentFeaturesFromCapabilities,
  hasEstablishmentCapability,
} from '../utils/establishmentCapabilities';

const EstablishmentContext = createContext(null);

export function EstablishmentProvider({ children }) {
  const { isAuthenticated, user, loading: authLoading, capabilities } = useAuth();
  const { valid: licenseValid, loading: licenseLoading } = useLicense();
  const [establishment, setEstablishment] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (authLoading) {
      return null;
    }
    if (!isAuthenticated || !licenseValid) {
      setEstablishment(null);
      setLoading(false);
      return null;
    }
    setLoading(true);
    try {
      const res = await client.get('/establishment/current');
      setEstablishment(res.data.data);
      return res.data.data;
    } catch {
      setEstablishment(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, licenseValid, authLoading]);

  useEffect(() => {
    if (!licenseLoading && !authLoading) {
      refresh();
    }
  }, [refresh, licenseLoading, authLoading, user?._id]);

  const kitchenStaffDispatch = useMemo(
    () => hasEstablishmentCapability(capabilities, ESTABLISHMENT_CAP.KITCHEN_DISPATCH),
    [capabilities],
  );

  const features = useMemo(
    () => getEstablishmentFeaturesFromCapabilities(capabilities),
    [capabilities],
  );

  const tablesEnabled = useMemo(() => {
    if (establishment && typeof establishment.tables_enabled === 'boolean') {
      return establishment.tables_enabled;
    }
    return features.tables;
  }, [establishment, features.tables]);

  const hasEstablishmentRecord = Boolean(establishment);
  const hasEstablishment = hasEstablishmentCapability(
    capabilities,
    ESTABLISHMENT_CAP.SETUP_COMPLETE,
  );
  const effectiveLoading = loading || authLoading || licenseLoading;

  const value = useMemo(
    () => ({
      establishment,
      loading: effectiveLoading,
      refresh,
      hasEstablishmentRecord,
      hasEstablishment,
      kitchenStaffDispatch,
      tablesEnabled,
      features,
      hasCapability: (code) => hasEstablishmentCapability(capabilities, code),
    }),
    [
      establishment,
      effectiveLoading,
      refresh,
      hasEstablishmentRecord,
      hasEstablishment,
      kitchenStaffDispatch,
      tablesEnabled,
      features,
      capabilities,
    ],
  );

  return (
    <EstablishmentContext.Provider value={value}>
      {children}
    </EstablishmentContext.Provider>
  );
}

export function useEstablishment() {
  const ctx = useContext(EstablishmentContext);
  if (!ctx) throw new Error('useEstablishment doit être utilisé dans EstablishmentProvider');
  return ctx;
}
