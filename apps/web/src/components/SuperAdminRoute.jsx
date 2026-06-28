import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function SuperAdminRoute({ children }) {
  const { user } = useAuth();
  if (user?.role?.role_key !== 'superadmin') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Accès refusé</CardTitle>
          <CardDescription>Cette section est réservée au Super Admin.</CardDescription>
        </CardHeader>
        <CardContent>Erreur 403</CardContent>
      </Card>
    );
  }
  return children;
}
