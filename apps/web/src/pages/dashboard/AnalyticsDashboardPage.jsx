import React, { useCallback, useEffect, useState } from 'react';

import { Link } from 'react-router-dom';

import {

  DollarSign,

  ShoppingCart,

  CreditCard,

  TrendingUp,

  TrendingDown,

  ReceiptText,

} from 'lucide-react';

import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, XAxis, YAxis } from 'recharts';

import client from '../../api/client';
import { DashboardLoading } from '../../components/loading/LoadingStates';

import { todayDateString, formatDateTime } from '../../utils/dateFilters';
import { downloadPdf } from '../../utils/pdfExport';
import { toast } from 'sonner';

import DatePicker from '../../components/DatePicker';

import CollapsibleToolbar from '../../components/layout/CollapsibleToolbar';

import '../../styles/analytics-dashboard.css';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

import { Button } from '@/components/ui/button';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

import { Badge } from '@/components/ui/badge';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

import {

  ChartContainer,

  ChartTooltip,

  ChartTooltipContent,

  ChartLegend,

  ChartLegendContent,

} from '@/components/ui/chart';



const PERIOD_OPTIONS = [

  { value: 'day', label: 'Jour' },

  { value: 'week', label: 'Semaine' },

  { value: 'month', label: 'Mois' },

  { value: 'year', label: 'Année' },

];



const METHOD_LABELS = {

  cash: 'Espèces',

  card: 'Carte',

  credit: 'Crédit client',

  debit: 'Débit compte',

};



const TYPE_LABELS = {

  dine_in: 'Sur place',

  takeaway: 'À emporter',

  delivery: 'Livraison',

};



const STATUS_LABELS = {

  open: 'Ouverte',

  sent: 'Envoyée',

  preparing: 'Préparation',

  ready: 'Prête',

  served: 'Servie',

  delivered: 'Livrée',

  paid: 'Payée',

  cancelled: 'Annulée',

};



const revenueChartConfig = {

  revenue: { label: 'CA', color: 'var(--chart-1)' },

};



const ordersChartConfig = {

  orders: { label: 'Commandes', color: 'var(--chart-2)' },

};



const typeChartConfig = {

  value: { label: 'Commandes', color: 'var(--chart-1)' },

};



const methodChartConfig = {

  cash: { label: 'Espèces', color: 'var(--chart-1)' },

  card: { label: 'Carte', color: 'var(--chart-2)' },

  credit: { label: 'Crédit client', color: 'var(--chart-3)' },

  debit: { label: 'Débit compte', color: 'var(--chart-4)' },

};



const PIE_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];



function formatMad(v) {

  return `${Number(v || 0).toFixed(2)} MAD`;

}



function formatRange(from, to, period) {
  const f = new Date(from);
  const t = new Date(to);
  if (Number.isNaN(f.getTime())) return '—';
  if (period === 'day') {
    return f.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }
  if (period === 'year') return String(f.getFullYear());
  const medium = { dateStyle: 'medium' };
  const end = Number.isNaN(t.getTime()) ? '—' : t.toLocaleDateString('fr-FR', medium);
  return `${f.toLocaleDateString('fr-FR', medium)} — ${end}`;
}



function ChartEmpty() {

  return <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">Aucune donnée sur cette période</div>;

}



