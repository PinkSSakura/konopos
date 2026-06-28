import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import CheckoutForm from '../../components/receipt/CheckoutForm';
import { useAuth } from '../../context/AuthContext';
import { canProcessPayment } from '../../utils/paymentAccess';
import { cn } from '@/lib/utils';

export default function CheckoutPage() {
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const fullscreen = searchParams.get('fullscreen') === '1';
  const returnTo = location.state?.returnTo || '/caisse/encaisser';

  const handleClose = () => {
    navigate(returnTo, { replace: true });
  };

  const handleSuccess = () => {
    navigate(returnTo, { replace: true });
  };

  if (authLoading) {
    return <p className="text-muted-foreground p-4">Chargement…</p>;
  }

  if (!canProcessPayment(user)) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Accès caisse non autorisé.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('checkout-page', fullscreen && 'checkout-page--fullscreen')}>
      <Card className={cn(fullscreen && 'border-0 shadow-none')}>
        <CardHeader className="flex flex-row items-center gap-3 border-b border-border/60 pb-4">
          <Button type="button" variant="outline" size="lg" onClick={handleClose}>
            <ArrowLeft className="size-4" />
            Retour
          </Button>
          <CardTitle className="text-xl">Encaisser</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <CheckoutForm
            orderId={orderId}
            active
            layout="page"
            onClose={handleClose}
            onSuccess={handleSuccess}
          />
        </CardContent>
      </Card>
    </div>
  );
}
