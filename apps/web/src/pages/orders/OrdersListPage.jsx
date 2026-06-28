import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Delete, Filter, Loader2, RefreshCw } from 'lucide-react';
import { message } from '@/lib/toast';
import client from '../../api/client';
import TableActions from '../../components/TableActions';
import CheckoutModal from '../../components/receipt/CheckoutModal';
import ListFilterBar from '../../components/ListFilterBar';
import OrdersMobileCardList from '../../components/orders/OrdersMobileCardList';
import OrderDetailBottomSheet from '../../components/orders/OrderDetailBottomSheet';
import OrdersFilterSheet from '../../components/orders/OrdersFilterSheet';
import { TableLoading } from '../../components/loading/LoadingStates';
import { PageShell, PageTableCard } from '../../components/layout/PageShell';
import SimpleTable from '@/components/data/SimpleTable';
import AppModal from '@/components/ui/AppModal';
import AppSelect from '@/components/ui/AppSelect';
import { tablePagination } from '../../utils/tablePagination';
import { useSocketEvent } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { useEstablishment } from '../../context/EstablishmentContext';
import { ESTABLISHMENT_CAP } from '../../utils/establishmentCapabilities';
import { canProcessPayment, canCheckoutOrder, canReprintReceipt, canMarkDelivered, canCancelUnpaidOrder, canRefundAndCancelOrder } from '../../utils/paymentAccess';
import { openCheckout as navigateToCheckout } from '../../utils/openCheckout';
import {
  canReprintKitchenTicket,
  canPrintKitchenOrder,
  getKitchenProductType,
  isKitchenStaffRole,
} from '../../utils/kdsaccess';
import { buildDateRangeParams, defaultTodayRange, formatDateTime } from '../../utils/dateFilters';
import useIsMobile from '../../hooks/useIsMobile';
import { canEditOrderInPos } from '../../utils/orderEditAccess';
import {
  canMutateOrder,
  isWaiterRole,
  orderOwnerLabel,
} from '../../utils/orderOwnership';
import { fetchAndPrintReceipt } from '../../utils/printReceipt';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  ACTIVE_ORDER_STATUSES,
  orderItemStatusLabel,
  orderStatusLabel,
} from '../../utils/orderStatusLabels';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

const statusBadgeClass = {
  open: '',
  sent: 'border-blue-200 bg-blue-50 text-blue-800',
  preparing: 'border-orange-200 bg-orange-50 text-orange-800',
  ready: 'border-cyan-200 bg-cyan-50 text-cyan-800',
  served: 'border-green-200 bg-green-50 text-green-800',
  delivered: 'border-blue-200 bg-blue-50 text-blue-800',
  paid: 'border-purple-200 bg-purple-50 text-purple-800',
  cancelled: 'border-red-200 bg-red-50 text-red-800',
};

const typeLabels = {
  dine_in: 'Sur place',
  takeaway: 'À emporter',
  delivery: 'Livraison',
};

const initialDates = defaultTodayRange();
const PIN_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

function StatusBadge({ status, children }) {
  return (
    <Badge variant="outline" className={cn(statusBadgeClass[status])}>
      {children ?? orderStatusLabel(status)}
    </Badge>
  );
}

