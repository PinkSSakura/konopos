import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Filter, Loader2, RefreshCw, X } from 'lucide-react';
import { message } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Empty, EmptyDescription } from '@/components/ui/empty';
import { Separator } from '@/components/ui/separator';
import { Modal } from '@/components/ui/AppModal';
import { Textarea } from '@/components/ui/textarea';
import client from '../../api/client';
import { useSocketEvent } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { canMutateOrder } from '../../utils/orderOwnership';
import { useEstablishment } from '../../context/EstablishmentContext';
import { canOverrideKitchenStaffDispatch } from '../../utils/kdsaccess';
import useIsMobile from '../../hooks/useIsMobile';
import ServiceMobileCardList, { groupServiceItemsByOrder } from '../../components/service/ServiceMobileCardList';
import ServiceOrderBottomSheet from '../../components/service/ServiceOrderBottomSheet';
import ServiceFilterSheet from '../../components/service/ServiceFilterSheet';
import { TableLoading } from '../../components/loading/LoadingStates';
import '../../styles/service-page.css';

const typeLabels = {
  FOOD: 'Cuisine',
  DRINK: 'Bar',
};

function ServiceItemTile({ item, canAct, renderActions }) {
  return (
    <article
      className={`service-item-tile service-item-tile--${item.product_type === 'DRINK' ? 'drink' : 'food'}`}
    >
      <p className="service-item-tile__qty-name">{item.quantity}× {item.name}</p>
      <p className="service-item-tile__order text-sm text-muted-foreground">
        {item.order?.order_number}
      </p>
      <div className="service-item-tile__tags">
        <Badge className="border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-50">
          {item.order?.table?.name ? `Table ${item.order.table.name}` : 'Sans table'}
        </Badge>
        {item.order?.waiter?.fullname && <Badge variant="outline">{item.order.waiter.fullname}</Badge>}
        {item.order?.daily_code != null && (
          <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50">
            Code {String(item.order.daily_code).padStart(4, '0')}
          </Badge>
        )}
        <Badge
          className={
            item.product_type === 'DRINK'
              ? 'border-purple-200 bg-purple-50 text-purple-800 hover:bg-purple-50'
              : 'border-orange-200 bg-orange-50 text-orange-800 hover:bg-orange-50'
          }
        >
          {typeLabels[item.product_type] || item.product_type}
        </Badge>
        {!canAct && <Badge variant="secondary">Lecture seule</Badge>}
      </div>
      {item.notes && <p className="service-item-tile__note">{item.notes}</p>}
      {renderActions ? (
        <div className="service-item-tile__actions">{renderActions(item)}</div>
      ) : null}
    </article>
  );
}

function itemMatchesSearch(item, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  return [
    item.name,
    item.order?.order_number,
    item.order?.table?.name,
    item.order?.waiter?.fullname,
  ].some((v) => String(v || '').toLowerCase().includes(q));
}

