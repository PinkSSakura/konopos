import React, { useCallback, useEffect, useState } from 'react';
import { Filter, Loader2, RefreshCw } from 'lucide-react';
import { message } from '@/lib/toast';
import Table from '@/components/data/SimpleTable';
import { Badge as Tag } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Select from '@/components/ui/AppSelect';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import client from '../../api/client';
import ListFilterBar from '../../components/ListFilterBar';
import TableActions from '../../components/TableActions';
import PaymentHistoryMobileCardList from '../../components/caisse/PaymentHistoryMobileCardList';
import PaymentHistoryFilterSheet from '../../components/caisse/PaymentHistoryFilterSheet';
import MobileActionSheet from '../../components/mobile/MobileActionSheet';
import { TableLoading, PageLoading } from '../../components/loading/LoadingStates';
import { PageShell, PageTableCard } from '../../components/layout/PageShell';
import { tablePagination } from '../../utils/tablePagination';
import { formatDateTime } from '../../utils/dateFilters';
import { useAuth } from '../../context/AuthContext';
import { canViewPaymentHistory, canVoidPayment } from '../../utils/paymentAccess';
import { hasPermission } from '../../utils/permissions';
import { fetchAndPrintReceipt } from '../../utils/printReceipt';
import { buildDateRangeParams, defaultTodayRange } from '../../utils/dateFilters';
import useIsMobile from '../../hooks/useIsMobile';

const METHOD_LABELS = {
  cash: 'Espèces',
  card: 'Carte',
  credit: 'Crédit client',
  debit: 'Débit compte',
};

const initialDates = defaultTodayRange();

