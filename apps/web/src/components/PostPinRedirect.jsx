import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useShift } from '../context/ShiftContext';
import { getWaiterHomeRoute, shouldEnforceShiftGate } from '../utils/shiftGate';
import { PageLoading } from './loading/LoadingStates';

/** After PIN or non-systempos auth on /pin — respect waiter shift gate. */
export default function PostPinRedirect() {
  const { user } = useAuth();
  const { activeShift, loading } = useShift();
  const roleKey = user?.role?.role_key;

  if (shouldEnforceShiftGate(user) && loading) {
    return <PageLoading className="min-h-[40vh]" />;
  }

  if (roleKey === 'waiter') {
    return <Navigate to={getWaiterHomeRoute(activeShift)} replace />;
  }

  return <Navigate to="/pos" replace />;
}
