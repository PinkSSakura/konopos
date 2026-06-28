import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { canViewOwnShift } from '../utils/shiftAccess';
import { PageLoading } from './loading/LoadingStates';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function ShiftRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoading className="min-h-0" />;
  if (!canViewOwnShift(user)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Accès refusé</CardTitle>
          <CardDescription>
            Vous n&apos;avez pas la permission de consulter votre shift.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
  return children;
}