function DetailItem({ label, children, span = 1 }) {
  return (
    <div className={cn(span === 2 && 'sm:col-span-2')}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}

export default function OrdersListPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [detail, setDetail] = useState(null);
  const [checkoutOrderId, setCheckoutOrderId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState(initialDates.from);
  const [dateTo, setDateTo] = useState(initialDates.to);
  const [statusFilter, setStatusFilter] = useState(null);
  const [typeFilter, setTypeFilter] = useState(null);

  const { user, loading: authLoading, isPinSession, capabilities } = useAuth();
  const { hasCapability, establishment } = useEstablishment();
  const isMobile = useIsMobile();
  const roleKey = user?.role?.role_key;
  const isKitchenReadOnly = isKitchenStaffRole(roleKey);
  const kitchenProductType = getKitchenProductType(roleKey);
  const showPayment = canProcessPayment(user) && !isKitchenReadOnly;
  const showKitchenPrint = canReprintKitchenTicket(roleKey) && !isKitchenReadOnly;
  const [printingKitchen, setPrintingKitchen] = useState(false);
  const [cancelAuth, setCancelAuth] = useState({
    open: false,
    order: null,
    pin: '',
    submitting: false,
    mode: 'cancel',
  });
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [activeOnlyDefault, setActiveOnlyDefault] = useState(true);

  const useMobileOrders = isMobile && !isKitchenReadOnly;

  const load = useCallback(() => {
    setLoading(true);
    const params = { limit: 200, ...buildDateRangeParams(dateFrom, dateTo) };
    if (search.trim()) params.q = search.trim();
    if (statusFilter) params.status = statusFilter;
    if (typeFilter) params.type = typeFilter;

    client
      .get('/orders', { params })
      .then((res) => setOrders(res.data.data))
      .catch(() => message.error('Erreur'))
      .finally(() => setLoading(false));
  }, [search, dateFrom, dateTo, statusFilter, typeFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useSocketEvent('order:changed', load);

  const displayOrders = useMemo(() => {
    if (!useMobileOrders || !activeOnlyDefault || statusFilter) {
      return orders;
    }
    return orders.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status));
  }, [orders, useMobileOrders, activeOnlyDefault, statusFilter]);

  const hasActiveFilters = Boolean(
    search.trim() || statusFilter || typeFilter || !activeOnlyDefault,
  );

  const handleReset = ({ search: s, from, to }) => {
    setSearch(s);
    setDateFrom(from);
    setDateTo(to);
    setStatusFilter(null);
    setTypeFilter(null);
    setActiveOnlyDefault(true);
  };

  const openDetail = async (id) => {
    const res = await client.get(`/orders/${id}`);
    setDetail(res.data.data);
  };

  const handleCheckout = (order) => {
    navigateToCheckout({
      orderId: order._id,
      navigate,
      user,
      isPinSession,
      establishment,
      openModal: setCheckoutOrderId,
      returnTo: '/orders',
    });
  };

  const refundAndCancel = async (order, approverPin) => {
    try {
      await client.post(
        `/orders/${order._id}/refund-and-cancel`,
        approverPin ? { approver_pin: approverPin } : {},
      );
      message.success('Remboursement et annulation effectués');
      load();
      if (detail?.order?._id === order._id) setDetail(null);
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur');
    }
  };

  const requestRefundAndCancel = (order) => {
    if (roleKey !== 'waiter') {
      refundAndCancel(order);
      return;
    }
    if (hasCapability(ESTABLISHMENT_CAP.WAITER_CANCEL_ORDER)) {
      refundAndCancel(order);
      return;
    }
    setCancelAuth({ open: true, order, pin: '', submitting: false, mode: 'refund' });
  };

  const cancelOrder = async (order, approverPin) => {
    try {
      await client.post(`/orders/${order._id}/cancel`, approverPin ? { approver_pin: approverPin } : {});
      message.success('Commande annulée');
      load();
      if (detail?.order?._id === order._id) setDetail(null);
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur');
    }
  };

  const requestCancel = async (order) => {
    if (roleKey !== 'waiter') {
      cancelOrder(order);
      return;
    }
    if (hasCapability(ESTABLISHMENT_CAP.WAITER_CANCEL_ORDER)) {
      cancelOrder(order);
      return;
    }
    setCancelAuth({ open: true, order, pin: '', submitting: false, mode: 'cancel' });
  };

  const reprintTicket = async (order) => {
    const hide = message.loading('Préparation du ticket…', 0);
    try {
      await fetchAndPrintReceipt(order._id);
      message.success('Dialogue d\'impression ouvert');
    } catch (err) {
      message.error(err.response?.data?.message || 'Impossible d\'imprimer le ticket');
    } finally {
      hide();
    }
  };

  const markDelivered = async (order) => {
    try {
      await client.post(`/orders/${order._id}/mark-delivered`);
      message.success('Commande marquée livrée');
      load();
      if (detail?.order?._id === order._id) openDetail(order._id);
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur');
    }
  };

  const printKitchen = async (order) => {
    setPrintingKitchen(true);
    try {
      const res = await client.post(`/orders/${order._id}/print-kitchen`);
      message.success(res.data.message || 'Impression envoyée');
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur impression');
    } finally {
      setPrintingKitchen(false);
    }
  };

  const buildActions = (order) => {
    const items = [
      {
        key: 'view',
        label: 'Voir le détail',
        onClick: () => openDetail(order._id),
      },
    ];

    if (isKitchenReadOnly) return items;

    const canEdit = canEditOrderInPos(order) && canMutateOrder(user, order, 'update');
    const canPay = canMutateOrder(user, order, 'payment');
    const canServe = canMutateOrder(user, order, 'mark_served');
    const canPrint = canMutateOrder(user, order, 'print');

    if (canEdit) {
      items.push({
        key: 'edit',
        label: 'Modifier',
        link: `/pos?orderId=${order._id}`,
      });
    }

    if (canCancelUnpaidOrder(user, order)) {
      items.push({
        key: 'cancel',
        label: 'Annuler la commande',
        danger: true,
        onClick: () => requestCancel(order),
      });
    }

    if (showPayment && canRefundAndCancelOrder(user, order, capabilities)) {
      items.push({
        key: 'refund-cancel',
        label: 'Rembourser et annuler',
        danger: true,
        onClick: () => requestRefundAndCancel(order),
      });
    }

    if (showPayment && canPay && canCheckoutOrder(user, order)) {
      items.push({
        key: 'checkout',
        label: order.payment_status === 'partial' ? 'Suite paiement' : 'Encaisser',
        onClick: () => handleCheckout(order),
      });
    }

    if (showPayment && canServe && canMarkDelivered(user, order)) {
      items.push({
        key: 'delivered',
        label: 'Marquer livrée',
        onClick: () => markDelivered(order),
      });
    }

    if (showPayment && canPrint && canReprintReceipt(user)) {
      items.push({
        key: 'reprint',
        label: 'Imprimer ticket caisse',
        onClick: () => reprintTicket(order),
      });
    }

    if (showKitchenPrint && canPrint && canPrintKitchenOrder(order)) {
      items.push({
        key: 'print-kitchen',
        label: 'Imprimer cuisine / bar',
        onClick: () => printKitchen(order),
      });
    }

    return items;
  };

  const columns = [
    { title: 'N°', dataIndex: 'order_number', width: 140, render: (num, record) => (
      isKitchenReadOnly ? (
        <button type="button" className="text-left hover:underline" onClick={() => openDetail(record._id)}>
          {num}
        </button>
      ) : num
    ) },
    {
      title: 'Code jour',
      dataIndex: 'daily_code',
      width: 100,
      render: (code) => (code ? <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-800">{code}</Badge> : '—'),
    },
    {
      title: 'Date',
      dataIndex: 'created_at',
      width: 150,
      render: (d) => formatDateTime(d),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      render: (t) => typeLabels[t] || t,
    },
    {
      title: 'Statut',
      dataIndex: 'status',
      render: (s, r) => (
        <div className="flex flex-col gap-0.5">
          <StatusBadge status={s} />
          {r.payment_status === 'partial' && (
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">Paiement partiel</Badge>
          )}
        </div>
      ),
    },
    { title: 'Total', dataIndex: 'total', render: (t) => (t != null ? `${Number(t).toFixed(2)} MAD` : '—') },
    { title: 'Table', dataIndex: ['table', 'name'], render: (v) => v || '—' },
    {
      title: 'Serveur',
      dataIndex: ['waiter', 'fullname'],
      render: (name, record) => (
        <span className="inline-flex items-center gap-1">
          {name || '—'}
          {isWaiterRole(user) && record.is_own === false && (
            <Badge variant="outline">Autre</Badge>
          )}
        </span>
      ),
    },
    ...(isKitchenReadOnly
      ? []
      : [{
          title: 'Actions',
          className: 'page-table-actions-col',
          width: 120,
          align: 'center',
          render: (_, r) => <TableActions items={buildActions(r)} />,
        }]),
  ];

  const pageTitle = isKitchenReadOnly
    ? (kitchenProductType === 'FOOD' ? 'Commandes cuisine' : 'Commandes bar')
    : 'Commandes';

  const visibleDetailItems = detail?.items?.filter((i) => {
    if (kitchenProductType && i.product_type !== kitchenProductType) return false;
    if (i.status === 'cancelled') return Boolean(i.cancellation_reason);
    return i.status !== 'rejected';
  }) || [];

  const detailItemsTotal = visibleDetailItems.reduce((s, i) => s + (i.line_total || 0), 0);

  const pageSubtitle = isKitchenReadOnly
    ? 'Consultation des commandes en cours.'
    : useMobileOrders
      ? 'Commandes actives — touchez une carte pour agir.'
      : 'Recherche, filtres et détail des commandes.';

  if (authLoading) {
    return (
      <PageShell title={pageTitle} subtitle={pageSubtitle}>
        <PageTableCard>
          <TableLoading rows={10} columns={7} />
        </PageTableCard>
      </PageShell>
    );
  }

  return (
    <>
      <PageShell title={pageTitle} subtitle={pageSubtitle}>
        <PageTableCard contentClassName="space-y-4">
          {useMobileOrders ? (
            <>
              <div className="orders-mobile-toolbar">
                <Button
                  variant={activeOnlyDefault && !statusFilter ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setActiveOnlyDefault((v) => !v);
                    if (activeOnlyDefault && !statusFilter) setStatusFilter(null);
                  }}
                >
                  {activeOnlyDefault && !statusFilter ? 'En cours' : 'Toutes'}
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
                <OrdersMobileCardList
                  orders={displayOrders}
                  onSelect={openDetail}
                  showWaiterBadge={isWaiterRole(user)}
                />
              )}
              <OrdersFilterSheet
                open={filterSheetOpen}
                onOpenChange={setFilterSheetOpen}
                search={search}
                onSearchChange={setSearch}
                dateFrom={dateFrom}
                dateTo={dateTo}
                onFromChange={setDateFrom}
                onToChange={setDateTo}
                statusFilter={statusFilter}
                onStatusFilterChange={(v) => {
                  setStatusFilter(v);
                  if (v) setActiveOnlyDefault(false);
                }}
                typeFilter={typeFilter}
                onTypeFilterChange={setTypeFilter}
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
            searchPlaceholder="N°, code jour, table, serveur…"
            from={dateFrom}
            to={dateTo}
            onFromChange={setDateFrom}
            onToChange={setDateTo}
            onApply={load}
            onReset={handleReset}
            loading={loading}
            extra={(
              <>
                <AppSelect
                  allowClear
                  placeholder="Statut"
                  style={{ width: 130 }}
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={Object.keys(statusBadgeClass).map((s) => ({
                    value: s,
                    label: orderStatusLabel(s),
                  }))}
                />
                <AppSelect
                  allowClear
                  placeholder="Type"
                  style={{ width: 130 }}
                  value={typeFilter}
                  onChange={setTypeFilter}
                  options={Object.entries(typeLabels).map(([v, l]) => ({ value: v, label: l }))}
                />
              </>
            )}
          />
          {loading ? (
            <TableLoading rows={10} columns={7} />
          ) : (
            <div className="data-table-wrap">
              <SimpleTable
                rowKey="_id"
                dataSource={orders}
                columns={columns}
                pagination={tablePagination}
                className={isKitchenReadOnly ? 'cursor-pointer' : undefined}
              />
            </div>
          )}
            </>
          )}
        </PageTableCard>
      </PageShell>

      {useMobileOrders ? (
        <OrderDetailBottomSheet
          open={Boolean(detail)}
          onOpenChange={(open) => { if (!open) setDetail(null); }}
          detail={detail}
          actions={detail?.order ? buildActions(detail.order) : []}
          isKitchenReadOnly={isKitchenReadOnly}
          kitchenProductType={kitchenProductType}
          visibleItems={visibleDetailItems}
          itemsTotal={detailItemsTotal}
          readonlyBanner={detail?.access?.readonly ? (
            <Badge variant="outline" className="mb-3 border-orange-200 bg-orange-50 text-orange-800">
              Consultation seule — serveur : {orderOwnerLabel(detail.order)}
            </Badge>
          ) : null}
        />
      ) : (
      <Sheet open={Boolean(detail)} onOpenChange={(open) => { if (!open) setDetail(null); }}>
        <SheetContent side="right" className={cn('w-full overflow-y-auto p-0', isMobile ? 'max-w-full' : 'sm:max-w-[520px]')}>
          {detail?.order && (
            <>
              <SheetHeader className="border-b px-4 py-4 pr-12">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <SheetTitle className="flex flex-wrap items-center gap-2 text-base">
                    Commande {detail.order.order_number}
                    {detail.order.daily_code ? (
                      <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-800">
                        Code {detail.order.daily_code}
                      </Badge>
                    ) : null}
                  </SheetTitle>
                  {!isKitchenReadOnly && !detail?.access?.readonly && (
                    <TableActions
                      items={[
                        ...(canEditOrderInPos(detail.order) && canMutateOrder(user, detail.order, 'update')
                          ? [{ key: 'edit', label: 'Modifier', link: `/pos?orderId=${detail.order._id}` }]
                          : []),
                        ...(canCancelUnpaidOrder(user, detail.order)
                          ? [{
                              key: 'cancel',
                              label: 'Annuler',
                              danger: true,
                              onClick: () => requestCancel(detail.order),
                            }]
                          : []),
                        ...(showPayment && canRefundAndCancelOrder(user, detail.order, capabilities)
                          ? [{
                              key: 'refund-cancel',
                              label: 'Rembourser et annuler',
                              danger: true,
                              onClick: () => requestRefundAndCancel(detail.order),
                            }]
                          : []),
                        ...(showPayment && canCheckoutOrder(user, detail.order)
                          ? [{ key: 'checkout', label: 'Encaisser', onClick: () => handleCheckout(detail.order) }]
                          : []),
                        ...(showPayment && canMutateOrder(user, detail.order, 'print') && canReprintReceipt(user)
                          ? [{ key: 'reprint', label: 'Imprimer ticket caisse', onClick: () => reprintTicket(detail.order) }]
                          : []),
                        ...(showKitchenPrint && canMutateOrder(user, detail.order, 'print') && canPrintKitchenOrder(detail.order)
                          ? [{
                              key: 'print-kitchen',
                              label: printingKitchen ? 'Impression…' : 'Imprimer cuisine / bar',
                              onClick: () => printKitchen(detail.order),
                            }]
                          : []),
                      ]}
                    />
                  )}
                </div>
              </SheetHeader>

              <div className="px-4 py-4">
                {detail.access?.readonly && (
                  <Badge variant="outline" className="mb-3 border-orange-200 bg-orange-50 text-orange-800">
                    Consultation seule — serveur : {orderOwnerLabel(detail.order)}
                  </Badge>
                )}
                <dl className="grid grid-cols-1 gap-3 rounded-lg border p-3 sm:grid-cols-2">
                  <DetailItem label="N° commande">
                    <strong>{detail.order.order_number}</strong>
                  </DetailItem>
                  <DetailItem label="Code du jour">
                    {detail.order.daily_code ? (
                      <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-800 text-sm">
                        {detail.order.daily_code}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">— (non envoyée)</span>
                    )}
                  </DetailItem>
                  <DetailItem label="Statut">
                    <StatusBadge status={detail.order.status} />
                  </DetailItem>
                  <DetailItem label="Type">
                    {typeLabels[detail.order.type] || detail.order.type}
                  </DetailItem>
                  <DetailItem label="Table">{detail.order.table?.name || '—'}</DetailItem>
                  <DetailItem label="Serveur">{detail.order.waiter?.fullname || '—'}</DetailItem>
                  <DetailItem label="Total" span={isMobile ? 1 : 2}>
                    {isKitchenReadOnly
                      ? `${detailItemsTotal.toFixed(2)} MAD (${kitchenProductType === 'FOOD' ? 'cuisine' : 'bar'})`
                      : `${detail.order.total?.toFixed(2)} MAD`}
                  </DetailItem>
                  {detail.order.notes && (
                    <DetailItem label="Notes" span={isMobile ? 1 : 2}>
                      {detail.order.notes}
                    </DetailItem>
                  )}
                </dl>
                <Separator className="my-4" />
                {showKitchenPrint && canMutateOrder(user, detail.order, 'print') && canPrintKitchenOrder(detail.order) && (
                  <Button
                    variant="outline"
                    disabled={printingKitchen}
                    onClick={() => printKitchen(detail.order)}
                    className="mb-4"
                  >
                    Imprimer cuisine / bar (commande complète)
                  </Button>
                )}
                <p className="font-semibold">
                  Articles{kitchenProductType ? ` (${kitchenProductType === 'FOOD' ? 'cuisine' : 'bar'})` : ''}
                </p>
                {visibleDetailItems.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Aucun article {kitchenProductType === 'FOOD' ? 'cuisine' : 'bar'} pour cette commande.
                  </p>
                ) : (
                  visibleDetailItems.map((item) => (
                    <div key={item._id} className="mt-3 border-b border-border pb-2">
                      <strong>{item.quantity}× {item.name}</strong>
                      <Badge variant="outline" className="ml-2">{orderItemStatusLabel(item.status)}</Badge>
                      <div className="text-sm text-muted-foreground">{item.line_total?.toFixed(2)} MAD</div>
                      {item.variant?.name && <div className="text-sm text-muted-foreground">{item.variant.name}</div>}
                      {item.modifiers?.length > 0 && (
                        <div className="text-sm text-muted-foreground">{item.modifiers.map((m) => m.name).join(', ')}</div>
                      )}
                      {item.notes && <div className="text-sm italic">{item.notes}</div>}
                      {item.rejection_reason && <div className="text-sm text-red-600">{item.rejection_reason}</div>}
                      {item.cancellation_reason && (
                        <div className="text-sm text-red-700">Retiré : {item.cancellation_reason}</div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
      )}

      <CheckoutModal
        orderId={checkoutOrderId}
        open={Boolean(checkoutOrderId)}
        onClose={() => setCheckoutOrderId(null)}
        onSuccess={() => {
          load();
          if (detail?.order?._id === checkoutOrderId) {
            openDetail(checkoutOrderId);
          }
        }}
      />

      <AppModal
        title={cancelAuth.mode === 'refund' ? 'Validation remboursement (manager+)' : 'Validation annulation (manager+)'}
        open={cancelAuth.open}
        onCancel={() => setCancelAuth({ open: false, order: null, pin: '', submitting: false, mode: 'cancel' })}
        onOk={async () => {
          if (cancelAuth.pin.length !== 6) {
            message.warning('PIN 6 chiffres requis');
            return;
          }
          setCancelAuth((s) => ({ ...s, submitting: true }));
          if (cancelAuth.mode === 'refund') {
            await refundAndCancel(cancelAuth.order, cancelAuth.pin);
          } else {
            await cancelOrder(cancelAuth.order, cancelAuth.pin);
          }
          setCancelAuth({ open: false, order: null, pin: '', submitting: false, mode: 'cancel' });
        }}
        confirmLoading={cancelAuth.submitting}
        okText="Valider"
      >
        <div className="mb-3 text-center text-2xl tracking-[12px]">
          {'•'.repeat(cancelAuth.pin.length).padEnd(6, '○').slice(0, 6)}
        </div>
        <div className="pin-pad">
          {PIN_KEYS.map((k, i) =>
            k === '' ? (
              <span key={i} />
            ) : (
              <Button
                key={`${k}-${i}`}
                size="lg"
                type="button"
                onClick={() => {
                  if (k === 'del') {
                    setCancelAuth((s) => ({ ...s, pin: s.pin.slice(0, -1) }));
                  } else {
                    setCancelAuth((s) => ({ ...s, pin: (s.pin + k).slice(0, 6) }));
                  }
                }}
              >
                {k === 'del' ? <Delete className="size-5" /> : k}
              </Button>
            )
          )}
        </div>
      </AppModal>
    </>
  );
}
