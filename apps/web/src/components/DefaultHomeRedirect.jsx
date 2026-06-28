import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEstablishment } from '../context/EstablishmentContext';
import { useLicense } from '../context/LicenseContext';
import { useShift } from '../context/ShiftContext';
import { getHomeRoute } from '../utils/homeRoute';
import { InlineLoading } from './loading/LoadingStates';

export default function DefaultHomeRedirect() {
  const { user, loading: authLoading, isPinSession: isPin } = useAuth();
  const { valid: licenseValid, loading: licenseLoading } = useLicense();
  const { hasEstablishment, loading: establishmentLoading } = useEstablishment();
  const { isShiftGated } = useShift();
  const roleKey = user?.role?.role_key;

  if (roleKey === 'systempos' && !isPin) {
    return <Navigate to="/pin" replace />;
  }

  if (licenseLoading || establishmentLoading || authLoading) {
    return <InlineLoading label="Chargement…" />;
  }

  if (roleKey === 'superadmin') {
    if (!licenseValid) {
      return <Navigate to="/admin/license" replace />;
    }
    if (!hasEstablishment) {
      return <Navigate to="/admin/establishment" replace />;
    }
  }

  if (isShiftGated) {
    return <Navigate to="/shift" replace />;
  }

  return <Navigate to={getHomeRoute(roleKey)} replace />;
}
