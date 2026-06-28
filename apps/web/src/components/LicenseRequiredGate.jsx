import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLicense } from '../context/LicenseContext';
import { Card, CardContent } from '@/components/ui/card';
import { InlineLoading } from './loading/LoadingStates';

export default function LicenseRequiredGate({ children }) {
  const { user } = useAuth();
  const { valid, loading } = useLicense();
  const location = useLocation();

  const roleKey = user?.role?.role_key;
  const isSuperAdmin = roleKey === 'superadmin';
  const onLicensePage = location.pathname.startsWith('/admin/license');

  if (loading) {
    return <InlineLoading label="Vérification de la licence…" />;
  }

  if (valid) {
    return children;
  }

  if (isSuperAdmin && !onLicensePage) {
    return <Navigate to="/admin/license" replace />;
  }

  if (isSuperAdmin && onLicensePage) {
    return children;
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardContent className="space-y-3 pt-6 text-center">
          <h2 className="text-lg font-semibold">Licence requise</h2>
          <p className="text-sm text-muted-foreground">
            Cette installation n&apos;a pas de licence active ou la licence a expiré.
            Contactez votre administrateur ou le support KonoPOS.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
