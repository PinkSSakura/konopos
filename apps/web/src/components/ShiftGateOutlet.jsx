import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useShift } from '../context/ShiftContext';
import { isShiftGateAllowedPath, shouldEnforceShiftGate } from '../utils/shiftGate';
import { PageLoading } from './loading/LoadingStates';

export default function ShiftGateOutlet() {
  const { user } = useAuth();
  const { isShiftGated, loading: shiftLoading } = useShift();
  const location = useLocation();

  if (shouldEnforceShiftGate(user) && shiftLoading) {
    return <PageLoading className="min-h-[40vh]" />;
  }

  if (isShiftGated && !isShiftGateAllowedPath(location.pathname, user)) {
    return <Navigate to="/shift" replace />;
  }

  return <Outlet />;
}
