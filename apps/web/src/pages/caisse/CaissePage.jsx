import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, Filter, Loader2, RefreshCw, Search } from 'lucide-react';
import { message } from '@/lib/toast';
import Table from '@/components/data/SimpleTable';
import { Badge as Tag } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Select from '@/components/ui/AppSelect';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import client from '../../api/client';
import CheckoutModal from '../../components/receipt/CheckoutModal';
import BatchCheckoutModal from '../../components/caisse/BatchCheckoutModal';
import CaisseMobileCardList from '../../components/caisse/CaisseMobileCardList';
import CaisseFilterSheet from '../../components/caisse/CaisseFilterSheet';
import MobileActionSheet from '../../components/mobile/MobileActionSheet';
import TableListFilterBar from '../../components/TableListFilterBar';
import { TableLoading, CardLoading } from '../../components/loading/LoadingStates';
import { tablePagination } from '../../utils/tablePagination';
import { rowMatchesSearch } from '../../utils/listSearch';
import { useSocketEvent } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { useEstablishment } from '../../context/EstablishmentContext';
import { canMarkDelivered, canProcessPayment } from '../../utils/paymentAccess';
import { openCheckout } from '../../utils/openCheckout';
import useIsMobile from '../../hooks/useIsMobile';
import { orderStatusLabel } from '../../utils/orderStatusLabels';

const TYPE_LABELS = { dine_in: 'Sur place', takeaway: 'À emporter', delivery: 'Livraison' };
const TYPE_TAG_CLASS = {
  dine_in: 'border-blue-200 bg-blue-50 text-blue-800',
  takeaway: 'border-orange-200 bg-orange-50 text-orange-800',
  delivery: 'border-purple-200 bg-purple-50 text-purple-800',
};

function isBatchEligible(row) {
  return row?.can_pay && row.order?.payment_status === 'unpaid';
}

