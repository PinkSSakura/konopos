import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getKitchenDashboardPath, isKitchenStaffRole } from '../utils/kdsaccess';
import PosPage from '../pages/orders/PosPage';

/** POS réservé aux rôles hors cuisine / bar */
export default function PosRoute() {
  const { user } = useAuth();
  const roleKey = user?.role?.role_key;

  if (isKitchenStaffRole(roleKey)) {
    return <Navigate to={getKitchenDashboardPath(roleKey)} replace />;
  }

  return <PosPage />;
}
