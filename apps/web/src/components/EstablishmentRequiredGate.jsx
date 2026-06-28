import React from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Store } from 'lucide-react';
import { PageLoading } from './loading/LoadingStates';
import { useEstablishment } from '../context/EstablishmentContext';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const EXEMPT_PATH_PREFIXES = [
  '/admin',
  '/admin/establishment',
  '/admin/license',
  '/admin/license-info',
];

export default function EstablishmentRequiredGate({ children }) {
  const { loading, hasEstablishment } = useEstablishment();
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const roleKey = user?.role?.role_key;

  const isExempt = EXEMPT_PATH_PREFIXES.some((path) => {
    if (path === '/admin') return location.pathname === '/admin';
    return location.pathname.startsWith(path);
  });

  if (loading || authLoading) {
    return <PageLoading className="min-h-0" />;
  }

  if (hasEstablishment) {
    return children;
  }

  if (isExempt) {
    return children;
  }

  if (roleKey === 'superadmin') {
    return <Navigate to="/admin/establishment" replace />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Store className="size-5" />
          Établissement requis
        </CardTitle>
        <CardDescription>
          L&apos;établissement n&apos;est pas encore configuré. Contactez le Super Admin.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

export function EstablishmentSetupBanner() {
  const { hasEstablishment, hasEstablishmentRecord, loading } = useEstablishment();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const onSetupPage = location.pathname.startsWith('/admin/establishment');

  if (loading || hasEstablishment || user?.role?.role_key !== 'superadmin' || onSetupPage) {
    return null;
  }

  return (
    <Alert className="mb-4">
      <AlertTitle>{hasEstablishmentRecord ? 'Configuration incomplète' : 'Configuration initiale'}</AlertTitle>
      <AlertDescription className="flex items-center justify-between gap-3">
        <span>
          {hasEstablishmentRecord
            ? 'Finalisez la configuration de l\'établissement pour activer le POS, la caisse et la gestion des utilisateurs.'
            : 'Créez votre établissement pour activer le POS, la caisse et la gestion des utilisateurs.'}
        </span>
        <Button type="button" size="sm" onClick={() => navigate('/admin/establishment')}>
          {hasEstablishmentRecord ? 'Finaliser' : 'Créer l\'établissement'}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