export default function CaissePage() {
  const navigate = useNavigate();
  const { user, loading: authLoading, isPinSession } = useAuth();
  const { establishment } = useEstablishment();
  const isMobile = useIsMobile();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('all');
  const [checkoutId, setCheckoutId] = useState(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState(null);
  const [applied, setApplied] = useState({ search: '', typeFilter: null });
  const [dailyCode, setDailyCode] = useState('');
  const [codeLookupLoading, setCodeLookupLoading] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [batchOpen, setBatchOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    client
      .get('/payments/ready')
      .then((res) => setRows(res.data.data.filter((r) => r.can_pay)))
      .catch(() => message.error('Erreur chargement'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useSocketEvent('order:changed', load);

  const startCheckout = (orderId) => {
    openCheckout({
      orderId,
      navigate,
      user,
      isPinSession,
      establishment,
      openModal: setCheckoutId,
      returnTo: '/caisse/encaisser',
    });
  };

  const lookupDailyCode = async () => {
    const trimmed = dailyCode.replace(/\D/g, '');
    if (!trimmed) {
      message.warning('Saisissez un code du jour');
      return;
    }
    setCodeLookupLoading(true);
    try {
      const res = await client.get(`/payments/by-daily-code/${trimmed}`);
      const { order, can_pay, pay_block_reason } = res.data.data;
      if (!can_pay) {
        message.warning(pay_block_reason || 'Commande pas encore prête à encaisser');
        return;
      }
      if (order.status === 'cancelled') {
        message.warning('Commande annulée — encaissement impossible');
        return;
      }
      startCheckout(order._id);
    } catch (err) {
      message.error(err.response?.data?.message || 'Code introuvable');
    } finally {
      setCodeLookupLoading(false);
    }
  };

  const markDelivered = async (orderId) => {
    try {
      await client.post(`/orders/${orderId}/mark-delivered`);
      message.success('Commande livrée');
      setSelectedRow(null);
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur');
    }
  };

  const filtered = useMemo(() => rows.filter((r) => {
    if (tab !== 'all' && r.order.type !== tab) return false;
    if (applied.typeFilter && r.order.type !== applied.typeFilter) return false;
    if (!rowMatchesSearch(r, applied.search, [
      (row) => row.order?.order_number,
      (row) => row.order?.daily_code,
      (row) => row.order?.table?.name,
      (row) => row.order?.waiter?.fullname,
      (row) => row.order?.status,
    ])) return false;
    return true;
  }), [rows, tab, applied]);

  const hasActiveFilters = Boolean(applied.search.trim() || applied.typeFilter || tab !== 'all');

  const batchEligible = useMemo(
    () => filtered.filter(isBatchEligible),
    [filtered],
  );

  const selectedBatchRows = useMemo(
    () => batchEligible.filter((row) => selectedIds.has(row.order._id)),
    [batchEligible, selectedIds],
  );

  const allEligibleSelected = batchEligible.length > 0
    && batchEligible.every((row) => selectedIds.has(row.order._id));

  const toggleSelect = (orderId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allEligibleSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(batchEligible.map((row) => row.order._id)));
  };

  const clearBatchSelection = () => setSelectedIds(new Set());

  const buildMobileActions = (row) => {
    const actions = [];
    if (row.order.type === 'delivery' && canMarkDelivered(user, row.order)) {
      actions.push({
        key: 'delivered',
        label: 'Marquer livrée',
        onClick: () => markDelivered(row.order._id),
      });
    }
    actions.push({
      key: 'checkout',
      label: row.order.payment_status === 'partial' ? 'Suite paiement' : 'Encaisser',
      onClick: () => startCheckout(row.order._id),
    });
    return actions;
  };

  const columns = [
    {
      key: 'select',
      title: (
        <Checkbox
          checked={allEligibleSelected}
          disabled={!batchEligible.length}
          onCheckedChange={toggleSelectAll}
          aria-label="Tout sélectionner"
        />
      ),
      width: 48,
      render: (_, r) => (
        <Checkbox
          checked={selectedIds.has(r.order._id)}
          disabled={!isBatchEligible(r)}
          onCheckedChange={() => toggleSelect(r.order._id)}
          aria-label={`Sélectionner ${r.order.order_number}`}
        />
      ),
    },
    { key: 'order_number', title: 'N°', dataIndex: ['order', 'order_number'], width: 140 },
    {
      key: 'daily_code',
      title: 'Code jour',
      dataIndex: ['order', 'daily_code'],
      width: 100,
      render: (v) => v || '—',
    },
    {
      key: 'type',
      title: 'Type',
      dataIndex: ['order', 'type'],
      render: (t) => (
        <Tag variant="outline" className={cn(TYPE_TAG_CLASS[t])}>
          {TYPE_LABELS[t]}
        </Tag>
      ),
    },
    {
      key: 'status',
      title: 'Statut',
      dataIndex: ['order', 'status'],
      render: (s, r) => (
        <div className="flex flex-wrap gap-1">
          <Tag variant="secondary">{orderStatusLabel(s)}</Tag>
          {r.order.payment_status === 'partial' && (
            <Tag variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
              Partiel
            </Tag>
          )}
        </div>
      ),
    },
    { key: 'table', title: 'Table', dataIndex: ['order', 'table', 'name'], render: (v) => v || '—' },
    { key: 'waiter', title: 'Serveur', dataIndex: ['order', 'waiter', 'fullname'] },
    {
      key: 'balance',
      title: 'Solde dû',
      render: (_, r) => (
        <span className="font-semibold">
          {r.amounts?.balance_due != null
            ? `${Number(r.amounts.balance_due).toFixed(2)} MAD`
            : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      title: 'Actions',
      width: 200,
      render: (_, r) => (
        <div className="flex flex-wrap gap-1">
          {r.order.type === 'delivery' && canMarkDelivered(user, r.order) && (
            <Button size="sm" variant="outline" onClick={() => markDelivered(r.order._id)}>
              Livré
            </Button>
          )}
          <Button size="sm" onClick={() => startCheckout(r.order._id)}>
            <DollarSign className="size-3.5" />
            Encaisser
          </Button>
        </div>
      ),
    },
  ];

  if (authLoading) {
    return <CardLoading />;
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

  const dailyCodeBlock = (
    <div className="flex flex-wrap gap-2">
      <Input
        placeholder="Code du jour (6 chiffres)"
        value={dailyCode}
        onChange={(e) => setDailyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        className={isMobile ? 'flex-1 min-w-[140px]' : 'w-[180px]'}
        maxLength={6}
        onKeyDown={(e) => {
          if (e.key === 'Enter') lookupDailyCode();
        }}
      />
      <Button disabled={codeLookupLoading} onClick={lookupDailyCode}>
        {codeLookupLoading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Search className="size-4" />
        )}
        Trouver commande
      </Button>
    </div>
  );

  if (isMobile) {
    const order = selectedRow?.order;
    return (
      <>
        <Card>
          <CardHeader className="border-b border-border/60 pb-3">
            <CardTitle className="text-xl font-semibold">À encaisser</CardTitle>
            <p className="text-sm text-muted-foreground">
              Touchez une commande pour encaisser.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {dailyCodeBlock}
            <div className="orders-mobile-toolbar">
              <Button
                size="sm"
                disabled={!selectedBatchRows.length}
                onClick={() => setBatchOpen(true)}
              >
                <DollarSign className="size-4" data-icon="inline-start" />
                Encaisser (
                {selectedBatchRows.length}
                )
              </Button>
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
              <CaisseMobileCardList
                rows={filtered}
                onSelect={setSelectedRow}
                selectionMode
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                isEligible={isBatchEligible}
              />
            )}
          </CardContent>
        </Card>

        <CaisseFilterSheet
          open={filterSheetOpen}
          onOpenChange={setFilterSheetOpen}
          search={search}
          onSearchChange={setSearch}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          tab={tab}
          onTabChange={setTab}
          onApply={() => setApplied({ search, typeFilter: typeFilter || (tab === 'all' ? null : tab) })}
          onReset={() => {
            setSearch('');
            setTypeFilter(null);
            setTab('all');
            setApplied({ search: '', typeFilter: null });
          }}
          loading={loading}
        />

        <MobileActionSheet
          open={Boolean(selectedRow)}
          onOpenChange={(open) => { if (!open) setSelectedRow(null); }}
          title={order?.order_number || ''}
          subtitle={order ? [
            order.table?.name ? `Table ${order.table.name}` : TYPE_LABELS[order.type],
            orderStatusLabel(order.status),
          ].join(' · ') : ''}
          actions={selectedRow ? buildMobileActions(selectedRow) : []}
        >
          {selectedRow && order && (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Type</dt>
                <dd className="font-medium">{TYPE_LABELS[order.type]}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Solde dû</dt>
                <dd className="text-lg font-bold">
                  {selectedRow.amounts?.balance_due != null
                    ? `${Number(selectedRow.amounts.balance_due).toFixed(2)} MAD`
                    : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Serveur</dt>
                <dd className="font-medium">{order.waiter?.fullname || '—'}</dd>
              </div>
              {order.daily_code != null && (
                <div>
                  <dt className="text-muted-foreground">Code jour</dt>
                  <dd className="font-medium">{String(order.daily_code).padStart(4, '0')}</dd>
                </div>
              )}
            </dl>
          )}
        </MobileActionSheet>

        <CheckoutModal
          orderId={checkoutId}
          open={Boolean(checkoutId)}
          onClose={() => setCheckoutId(null)}
          onSuccess={() => {
            load();
            setCheckoutId(null);
            setSelectedRow(null);
          }}
        />

        <BatchCheckoutModal
          open={batchOpen}
          onClose={() => setBatchOpen(false)}
          rows={selectedBatchRows}
          onSuccess={() => {
            load();
            clearBatchSelection();
            setBatchOpen(false);
          }}
        />
      </>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="border-b border-border/60">
          <CardTitle className="text-xl font-semibold">Caisse — À encaisser</CardTitle>
          <CardAction className="flex flex-wrap gap-2">
            <Button
              disabled={!selectedBatchRows.length}
              onClick={() => setBatchOpen(true)}
            >
              <DollarSign className="size-4" />
              Encaisser la sélection (
              {selectedBatchRows.length}
              )
            </Button>
            <Button variant="outline" disabled={loading} onClick={load}>
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Actualiser
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <CardDescription>
            Sur place : après service · À emporter : après préparation · Livraison : après livraison
          </CardDescription>
          {dailyCodeBlock}
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="all">Tous ({rows.length})</TabsTrigger>
              <TabsTrigger value="dine_in">Sur place</TabsTrigger>
              <TabsTrigger value="takeaway">À emporter</TabsTrigger>
              <TabsTrigger value="delivery">Livraison</TabsTrigger>
            </TabsList>
          </Tabs>
          <TableListFilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="N° commande, code jour, table, serveur…"
            loading={loading}
            onApply={() => setApplied({ search, typeFilter })}
            onReset={() => {
              setSearch('');
              setTypeFilter(null);
              setApplied({ search: '', typeFilter: null });
            }}
            extra={(
              <Select
                allowClear
                placeholder="Type"
                style={{ width: 150 }}
                value={typeFilter}
                onChange={setTypeFilter}
                options={Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }))}
              />
            )}
          />
          {loading ? (
            <TableLoading rows={8} columns={6} />
          ) : (
            <Table
              rowKey={(r) => r.order._id}
              dataSource={filtered}
              columns={columns}
              pagination={tablePagination}
              locale={{ emptyText: 'Aucune commande en attente de paiement' }}
            />
          )}
        </CardContent>
      </Card>

      <CheckoutModal
        orderId={checkoutId}
        open={Boolean(checkoutId)}
        onClose={() => setCheckoutId(null)}
        onSuccess={() => {
          load();
          setCheckoutId(null);
        }}
      />

      <BatchCheckoutModal
        open={batchOpen}
        onClose={() => setBatchOpen(false)}
        rows={selectedBatchRows}
        onSuccess={() => {
          load();
          clearBatchSelection();
          setBatchOpen(false);
        }}
      />
    </>
  );
}
