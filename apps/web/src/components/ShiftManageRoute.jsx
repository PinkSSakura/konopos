import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { canManageShifts } from '../utils/shiftAccess';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function ShiftManageRoute({ children }) {
  const { user } = useAuth();

  if (!canManageShifts(user)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Accès refusé</CardTitle>
          <CardDescription>
            Vous n&apos;avez pas la permission de gérer les shifts en service.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return children;
}
