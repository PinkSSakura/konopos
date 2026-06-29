import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useShift } from '../context/ShiftContext';
import { getKitchenDashboardPath, isKitchenStaffRole } from '../utils/kdsaccess';
import { shouldEnforceShiftGate } from '../utils/shiftGate';
import { PageLoading } from './loading/LoadingStates';
import PosPage from '../pages/orders/PosPage';

/** POS réservé aux rôles hors cuisine / bar */
export default function PosRoute() {
  const { user } = useAuth();
  const { isShiftGated, loading: shiftLoading } = useShift();
  const roleKey = user?.role?.role_key;

  if (isKitchenStaffRole(roleKey)) {
    return <Navigate to={getKitchenDashboardPath(roleKey)} replace />;
  }

  if (shouldEnforceShiftGate(user) && shiftLoading) {
    return <PageLoading className="min-h-[40vh]" />;
  }

  if (shouldEnforceShiftGate(user) && isShiftGated) {
    return <Navigate to="/shift" replace />;
  }

  return <PosPage />;
}
