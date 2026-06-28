import React from 'react';
import { useAuth } from '../context/AuthContext';
import { canViewLicenseInfo } from '../utils/licenseAccess';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function LicenseInfoRoute({ children }) {
  const { user } = useAuth();
  if (!canViewLicenseInfo(user)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Accès refusé</CardTitle>
          <CardDescription>Cette section est réservée à la direction.</CardDescription>
        </CardHeader>
        <CardContent>Erreur 403</CardContent>
      </Card>
    );
  }

  return children;
}