export default function PaymentHistoryPage() {
  const { user, loading: authLoading, capabilities } = useAuth();
  const isMobile = useIsMobile();
  const showVoid = canVoidPayment(user, capabilities);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState(initialDates.from);
  const [dateTo, setDateTo] = useState(initialDates.to);
  const [method, setMethod] = useState(null);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [voidConfirm, setVoidConfirm] = useState(null);

  const canReprint = hasPermission(user, 'print_receipt') || hasPermission(user, 'payment_process');

  const load = useCallback(() => {
    setLoading(true);
    const params = {
      limit: 300,
      ...buildDateRangeParams(dateFrom, dateTo),
    };
    if (search.trim()) params.q = search.trim();
    if (method) params.method = method;

    client
      .get('/payments/history', { params })
      .then((res) => setData(res.data.data))
      .catch(() => message.error('Erreur'))
      .finally(() => setLoading(false));
  }, [search, dateFrom, dateTo, method]);

  useEffect(() => {
    load();
  }, [load]);

  const handleReset = ({ search: s, from, to }) => {
    setSearch(s);
    setDateFrom(from);
    setDateTo(to);
    setMethod(null);
  };

  const hasActiveFilters = Boolean(
    search.trim()
    || method
    || dateFrom !== initialDates.from
    || dateTo !== initialDates.to,
  );

  const voidPayment = async (paymentId) => {
    try {
      await client.post(`/payments/${paymentId}/void`, { reason: 'Annulation caisse' });
      message.success('Paiement annulé');
      setSelectedPayment(null);
      setVoidConfirm(null);
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur');
    }
  };

  const reprintTicket = async (row) => {
    const hide = message.loading('Préparation du ticket…', 0);
    try {
      await fetchAndPrintReceipt(row.order_id, row._id);
      message.success('Dialogue d\'impression ouvert');
    } catch (err) {
      message.error(err.response?.data?.message || 'Impossible d\'imprimer le ticket');
    } finally {
      hide();
    }
  };

  const buildActions = (row) => {
    const items = [];
    if (!row.is_void && canReprint && row.order_id) {
      items.push({
        key: 'reprint',
        label: 'Réimprimer le ticket',
        onClick: () => reprintTicket(row),
      });
    }
    if (!row.is_void && showVoid) {
      items.push({
        key: 'void',
        label: 'Annuler le paiement',
        danger: true,
        confirm: 'Annuler ce paiement ? Cette action est irréversible.',
        onClick: () => voidPayment(row._id),
      });
    }
    return items;
  };

  const buildMobileActions = (row) => {
    const actions = [];
    if (!row.is_void && canReprint && row.order_id) {
      actions.push({
        key: 'reprint',
        label: 'Réimprimer le ticket',
        onClick: () => reprintTicket(row),
      });
    }
    if (!row.is_void && showVoid) {
      actions.push({
        key: 'void',
        label: 'Annuler le paiement',
        danger: true,
        onClick: () => setVoidConfirm(row),
      });
    }
    return actions;
  };

  if (authLoading) {
    return (
      <PageShell title="Historique des paiements">
        <PageTableCard>
          <PageLoading />
        </PageTableCard>
      </PageShell>
    );
  }

  if (!canViewPaymentHistory(user)) {
    return (
      <PageShell title="Historique des paiements">
        <PageTableCard>
          <p className="text-sm text-muted-foreground">Accès refusé.</p>
        </PageTableCard>
      </PageShell>
    );
  }

  const columns = [
    {
      key: 'processed_at',
      title: 'Date / heure',
      dataIndex: 'processed_at',
      render: (d) => formatDateTime(d),
      width: 160,
    },
    { key: 'receipt_number', title: 'Ticket', dataIndex: 'receipt_number', width: 130 },
    { key: 'order_number', title: 'Commande', dataIndex: 'order_number' },
    { key: 'waiter', title: 'Serveur', dataIndex: 'waiter' },
    {
      key: 'method',
      title: 'Mode',
      dataIndex: 'method',
      render: (m) => METHOD_LABELS[m] || m,
    },
    {
      key: 'amount',
      title: 'Montant',
      dataIndex: 'amount',
      render: (a) => `${a?.toFixed(2)} MAD`,
    },
    {
      key: 'processed_by',
      title: 'Caissier',
      dataIndex: 'processed_by',
    },
    {
      key: 'status',
      title: 'Statut',
      render: (_, r) => (
        r.is_void ? (
          <Tag variant="outline" className="border-red-200 bg-red-50 text-red-800">Annulé</Tag>
        ) : (
          <Tag variant="outline" className="border-green-200 bg-green-50 text-green-800">OK</Tag>
        )
      ),
    },
    {
      key: 'actions',
      title: 'Actions',
      className: 'page-table-actions-col',
      width: 120,
      align: 'center',
      render: (_, r) => <TableActions items={buildActions(r)} />,
    },
  ];

  const pageSubtitle = isMobile
    ? 'Touchez un paiement pour agir.'
    : 'Recherche, filtres et historique des paiements.';

  return (
    <>
      <PageShell title="Historique des paiements" subtitle={pageSubtitle}>
        <PageTableCard contentClassName="space-y-4">
          {isMobile ? (
            <>
              <div className="orders-mobile-toolbar">
                <Button
                  variant={hasActiveFilters ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setFilterSheetOpen(true)}
                >
                  <Filter className="size-4" data-icon="inline-start" />
                  Filtres
                </Button>
                <Button variant="outline" size="sm" disabled={loading} onClick={load}>
                  {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="size-4" />
                  )}
                </Button>
              </div>
              {loading ? (
                <TableLoading rows={4} columns={1} />
              ) : (
                <PaymentHistoryMobileCardList
                  rows={data}
                  onSelect={setSelectedPayment}
                />
              )}
              <PaymentHistoryFilterSheet
                open={filterSheetOpen}
                onOpenChange={setFilterSheetOpen}
                search={search}
                onSearchChange={setSearch}
                dateFrom={dateFrom}
                dateTo={dateTo}
                onFromChange={setDateFrom}
                onToChange={setDateTo}
                method={method}
                onMethodChange={setMethod}
                onApply={load}
                onReset={() => handleReset({ search: '', from: initialDates.from, to: initialDates.to })}
                loading={loading}
              />
            </>
          ) : (
            <>
              <ListFilterBar
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder="Ticket, commande, serveur…"
                from={dateFrom}
                to={dateTo}
                onFromChange={setDateFrom}
                onToChange={setDateTo}
                onApply={load}
                onReset={handleReset}
                loading={loading}
                extra={(
                  <Select
                    allowClear
                    placeholder="Mode"
                    style={{ width: 130 }}
                    value={method}
                    onChange={setMethod}
                    options={Object.entries(METHOD_LABELS).map(([v, l]) => ({ value: v, label: l }))}
                  />
                )}
              />
              {loading ? (
                <TableLoading rows={10} columns={9} />
              ) : (
                <div className="data-table-wrap">
                  <Table
                    rowKey="_id"
                    dataSource={data}
                    columns={columns}
                    pagination={tablePagination}
                  />
                </div>
              )}
            </>
          )}
        </PageTableCard>
      </PageShell>

      {isMobile && (
        <>
          <MobileActionSheet
            open={Boolean(selectedPayment)}
            onOpenChange={(open) => { if (!open) setSelectedPayment(null); }}
            title={selectedPayment?.receipt_number ? `Ticket ${selectedPayment.receipt_number}` : 'Paiement'}
            subtitle={selectedPayment ? [
              selectedPayment.order_number,
              METHOD_LABELS[selectedPayment.method] || selectedPayment.method,
              selectedPayment.is_void ? 'Annulé' : null,
            ].filter(Boolean).join(' · ') : ''}
            actions={selectedPayment ? buildMobileActions(selectedPayment) : []}
          >
            {selectedPayment && (
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Date</dt>
                  <dd className="font-medium">{formatDateTime(selectedPayment.processed_at)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Montant</dt>
                  <dd className="text-lg font-bold">
                    {selectedPayment.amount != null
                      ? `${Number(selectedPayment.amount).toFixed(2)} MAD`
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Commande</dt>
                  <dd className="font-medium">{selectedPayment.order_number || '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Serveur</dt>
                  <dd className="font-medium">{selectedPayment.waiter || '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Caissier</dt>
                  <dd className="font-medium">{selectedPayment.processed_by || '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Statut</dt>
                  <dd className="font-medium">{selectedPayment.is_void ? 'Annulé' : 'Validé'}</dd>
                </div>
              </dl>
            )}
          </MobileActionSheet>

          <AlertDialog open={Boolean(voidConfirm)} onOpenChange={(open) => { if (!open) setVoidConfirm(null); }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmation</AlertDialogTitle>
                <AlertDialogDescription>
                  Annuler ce paiement ? Cette action est irréversible.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() => voidPayment(voidConfirm._id)}
                >
                  Confirmer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </>
  );
}
