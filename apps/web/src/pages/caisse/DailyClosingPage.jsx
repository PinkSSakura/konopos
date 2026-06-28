import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { message } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { formatDateTime } from '../../utils/dateFilters';
import { canDailyClose } from '../../utils/paymentAccess';
import { CardLoading } from '../../components/loading/LoadingStates';

function StatItem({ title, value, suffix }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="text-2xl font-semibold tabular-nums">
        {typeof value === 'number' ? value.toFixed(2) : value}
        {suffix ? ` ${suffix}` : ''}
      </p>
    </div>
  );
}

function StatCount({ title, value }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export default function DailyClosingPage() {
  const { user, loading: authLoading } = useAuth();
  const [dateStr, setDateStr] = useState('');
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);

  const load = (d) => {
    setLoading(true);
    const dateParam = d || undefined;
    client
      .get('/payments/daily-summary', { params: { date: dateParam } })
      .then((res) => setSummary(res.data.data))
      .catch(() => message.error('Erreur'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(null);
  }, []);

  const handleClose = async () => {
    setClosing(true);
    try {
      const dateParam = dateStr || undefined;
      await client.post('/payments/daily-close', { date: dateParam });
      message.success('Journée clôturée');
      load(dateStr);
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur');
    } finally {
      setClosing(false);
    }
  };

  if (authLoading) {
    return <CardLoading />;
  }

  if (!canDailyClose(user)) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Accès refusé.</p>
        </CardContent>
      </Card>
    );
  }

  const t = summary?.totals || {};

  return (
    <Card>
      <CardHeader className="border-b border-border/60">
        <CardTitle className="text-xl font-semibold">Clôture journalière</CardTitle>
        <CardAction>
          <Input
            type="date"
            value={dateStr}
            onChange={(e) => {
              setDateStr(e.target.value);
              load(e.target.value);
            }}
          />
        </CardAction>
      </CardHeader>
      <CardContent className="pt-4">
        {loading ? (
          <CardLoading />
        ) : (
          <>
            {summary?.is_closed && (
              <Badge className="mb-4 border-green-200 bg-green-50 text-green-800 hover:bg-green-50">
                Journée clôturée le {formatDateTime(summary.closing.closed_at)}
              </Badge>
            )}

            <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
              <StatItem title="Espèces" value={t.cash || 0} suffix="MAD" />
              <StatItem title="Carte" value={t.card || 0} suffix="MAD" />
              <StatItem title="Crédit client" value={t.credit || 0} suffix="MAD" />
              <StatItem title="Débit compte" value={t.debit || 0} suffix="MAD" />
              <StatItem title="Total brut" value={t.gross_total || 0} suffix="MAD" />
              <StatItem title="Remises" value={t.discount_total || 0} suffix="MAD" />
              <StatItem title="Frais service" value={t.service_charge_total || 0} suffix="MAD" />
              <StatCount title="Paiements" value={t.payment_count || 0} />
            </div>

            <dl className="mb-6 divide-y rounded-lg border text-sm">
              <div className="grid grid-cols-2 gap-2 px-4 py-2">
                <dt className="text-muted-foreground">Monnaie rendue totale</dt>
                <dd className="text-right font-medium">{(t.change_total || 0).toFixed(2)} MAD</dd>
              </div>
              <div className="grid grid-cols-2 gap-2 px-4 py-2">
                <dt className="text-muted-foreground">Annulations</dt>
                <dd className="text-right font-medium">{t.void_count || 0}</dd>
              </div>
              <div className="grid grid-cols-2 gap-2 px-4 py-2">
                <dt className="text-muted-foreground">Shifts concernés</dt>
                <dd className="text-right font-medium">{summary?.shift_ids?.length || 0}</dd>
              </div>
            </dl>

            {!summary?.is_closed && (
              <Button size="lg" disabled={closing} onClick={handleClose}>
                {closing ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Clôture…
                  </>
                ) : (
                  'Clôturer la journée'
                )}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
