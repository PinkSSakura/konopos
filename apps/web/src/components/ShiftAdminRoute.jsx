import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  canAccessShiftAdmin,
  canViewAllShifts,
  canViewOwnShift,
  canViewShiftPlans,
} from '../utils/shiftAccess';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function ShiftAdminRoute({ children }) {
  const { user } = useAuth();

  if (!canAccessShiftAdmin(user)) {
    if (canViewOwnShift(user)) {
      return <Navigate to="/shift" replace />;
    }
    return (
      <Card>
        <CardHeader>
          <CardTitle>Accès refusé</CardTitle>
          <CardDescription>
            Vous n&apos;avez pas la permission de consulter les shifts de l&apos;équipe.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!canViewAllShifts(user) && !canViewShiftPlans(user)) {
    return <Navigate to="/shift" replace />;
  }

  return children;
}