export default function AnalyticsDashboardPage() {

  const [period, setPeriod] = useState('day');

  const [date, setDate] = useState(todayDateString());

  const [data, setData] = useState(null);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState(null);

  const [exportingPdf, setExportingPdf] = useState(false);

  const load = useCallback(() => {

    setLoading(true);

    setError(null);

    client

      .get('/analytics/dashboard', { params: { period, date: date || undefined } })

      .then((res) => setData(res.data.data))

      .catch((err) => {

        const msg = err.response?.data?.message || 'Erreur chargement tableau de bord';

        setError(msg);

      })

      .finally(() => setLoading(false));

  }, [period, date]);



  useEffect(() => {

    load();

  }, [load]);



  const exportBusinessPdf = async () => {
    setExportingPdf(true);
    try {
      await downloadPdf(
        '/analytics/export/business.pdf',
        { period, date: date || undefined },
        `rapport-${period}-${date || 'today'}.pdf`
      );
      toast.success('Rapport PDF téléchargé');
    } catch (err) {
      toast.error(err.message || 'Erreur export PDF');
    } finally {
      setExportingPdf(false);
    }
  };



  const s = data?.summary || {};



  const methodSegments = Object.entries(s.by_method || {})

    .map(([key, value]) => ({

      key,

      label: METHOD_LABELS[key] || key,

      value: Number(value) || 0,

    }))

    .filter((x) => x.value > 0);



  const typeSegments = Object.entries(s.by_order_type || {})

    .map(([key, value]) => ({

      label: TYPE_LABELS[key] || key,

      value: Number(value) || 0,

    }));



  const statusRows = Object.entries(s.orders_by_status || {}).map(([status, count]) => ({

    key: status,

    status: STATUS_LABELS[status] || status,

    count,

  }));



  const revenueSeries = (data?.series || []).map((b) => ({

    label: b.label,

    revenue: Number(b.revenue) || 0,

  }));



  const ordersSeries = (data?.series || []).map((b) => ({

    label: b.label,

    orders: Number(b.orders) || 0,

  }));

  const periodLabel = PERIOD_OPTIONS.find((option) => option.value === period)?.label || period;
  const toolbarSummary = data
    ? `${periodLabel} · ${formatRange(data.from, data.to, data.period)}`
    : `${periodLabel} · ${date}`;

  return (

    <div className="analytics-dashboard">

      <div className="analytics-dashboard-header page-header mb-3">
        <div>
          <h2 className="text-xl font-semibold sm:text-2xl">Tableau de bord</h2>

          {data && (

            <p className="text-sm text-muted-foreground">{formatRange(data.from, data.to, data.period)}</p>

          )}

        </div>
      </div>

      <CollapsibleToolbar title="Filtres & actions" summary={toolbarSummary} className="mb-4">
        <div className="analytics-toolbar-grid">
          <div className="analytics-toolbar-grid__filters">
            <ToggleGroup
              type="single"
              size="sm"
              value={period}
              onValueChange={(value) => value && setPeriod(value)}
              className="analytics-toolbar-grid__period w-full"
            >
              {PERIOD_OPTIONS.map((option) => (
                <ToggleGroupItem key={option.value} value={option.value} className="flex-1">
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <DatePicker value={date} onChange={setDate} className="w-full" />
          </div>
          <div className="analytics-toolbar-grid__actions">
            <Button type="button" className="w-full" onClick={load} disabled={loading}>
              Actualiser
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={exportBusinessPdf}
              disabled={exportingPdf || loading}
            >
              {exportingPdf ? '…' : 'PDF'}
            </Button>
            <Link to="/pos" className="w-full">
              <Button type="button" variant="outline" className="w-full">POS</Button>
            </Link>
          </div>
        </div>
      </CollapsibleToolbar>



      {error && (

        <Alert className="mb-4" variant="destructive">

          <AlertTitle>Erreur</AlertTitle>

          <AlertDescription>{error}</AlertDescription>

        </Alert>

      )}



      {loading ? (
        <DashboardLoading />
      ) : (

        <>

          <div className="analytics-kpis grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">

            <Card>

              <CardHeader className="pb-2">

                <CardDescription>Chiffre d'affaires</CardDescription>

                <CardTitle className="flex items-center gap-2 text-base">

                  <DollarSign className="size-4" />

                  {formatMad(s.revenue || 0)}

                </CardTitle>

              </CardHeader>

            </Card>

            <Card>

              <CardHeader className="pb-2">

                <CardDescription>Commandes</CardDescription>

                <CardTitle className="flex items-center gap-2 text-base">

                  <ShoppingCart className="size-4" />

                  {s.orders_count || 0}

                </CardTitle>

              </CardHeader>

            </Card>

            <Card>

              <CardHeader className="pb-2">

                <CardDescription>Commandes payées</CardDescription>

                <CardTitle className="flex items-center gap-2 text-base">

                  <TrendingUp className="size-4" />

                  {s.orders_paid || 0}

                </CardTitle>

              </CardHeader>

            </Card>

            <Card>

              <CardHeader className="pb-2">

                <CardDescription>Ticket moyen</CardDescription>

                <CardTitle className="flex items-center gap-2 text-base">

                  <CreditCard className="size-4" />

                  {formatMad(s.avg_ticket || 0)}

                </CardTitle>

              </CardHeader>

            </Card>

            <Card>

              <CardHeader className="pb-2">

                <CardDescription>Dépenses</CardDescription>

                <CardTitle className="flex items-center gap-2 text-base">

                  <ReceiptText className="size-4" />

                  {formatMad(s.expense_total || 0)}

                </CardTitle>

              </CardHeader>

            </Card>

            <Card>

              <CardHeader className="pb-2">

                <CardDescription>Résultat net</CardDescription>

                <CardTitle className="flex items-center gap-2 text-base">

                  <TrendingDown className="size-4" />

                  {formatMad(s.net_result || 0)}

                </CardTitle>

              </CardHeader>

            </Card>

          </div>



          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-5">

            <Card><CardContent className="py-4 text-sm">Paiements: <strong>{s.payments_count || 0}</strong></CardContent></Card>

            <Card><CardContent className="py-4 text-sm">Annulations: <strong>{s.orders_cancelled || 0}</strong></CardContent></Card>

            <Card><CardContent className="py-4 text-sm">Paiements annulés: <strong>{s.void_count || 0}</strong></CardContent></Card>

            <Card><CardContent className="py-4 text-sm">Remises: <strong>{formatMad(s.discount_total || 0)}</strong></CardContent></Card>

            <Card><CardContent className="py-4 text-sm">Service: <strong>{formatMad(s.service_charge_total || 0)}</strong></CardContent></Card>

          </div>



          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-10">

            <Card className="lg:col-span-6">

              <CardHeader><CardTitle>Évolution du chiffre d'affaires (MAD)</CardTitle></CardHeader>

              <CardContent>

                {revenueSeries.length ? (

                  <ChartContainer config={revenueChartConfig} className="aspect-[16/9] min-h-[260px] w-full">

                    <BarChart data={revenueSeries} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>

                      <CartesianGrid vertical={false} />

                      <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />

                      <YAxis tickLine={false} axisLine={false} width={48} />

                      <ChartTooltip content={<ChartTooltipContent />} />

                      <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} />

                    </BarChart>

                  </ChartContainer>

                ) : (

                  <ChartEmpty />

                )}

              </CardContent>

            </Card>

            <Card className="lg:col-span-4">

              <CardHeader><CardTitle>Répartition des paiements</CardTitle></CardHeader>

              <CardContent>

                {methodSegments.length ? (

                  <ChartContainer config={methodChartConfig} className="mx-auto aspect-square min-h-[260px] max-h-[320px]">

                    <PieChart>

                      <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />

                      <Pie

                        data={methodSegments}

                        dataKey="value"

                        nameKey="label"

                        innerRadius={56}

                        outerRadius={88}

                        strokeWidth={2}

                      >

                        {methodSegments.map((entry, index) => (

                          <Cell key={entry.key} fill={PIE_COLORS[index % PIE_COLORS.length]} />

                        ))}

                      </Pie>

                      <ChartLegend content={<ChartLegendContent nameKey="label" />} />

                    </PieChart>

                  </ChartContainer>

                ) : (

                  <ChartEmpty />

                )}

              </CardContent>

            </Card>

          </div>



          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">

            <Card>

              <CardHeader><CardTitle>Commandes par type</CardTitle></CardHeader>

              <CardContent>

                {typeSegments.length ? (

                  <ChartContainer config={typeChartConfig} className="aspect-[16/9] min-h-[240px] w-full">

                    <LineChart data={typeSegments} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>

                      <CartesianGrid vertical={false} />

                      <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />

                      <YAxis tickLine={false} axisLine={false} width={40} allowDecimals={false} />

                      <ChartTooltip content={<ChartTooltipContent />} />

                      <Line

                        type="monotone"

                        dataKey="value"

                        stroke="var(--color-value)"

                        strokeWidth={2}

                        dot={{ fill: 'var(--color-value)', r: 4 }}

                        activeDot={{ r: 6 }}

                      />

                    </LineChart>

                  </ChartContainer>

                ) : (

                  <ChartEmpty />

                )}

              </CardContent>

            </Card>

            <Card>

              <CardHeader><CardTitle>Activité (commandes par bucket)</CardTitle></CardHeader>

              <CardContent>

                {ordersSeries.length ? (

                  <ChartContainer config={ordersChartConfig} className="aspect-[16/9] min-h-[240px] w-full">

                    <BarChart data={ordersSeries} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>

                      <CartesianGrid vertical={false} />

                      <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />

                      <YAxis tickLine={false} axisLine={false} width={40} allowDecimals={false} />

                      <ChartTooltip content={<ChartTooltipContent />} />

                      <Bar dataKey="orders" fill="var(--color-orders)" radius={[4, 4, 0, 0]} />

                    </BarChart>

                  </ChartContainer>

                ) : (

                  <ChartEmpty />

                )}

              </CardContent>

            </Card>

          </div>



          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-10">

            <Card className="lg:col-span-4">

              <CardHeader><CardTitle>Top articles</CardTitle></CardHeader>

              <CardContent className="p-0">

                <table className="w-full text-sm">

                  <thead className="bg-muted/50 text-left">

                    <tr>

                      <th className="px-3 py-2">Article</th>

                      <th className="px-3 py-2">Qté</th>

                      <th className="px-3 py-2">CA</th>

                    </tr>

                  </thead>

                  <tbody>

                    {(data?.top_items || []).map((row) => (

                      <tr key={row.name} className="border-t">

                        <td className="px-3 py-2">{row.name}</td>

                        <td className="px-3 py-2">{row.qty}</td>

                        <td className="px-3 py-2">{formatMad(row.revenue)}</td>

                      </tr>

                    ))}

                  </tbody>

                </table>

              </CardContent>

            </Card>

            <Card className="lg:col-span-6">

              <CardHeader className="flex-row items-center justify-between">

                <CardTitle>Commandes par statut</CardTitle>

                <Link to="/orders">

                  <Button type="button" variant="ghost" size="sm">Voir commandes</Button>

                </Link>

              </CardHeader>

              <CardContent className="p-0">

                <table className="w-full text-sm">

                  <thead className="bg-muted/50 text-left">

                    <tr>

                      <th className="px-3 py-2">Statut</th>

                      <th className="px-3 py-2">Nombre</th>

                    </tr>

                  </thead>

                  <tbody>

                    {statusRows.map((row) => (

                      <tr key={row.key} className="border-t">

                        <td className="px-3 py-2"><Badge variant="outline">{row.status}</Badge></td>

                        <td className="px-3 py-2">{row.count}</td>

                      </tr>

                    ))}

                  </tbody>

                </table>

              </CardContent>

            </Card>

          </div>



          <Card className="mt-4">

            <CardHeader className="flex-row items-center justify-between">

              <CardTitle>Derniers paiements</CardTitle>

              <Link to="/caisse/history">

                <Button type="button" variant="ghost" size="sm">Historique complet</Button>

              </Link>

            </CardHeader>

            <CardContent className="p-0 overflow-x-auto">

              <table className="w-full min-w-[900px] text-sm">

                <thead className="bg-muted/50 text-left">

                  <tr>

                    <th className="px-3 py-2">Ticket</th>

                    <th className="px-3 py-2">Commande</th>

                    <th className="px-3 py-2">Type</th>

                    <th className="px-3 py-2">Montant</th>

                    <th className="px-3 py-2">Mode</th>

                    <th className="px-3 py-2">Caissier</th>

                    <th className="px-3 py-2">Date</th>

                  </tr>

                </thead>

                <tbody>

                  {(data?.recent_payments || []).map((row) => (

                    <tr key={row._id} className="border-t">

                      <td className="px-3 py-2">{row.receipt_number}</td>

                      <td className="px-3 py-2">{row.order_number}</td>

                      <td className="px-3 py-2">{TYPE_LABELS[row.order_type] || row.order_type}</td>

                      <td className="px-3 py-2">{formatMad(row.amount)}</td>

                      <td className="px-3 py-2">{METHOD_LABELS[row.method] || row.method}</td>

                      <td className="px-3 py-2">{row.processed_by}</td>

                      <td className="px-3 py-2">{formatDateTime(row.processed_at)}</td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </CardContent>

          </Card>

        </>

      )}

    </div>

  );

}