export default function ServicePage() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { kitchenStaffDispatch: kitchenBarModeEnabled, establishment } = useEstablishment();
  const roleKey = user?.role?.role_key;
  const superadminOverride = canOverrideKitchenStaffDispatch(roleKey);
  const waiterServeOnly = Boolean(
    establishment?.waiter_service_served_only && roleKey === 'waiter',
  );
  const serviceReadyOnSend = Boolean(establishment?.service_ready_on_send);

  const [readyItems, setReadyItems] = useState([]);
  const [pendingItems, setPendingItems] = useState([]);
  const [preparingItems, setPreparingItems] = useState([]);
  const [kitchenStaffDispatch, setKitchenStaffDispatch] = useState(true);
  const [loading, setLoading] = useState(false);
  const [rejectModal, setRejectModal] = useState({ open: false, item: null, reason: '' });
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [sectionFilter, setSectionFilter] = useState(null);
  const [readyOnlyDefault, setReadyOnlyDefault] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState(null);

  const hideDispatchSections = kitchenStaffDispatch || waiterServeOnly || serviceReadyOnSend;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [readyRes, pendingRes, preparingRes] = await Promise.all([
        client.get('/service/ready'),
        client.get('/service/pending'),
        client.get('/service/preparing'),
      ]);
      setReadyItems(readyRes.data.data);
      setPendingItems(pendingRes.data.data.items);
      setPreparingItems(preparingRes.data.data.items);
      setKitchenStaffDispatch(pendingRes.data.data.kitchen_staff_dispatch);
    } catch {
      message.error('Erreur chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useSocketEvent('service:changed', load);
  useSocketEvent('order:changed', load);
  useSocketEvent('kds:changed', load);

  const updateItem = async (item, payload, successMsg) => {
    try {
      await client.put(`/orders/${item.order._id}/items/${item._id}`, payload);
      message.success(successMsg);
      load();
      return true;
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur');
      return false;
    }
  };

  const removeItemFromGroup = (itemId) => {
    setSelectedGroup((prev) => {
      if (!prev) return null;
      const items = prev.items.filter((i) => i._id !== itemId);
      return items.length ? { ...prev, items } : null;
    });
  };

  const markServed = async (item) => {
    const ok = await updateItem(item, { status: 'served' }, 'Article servi');
    if (ok) removeItemFromGroup(item._id);
  };
  const acceptItem = async (item) => {
    const ok = await updateItem(item, { status: 'preparing' }, 'Envoyé en préparation');
    if (ok) {
      setSelectedGroup((prev) => {
        if (!prev) return null;
        const items = prev.items.map((i) => (
          i._id === item._id ? { ...i, _section: 'preparing' } : i
        ));
        return { ...prev, items };
      });
    }
  };
  const markReady = async (item) => {
    const ok = await updateItem(item, { status: 'ready' }, 'Article prêt');
    if (ok) {
      setSelectedGroup((prev) => {
        if (!prev) return null;
        const items = prev.items.map((i) => (
          i._id === item._id ? { ...i, _section: 'ready' } : i
        ));
        return { ...prev, items };
      });
    }
  };
  const rejectItem = async (item, reason) => {
    const ok = await updateItem(item, { status: 'rejected', rejection_reason: reason }, 'Article rejeté');
    if (ok) removeItemFromGroup(item._id);
  };

  const canActOnItem = (item) => canMutateOrder(user, item.order, 'mark_served');

  const allMobileItems = useMemo(() => {
    const tag = (list, section) => list.map((item) => ({ ...item, _section: section }));
    let items = [];
    if (!hideDispatchSections) {
      items = [...tag(pendingItems, 'pending'), ...tag(preparingItems, 'preparing')];
    }
    return [...items, ...tag(readyItems, 'ready')];
  }, [readyItems, pendingItems, preparingItems, hideDispatchSections]);

  const displayMobileItems = useMemo(() => {
    let list = allMobileItems;
    if (readyOnlyDefault && !sectionFilter && hideDispatchSections) {
      list = list.filter((i) => i._section === 'ready');
    } else if (sectionFilter) {
      list = list.filter((i) => i._section === sectionFilter);
    }
    if (search.trim()) {
      list = list.filter((i) => itemMatchesSearch(i, search.trim()));
    }
    return list;
  }, [allMobileItems, readyOnlyDefault, sectionFilter, search, hideDispatchSections]);

  const hasActiveFilters = Boolean(search.trim() || sectionFilter || !readyOnlyDefault);

  const renderItemStrip = (list, renderActions) => {
    const groups = groupServiceItemsByOrder(list);
    return (
      <div className="service-section-panel">
        {groups.map(({ order, items: groupItems }) => {
          const groupKey = order?._id || groupItems.map((i) => i._id).join('-');
          return (
            <div key={groupKey} className="service-order-group">
              <div className="service-order-group__head">
                <strong>
                  {order?.table?.name ? `Table ${order.table.name}` : 'Sans table'}
                </strong>
                <span>{order?.order_number}</span>
                {order?.waiter?.fullname && <span>{order.waiter.fullname}</span>}
                {order?.daily_code != null && (
                  <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50">
                    Code {String(order.daily_code).padStart(4, '0')}
                  </Badge>
                )}
              </div>
              <div className="service-items-strip">
                {groupItems.map((item) => (
                  <ServiceItemTile
                    key={item._id}
                    item={item}
                    canAct={canActOnItem(item)}
                    renderActions={canActOnItem(item) ? renderActions : null}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (isMobile) {
    return (
      <div className="service-page">
        <div className="service-page__header">
          <div>
            <h3 className="m-0 text-xl font-semibold">Service</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Touchez une commande pour servir les articles.
            </p>
          </div>
        </div>

        <div className="orders-mobile-toolbar">
          {hideDispatchSections && (
            <Button
              variant={readyOnlyDefault && !sectionFilter ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => {
                setReadyOnlyDefault((v) => !v);
                if (readyOnlyDefault) setSectionFilter(null);
              }}
            >
              {readyOnlyDefault && !sectionFilter ? 'À servir' : 'Tout'}
            </Button>
          )}
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

        {loading && displayMobileItems.length === 0 ? (
          <TableLoading rows={4} columns={1} />
        ) : (
          <ServiceMobileCardList
            items={displayMobileItems}
            onSelectGroup={setSelectedGroup}
          />
        )}

        <ServiceFilterSheet
          open={filterSheetOpen}
          onOpenChange={setFilterSheetOpen}
          search={search}
          onSearchChange={setSearch}
          sectionFilter={sectionFilter}
          onSectionFilterChange={(v) => {
            setSectionFilter(v);
            if (v) setReadyOnlyDefault(false);
          }}
          showSectionFilter={!hideDispatchSections}
          onReset={() => {
            setSearch('');
            setSectionFilter(null);
            setReadyOnlyDefault(true);
          }}
        />

        <ServiceOrderBottomSheet
          open={Boolean(selectedGroup)}
          onOpenChange={(open) => { if (!open) setSelectedGroup(null); }}
          group={selectedGroup}
          canActOnItem={canActOnItem}
          onMarkServed={markServed}
          onAccept={acceptItem}
          onReject={(item) => setRejectModal({ open: true, item, reason: '' })}
          onMarkReady={markReady}
        />

        <Modal
          title="Motif de rejet"
          open={rejectModal.open}
          onOk={() => {
            rejectItem(rejectModal.item, rejectModal.reason);
            setRejectModal({ open: false, item: null, reason: '' });
          }}
          onCancel={() => setRejectModal({ open: false, item: null, reason: '' })}
        >
          <Textarea
            rows={3}
            value={rejectModal.reason}
            onChange={(e) => setRejectModal((s) => ({ ...s, reason: e.target.value }))}
            placeholder="Ex: client a changé d'avis…"
          />
        </Modal>
      </div>
    );
  }

  return (
    <div className="service-page">
      <div className="service-page__header">
        <h3 className="m-0 text-xl font-semibold">Service</h3>
        <Button variant="outline" disabled={loading} onClick={load}>
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          Actualiser
        </Button>
      </div>

      {!hideDispatchSections && (
        <>
          {superadminOverride && kitchenBarModeEnabled && (
            <p className="mb-4 text-sm text-muted-foreground">
              Mode cuisine / bar activé — en tant que super admin vous pouvez aussi valider, rejeter et marquer prêt ici.
            </p>
          )}
          <h4 className="text-lg font-medium">
            En attente de validation
            <Badge className="ml-2 border-orange-200 bg-orange-50 text-orange-800 hover:bg-orange-50">
              {pendingItems.length}
            </Badge>
          </h4>
          {pendingItems.length === 0 ? (
            <Card className="service-empty-card">
              <Empty>
                <EmptyDescription>Aucun article en attente</EmptyDescription>
              </Empty>
            </Card>
          ) : (
            renderItemStrip(pendingItems, (item) => (
              <>
                <Button className="w-full" onClick={() => acceptItem(item)}>
                  Accepter
                </Button>
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => setRejectModal({ open: true, item, reason: '' })}
                >
                  <X data-icon="inline-start" />
                  Rejeter
                </Button>
              </>
            ))
          )}

          <h4 className="text-lg font-medium">
            En préparation
            <Badge className="ml-2 border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-50">
              {preparingItems.length}
            </Badge>
          </h4>
          {preparingItems.length === 0 ? (
            <Card className="service-empty-card">
              <Empty>
                <EmptyDescription>Aucun article en préparation</EmptyDescription>
              </Empty>
            </Card>
          ) : (
            renderItemStrip(preparingItems, (item) => (
              <Button className="w-full" onClick={() => markReady(item)}>
                Prêt
              </Button>
            ))
          )}
          <Separator />
        </>
      )}

      {waiterServeOnly && (
        <p className="mb-4 text-sm text-muted-foreground">
          Mode serveur : marquez uniquement les articles prêts comme servis. Validation et préparation se font en cuisine / bar ou sur Commandes.
        </p>
      )}

      {serviceReadyOnSend && !waiterServeOnly && (
        <p className="mb-4 text-sm text-muted-foreground">
          Les articles passent directement en « prêt à servir » à l&apos;envoi. Marquez-les servis ci-dessous.
        </p>
      )}

      <h4 className="text-lg font-medium">
        À servir
        <Badge className="ml-2 border-cyan-200 bg-cyan-50 text-cyan-800 hover:bg-cyan-50">
          {readyItems.length}
        </Badge>
      </h4>
      {readyItems.length === 0 ? (
        <Card className="service-empty-card">
          <Empty>
            <EmptyDescription>Aucun article prêt à servir</EmptyDescription>
          </Empty>
        </Card>
      ) : (
        renderItemStrip(readyItems, (item) => (
          <Button className="w-full" onClick={() => markServed(item)}>
            <Check data-icon="inline-start" />
            Servi
          </Button>
        ))
      )}

      <Modal
        title="Motif de rejet"
        open={rejectModal.open}
        onOk={() => {
          rejectItem(rejectModal.item, rejectModal.reason);
          setRejectModal({ open: false, item: null, reason: '' });
        }}
        onCancel={() => setRejectModal({ open: false, item: null, reason: '' })}
      >
        <Textarea
          rows={3}
          value={rejectModal.reason}
          onChange={(e) => setRejectModal((s) => ({ ...s, reason: e.target.value }))}
          placeholder="Ex: client a changé d'avis…"
        />
      </Modal>
    </div>
  );
}
