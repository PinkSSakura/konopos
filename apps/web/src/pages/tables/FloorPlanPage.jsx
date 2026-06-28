import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Plus, Merge, Split } from 'lucide-react';
import { message } from '@/lib/toast';
import { InlineLoading } from '../../components/loading/LoadingStates';
import client from '../../api/client';
import CheckoutModal from '../../components/receipt/CheckoutModal';
import Combobox from '../../components/Combobox';
import { useSocketEvent } from '../../context/SocketContext';
import { useEstablishment } from '../../context/EstablishmentContext';
import { useAuth } from '../../context/AuthContext';
import { canMutateOrder, isWaiterRole } from '../../utils/orderOwnership';
import { hasPermission } from '../../utils/permissions';
import { canProcessPayment, canCheckoutOrder } from '../../utils/paymentAccess';
import { openCheckout } from '../../utils/openCheckout';
import { canEditOrderInPos } from '../../utils/orderEditAccess';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
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
import AppModal from '@/components/ui/AppModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

const STATUS_LABELS = {
  libre: 'Libre',
  occupee: 'Occupée',
  reservee: 'Réservée',
  nettoyage: 'Nettoyage',
};

const STATUS_BADGE_CLASS = {
  libre: 'border-green-200 bg-green-50 text-green-800',
  occupee: 'border-red-200 bg-red-50 text-red-800',
  reservee: 'border-amber-200 bg-amber-50 text-amber-800',
  nettoyage: 'border-blue-200 bg-blue-50 text-blue-800',
};

const STATUS_BG = {
  libre: '#f6ffed',
  occupee: '#fff1f0',
  reservee: '#fffbe6',
  nettoyage: '#e6f4ff',
};

const ORDER_STATUS_CLASS = {
  open: '',
  sent: 'border-blue-200 bg-blue-50 text-blue-800',
  preparing: 'border-orange-200 bg-orange-50 text-orange-800',
  ready: 'border-cyan-200 bg-cyan-50 text-cyan-800',
  served: 'border-green-200 bg-green-50 text-green-800',
  paid: 'border-purple-200 bg-purple-50 text-purple-800',
  cancelled: 'border-red-200 bg-red-50 text-red-800',
};

const ACTIVE_ORDER_STATUSES = ['open', 'sent', 'preparing', 'ready', 'served'];

export default function FloorPlanPage() {
  const navigate = useNavigate();
  const { tablesEnabled, establishment } = useEstablishment();
  const { user, isPinSession } = useAuth();
  const showPayment = canProcessPayment(user);

  const startCheckout = (orderId) => {
    openCheckout({
      orderId,
      navigate,
      user,
      isPinSession,
      establishment,
      openModal: setCheckoutOrderId,
      returnTo: '/tables',
    });
  };

  const canManageTableLayout = (table) => {
    if (!table) return true;
    if (!isWaiterRole(user)) return true;
    if (hasPermission(user, 'table_manage_all')) return true;
    if (!table.current_order) return true;
    return table.order_is_own !== false;
  };
  const [rooms, setRooms] = useState([]);
  const [roomId, setRoomId] = useState(null);
  const [tables, setTables] = useState([]);
  const [dragging, setDragging] = useState(null);
  const [drawerTable, setDrawerTable] = useState(null);
  const [tableOrders, setTableOrders] = useState([]);
  const [orderDetails, setOrderDetails] = useState({});
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [checkoutOrderId, setCheckoutOrderId] = useState(null);
  const [deleteConfirmTable, setDeleteConfirmTable] = useState(null);
  const [roomDialog, setRoomDialog] = useState(null);
  const [roomNameInput, setRoomNameInput] = useState('');
  const [mergeMode, setMergeMode] = useState(false);
  const [mergeSelection, setMergeSelection] = useState([]);
  const [mergeOrdersOpen, setMergeOrdersOpen] = useState(false);
  const [mergeTargetOrderId, setMergeTargetOrderId] = useState(null);
  const [mergeSubmitting, setMergeSubmitting] = useState(false);
  const canMergeTables = hasPermission(user, 'table_merge');
  const canSplitTables = hasPermission(user, 'table_split');

  const getMergePeers = useCallback((table) => {
    if (!table?.merge_group_id) return [];
    return tables.filter((row) => row.merge_group_id === table.merge_group_id);
  }, [tables]);

  const toggleMergeSelection = useCallback((table) => {
    if (!table) return;
    setMergeSelection((prev) => {
      const id = table._id;
      if (prev.includes(id)) return prev.filter((rowId) => rowId !== id);
      if (prev.length > 0) {
        const first = tablesRef.current.find((row) => row._id === prev[0]);
        const firstRoom = String(first?.room?._id || first?.room || '');
        const nextRoom = String(table.room?._id || table.room || '');
        if (firstRoom && nextRoom && firstRoom !== nextRoom) {
          message.warning('Sélectionnez des tables dans la même salle.');
          return prev;
        }
      }
      return [...prev, id];
    });
  }, []);

  const submitMergeTables = async () => {
    if (mergeSelection.length < 2) {
      message.warning('Sélectionnez au moins 2 tables.');
      return;
    }
    try {
      await client.post('/tables/merge', { table_ids: mergeSelection });
      message.success('Tables fusionnées');
      setMergeMode(false);
      setMergeSelection([]);
      await loadTables();
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur fusion tables');
    }
  };

  const splitTableGroup = async (table) => {
    if (!table?.merge_group_id) return;
    try {
      await client.post(`/tables/${table._id}/split`);
      message.success('Tables séparées');
      const updated = await loadTables();
      if (drawerTable) {
        const fresh = updated?.find((row) => row._id === drawerTable._id);
        if (fresh) setDrawerTable(fresh);
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur séparation tables');
    }
  };

  const openMergeOrdersModal = () => {
    if (tableOrders.length < 2) return;
    setMergeTargetOrderId(tableOrders[0]?._id || null);
    setMergeOrdersOpen(true);
  };

  const submitMergeOrders = async () => {
    if (!mergeTargetOrderId || tableOrders.length < 2) return;
    setMergeSubmitting(true);
    try {
      await client.post('/tables/orders/merge', {
        order_ids: tableOrders.map((order) => order._id),
        target_order_id: mergeTargetOrderId,
      });
      message.success('Commandes fusionnées');
      setMergeOrdersOpen(false);
      if (drawerTable) {
        await loadTableOrders(drawerTable);
      }
      await loadTables();
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur fusion commandes');
    } finally {
      setMergeSubmitting(false);
    }
  };

  const offset = useRef({ x: 0, y: 0 });
  const moved = useRef(false);
  const dragPositionRef = useRef({ x: 0, y: 0 });
  const tablesRef = useRef(tables);

  useEffect(() => {
    tablesRef.current = tables;
  }, [tables]);

  const loadRooms = async () => {
    const res = await client.get('/rooms');
    setRooms(res.data.data);
    if (!roomId && res.data.data[0]) setRoomId(res.data.data[0]._id);
  };

  const loadTables = async () => {
    if (!roomId) return;
    const res = await client.get('/tables', { params: { room: roomId } });
    setTables(res.data.data);
    return res.data.data;
  };

  const loadTableOrders = useCallback(async (tableOrId) => {
    const table = typeof tableOrId === 'object'
      ? tableOrId
      : tablesRef.current.find((row) => row._id === tableOrId);
    const tableId = table?._id || tableOrId;
    setOrdersLoading(true);
    try {
      let active = [];
      if (table?.current_order) {
        const detailRes = await client.get(`/orders/${table.current_order}`);
        const order = detailRes.data.data;
        if (ACTIVE_ORDER_STATUSES.includes(order.status)) {
          active = [order];
        }
      } else {
        const res = await client.get('/orders', { params: { table: tableId } });
        active = res.data.data.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status));
      }
      setTableOrders(active);

      const details = {};
      await Promise.all(
        active.map(async (order) => {
          const detailRes = await client.get(`/orders/${order._id}`);
          details[order._id] = detailRes.data.data;
        })
      );
      setOrderDetails(details);
    } catch {
      message.error('Erreur chargement commandes');
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  const openTableDrawer = async (table) => {
    setDrawerTable(table);
    await loadTableOrders(table);
  };

  const closeDrawer = () => {
    setDrawerTable(null);
    setTableOrders([]);
    setOrderDetails({});
  };

  useEffect(() => {
    loadRooms().catch(() => message.error('Erreur salles'));
  }, []);

  useEffect(() => {
    loadTables().catch(() => message.error('Erreur tables'));
  }, [roomId]);

  useSocketEvent('tables:changed', (payload) => {
    if (!payload?.roomId || payload.roomId === roomId) {
      loadTables().then((updated) => {
        if (drawerTable) {
          const fresh = updated?.find((t) => t._id === drawerTable._id);
          if (fresh) setDrawerTable(fresh);
        }
      });
    }
  });

  useSocketEvent('order:changed', () => {
    if (drawerTable) {
      loadTableOrders(drawerTable);
    }
  });

  const currentRoom = rooms.find((r) => r._id === roomId);

  const onMouseDown = (e, table) => {
    if (e.button !== 0) return;
    if (mergeMode) return;
    e.preventDefault();
    moved.current = false;
    setDragging(table._id);
    offset.current = {
      x: e.clientX - (table.position?.x || 0),
      y: e.clientY - (table.position?.y || 0),
    };
  };

  useEffect(() => {
    if (!dragging) return undefined;
    const onMove = (e) => {
      moved.current = true;
      const x = Math.max(0, e.clientX - offset.current.x);
      const y = Math.max(0, e.clientY - offset.current.y);
      dragPositionRef.current = { x, y };
      setTables((prev) =>
        prev.map((t) => (t._id === dragging ? { ...t, position: { ...t.position, x, y } } : t))
      );
    };
    const onUp = async (e) => {
      if (e.button !== 0) return;
      const tableId = dragging;
      const table = tablesRef.current.find((t) => t._id === tableId);
      if (table && moved.current) {
        const position = {
          ...table.position,
          ...dragPositionRef.current,
        };
        try {
          await client.put(`/tables/${table._id}`, { position });
        } catch (err) {
          message.error(err.response?.data?.message || 'Erreur déplacement');
          await loadTables();
        }
      } else if (table && !moved.current) {
        openTableDrawer(table);
      }
      setDragging(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging]);

  const addRoom = () => {
    setRoomNameInput('');
    setRoomDialog({ mode: 'create' });
  };

  const renameRoom = () => {
    if (!currentRoom) return;
    setRoomNameInput(currentRoom.name || '');
    setRoomDialog({ mode: 'rename', room: currentRoom });
  };

  const deleteRoom = async () => {
    if (!currentRoom) return;
    try {
      await client.delete(`/rooms/${currentRoom._id}`);
      message.success('Salle supprimée');
      setRoomId(null);
      await loadRooms();
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur suppression salle');
    }
  };

  const submitRoomDialog = async () => {
    const name = roomNameInput.trim();
    if (!name) {
      message.warning('Nom de salle requis');
      return;
    }
    try {
      if (roomDialog?.mode === 'create') {
        const res = await client.post('/rooms', { name });
        message.success('Salle créée');
        await loadRooms();
        if (res.data.data?._id) setRoomId(res.data.data._id);
      } else if (roomDialog?.mode === 'rename' && roomDialog.room) {
        await client.put(`/rooms/${roomDialog.room._id}`, { name });
        message.success('Salle renommée');
        await loadRooms();
      }
      setRoomDialog(null);
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur salle');
    }
  };

  const changeStatusFor = async (table, status) => {
    if (!table) return;
    try {
      await client.patch(`/tables/${table._id}/status`, { status });
      message.success(`Table : ${STATUS_LABELS[status]}`);
      const updated = await loadTables();
      const fresh = updated?.find((t) => t._id === table._id);
      if (fresh && drawerTable?._id === table._id) {
        setDrawerTable(fresh);
        if (status === 'occupee') {
          await loadTableOrders(fresh);
        } else {
          setTableOrders([]);
          setOrderDetails({});
        }
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur');
    }
  };

  const changeStatus = async (status) => {
    if (!drawerTable) return;
    await changeStatusFor(drawerTable, status);
  };

  const renameTableFor = async (table) => {
    if (!table) return;
    const newName = prompt('Nouveau nom de la table :', table.name || '');
    if (!newName) return;
    try {
      await client.put(`/tables/${table._id}`, { name: newName.trim() });
      message.success('Nom de table mis à jour');
      const updated = await loadTables();
      const fresh = updated?.find((t) => t._id === table._id);
      if (fresh && drawerTable?._id === table._id) setDrawerTable(fresh);
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur renommage');
    }
  };

  const renameTable = async () => {
    if (!drawerTable) return;
    await renameTableFor(drawerTable);
  };

  const removeTableFor = async (table) => {
    if (!table) return;
    try {
      await client.delete(`/tables/${table._id}`);
      message.success('Table supprimée');
      if (drawerTable?._id === table._id) closeDrawer();
      await loadTables();
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur suppression');
    } finally {
      setDeleteConfirmTable(null);
    }
  };

  const removeTable = async () => {
    if (!drawerTable) return;
    setDeleteConfirmTable(drawerTable);
  };

  if (!tablesEnabled) {
    return <Navigate to="/pos" replace />;
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle>Plan de salle</CardTitle>
          <div className="floor-plan-card-extra flex flex-wrap items-center gap-2">
            <Combobox
              options={rooms.map((r) => ({ value: r._id, label: r.name }))}
              value={roomId}
              onValueChange={setRoomId}
              placeholder="Salle"
              className="w-[180px]"
            />
            <Button variant="outline" onClick={addRoom}>Nouvelle salle</Button>
            {currentRoom && (
              <>
                <Button variant="outline" onClick={renameRoom}>Renommer salle</Button>
                <Button variant="destructive" onClick={deleteRoom}>Supprimer salle</Button>
              </>
            )}
            <Link to={roomId ? `/tables/new?room=${roomId}` : '#'}>
              <Button disabled={!roomId}>
                <Plus className="mr-1 size-4" />
                Table
              </Button>
            </Link>
            {canMergeTables && (
              <Button
                variant={mergeMode ? 'default' : 'outline'}
                onClick={() => {
                  setMergeMode((active) => !active);
                  setMergeSelection([]);
                }}
              >
                <Merge className="size-4" data-icon="inline-start" />
                {mergeMode ? 'Mode fusion' : 'Fusionner'}
              </Button>
            )}
            {mergeMode && (
              <>
                <Button
                  disabled={mergeSelection.length < 2}
                  onClick={submitMergeTables}
                >
                  Valider ({mergeSelection.length})
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setMergeMode(false);
                    setMergeSelection([]);
                  }}
                >
                  Annuler
                </Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            {mergeMode
              ? 'Mode fusion : cliquez les tables à regrouper (même salle), puis Valider. La table avec commande devient principale.'
              : 'Clic droit pour actions · Glissez pour déplacer · Cliquez pour voir les commandes'}
          </p>
          <div className="floor-plan-scroll">
            <div
              style={{
                position: 'relative',
                width: currentRoom?.layout_width || 800,
                maxWidth: '100%',
                height: currentRoom?.layout_height || 600,
                background: '#fff',
                border: '2px solid #d1d5db',
                borderRadius: 8,
                margin: '0 auto',
              }}
            >
              {tables.map((t) => {
                const isSelected = mergeSelection.includes(t._id);
                const mergePeers = getMergePeers(t);
                const isMerged = mergePeers.length > 1;
                const mergeNames = isMerged ? mergePeers.map((row) => row.name).join(' + ') : null;
                return (
                <ContextMenu key={t._id}>
                  <ContextMenuTrigger asChild>
                    <div
                      role="button"
                      tabIndex={0}
                      onMouseDown={(e) => onMouseDown(e, t)}
                      onClick={(e) => {
                        if (!mergeMode || !canMergeTables) return;
                        e.stopPropagation();
                        toggleMergeSelection(t);
                      }}
                      style={{
                        position: 'absolute',
                        left: t.position?.x ?? 0,
                        top: t.position?.y ?? 0,
                        width: t.position?.width ?? 100,
                        height: t.position?.height ?? 60,
                        background: STATUS_BG[t.status] || '#f6ffed',
                        border: isSelected
                          ? '3px solid var(--brand-primary, #c2462d)'
                          : isMerged
                            ? '2px dashed #6366f1'
                            : drawerTable?._id === t._id
                              ? '2px solid #c2462d'
                              : '2px solid #333',
                        borderRadius: 4,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        userSelect: 'none',
                        overflow: 'hidden',
                      }}
                    >
                      <strong>{t.name}</strong>
                      {isMerged && (
                        <Badge className="mt-0.5 border-indigo-200 bg-indigo-50 text-[10px] text-indigo-800 hover:bg-indigo-50">
                          {t.is_merge_primary ? 'Principale' : 'Fusion'} · {mergeNames}
                        </Badge>
                      )}
                      <Badge variant="outline" className={cn('mt-0.5', STATUS_BADGE_CLASS[t.status])}>
                        {STATUS_LABELS[t.status] || t.status}
                      </Badge>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    {t.merge_group_id && canSplitTables && canManageTableLayout(t) && (
                      <ContextMenuItem onSelect={() => splitTableGroup(t)}>
                        <Split className="size-4" data-icon="inline-start" />
                        Séparer le groupe
                      </ContextMenuItem>
                    )}
                    {t.merge_group_id && canSplitTables && canManageTableLayout(t) && (
                      <ContextMenuSeparator />
                    )}
                    {canManageTableLayout(t) && (
                      <ContextMenuItem onSelect={() => renameTableFor(t)}>Renommer</ContextMenuItem>
                    )}
                    {canManageTableLayout(t) && (
                      <ContextMenuItem variant="destructive" onSelect={() => setDeleteConfirmTable(t)}>
                        Supprimer
                      </ContextMenuItem>
                    )}
                    {canManageTableLayout(t) && (
                      <>
                        <ContextMenuSeparator />
                        <ContextMenuLabel>Statut</ContextMenuLabel>
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                          <ContextMenuItem
                            key={value}
                            onSelect={() => changeStatusFor(t, value)}
                          >
                            {t.status === value ? '✓ ' : ''}{label}
                          </ContextMenuItem>
                        ))}
                      </>
                    )}
                  </ContextMenuContent>
                </ContextMenu>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Sheet open={Boolean(drawerTable)} onOpenChange={(open) => { if (!open) closeDrawer(); }}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
          {drawerTable && (
            <>
              <SheetHeader className="border-b border-border px-4 py-4 pr-12">
                <SheetTitle className="flex flex-col gap-1 text-lg">
                  <span className="flex items-center gap-2">
                    Table {drawerTable.name}
                    <Badge variant="outline" className={STATUS_BADGE_CLASS[drawerTable.status]}>
                      {STATUS_LABELS[drawerTable.status] || drawerTable.status}
                    </Badge>
                  </span>
                  {getMergePeers(drawerTable).length > 1 && (
                    <span className="text-sm font-normal text-muted-foreground">
                      Groupe fusionné : {getMergePeers(drawerTable).map((row) => row.name).join(', ')}
                      {drawerTable.is_merge_primary ? ' (principale)' : ''}
                    </span>
                  )}
                </SheetTitle>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto px-4 py-4">
                <div className="flex w-full flex-col gap-4">
                  <div className="flex flex-wrap gap-2">
                    {canMergeTables && tableOrders.length >= 2 && canManageTableLayout(drawerTable) && (
                      <Button variant="outline" onClick={openMergeOrdersModal}>
                        <Merge className="size-4" data-icon="inline-start" />
                        Fusionner commandes
                      </Button>
                    )}
                    {drawerTable.merge_group_id && canSplitTables && canManageTableLayout(drawerTable) && (
                      <Button variant="outline" onClick={() => splitTableGroup(drawerTable)}>
                        <Split className="size-4" data-icon="inline-start" />
                        Séparer tables
                      </Button>
                    )}
                    {canManageTableLayout(drawerTable) && (
                      <Button variant="outline" onClick={renameTable}>Renommer</Button>
                    )}
                    {canManageTableLayout(drawerTable) && (
                      <Button variant="destructive" onClick={removeTable}>
                        Supprimer
                      </Button>
                    )}
                  </div>

                  {canManageTableLayout(drawerTable) && (
                    <div>
                      <p className="text-sm text-muted-foreground">Statut</p>
                      <ToggleGroup
                        type="single"
                        size="sm"
                        value={drawerTable.status}
                        onValueChange={(value) => value && changeStatus(value)}
                        className="mt-2 flex flex-wrap"
                      >
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                          <ToggleGroupItem key={value} value={value}>
                            {label}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                    </div>
                  )}

                  <Separator />

                  <h3 className="m-0 text-base font-semibold">Commandes en cours</h3>

                  {ordersLoading ? (
                    <InlineLoading label="Chargement des commandes…" />
                  ) : tableOrders.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucune commande active pour cette table.</p>
                  ) : (
                    <ul className="divide-y rounded-lg border">
                      {tableOrders.map((order) => {
                        const detail = orderDetails[order._id];
                        return (
                          <li key={order._id} className="px-3 py-3">
                            <div className="flex w-full items-center justify-between gap-2">
                              <span className="font-semibold">{order.order_number}</span>
                              <Badge variant="outline" className={ORDER_STATUS_CLASS[order.status]}>
                                {order.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{order.type}</p>
                            <p className="font-semibold">{order.total?.toFixed(2)} MAD</p>
                            {detail?.items?.length > 0 && (
                              <ul className="mt-2 space-y-1 text-sm">
                                {detail.items.filter((i) => i.status !== 'cancelled').map((item) => (
                                  <li key={item._id}>
                                    {item.quantity}× {item.name}
                                    <Badge variant="outline" className="ml-2">{item.status}</Badge>
                                  </li>
                                ))}
                              </ul>
                            )}
                            <div className="mt-2 flex flex-wrap gap-2">
                              {canEditOrderInPos(order) && canMutateOrder(user, order, 'update') && (
                                <Link to={`/pos?orderId=${order._id}`}>
                                  <Button size="sm" variant="outline">Modifier</Button>
                                </Link>
                              )}
                              {showPayment && canCheckoutOrder(user, order) && (
                                <Button
                                  size="sm"
                                  onClick={() => startCheckout(order._id)}
                                >
                                  Encaisser
                                </Button>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <CheckoutModal
        orderId={checkoutOrderId}
        open={Boolean(checkoutOrderId)}
        onClose={() => setCheckoutOrderId(null)}
        onSuccess={() => {
          if (drawerTable) loadTableOrders(drawerTable);
          loadTables();
        }}
      />

      <AlertDialog open={Boolean(deleteConfirmTable)} onOpenChange={(open) => { if (!open) setDeleteConfirmTable(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la table</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirmTable
                ? `Supprimer la table « ${deleteConfirmTable.name} » ? Cette action est irréversible.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => removeTableFor(deleteConfirmTable)}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AppModal
        title="Fusionner les commandes"
        open={mergeOrdersOpen}
        onCancel={() => setMergeOrdersOpen(false)}
        onOk={submitMergeOrders}
        okText="Fusionner"
        confirmLoading={mergeSubmitting}
      >
        <p className="mb-3 text-sm text-muted-foreground">
          Choisissez la commande à conserver. Les autres seront annulées et leurs articles déplacés.
        </p>
        <div className="space-y-2">
          {tableOrders.map((order) => (
            <label
              key={order._id}
              className={cn(
                'flex cursor-pointer items-center justify-between rounded-lg border p-3',
                mergeTargetOrderId === order._id && 'border-[var(--brand-primary)] bg-muted/40',
              )}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="merge-target-order"
                  checked={mergeTargetOrderId === order._id}
                  onChange={() => setMergeTargetOrderId(order._id)}
                />
                <span className="font-medium">{order.order_number}</span>
              </span>
              <span className="text-sm text-muted-foreground">
                {order.total?.toFixed(2)} MAD
              </span>
            </label>
          ))}
        </div>
      </AppModal>

      <AppModal
        title={roomDialog?.mode === 'rename' ? 'Renommer la salle' : 'Nouvelle salle'}
        open={Boolean(roomDialog)}
        onCancel={() => setRoomDialog(null)}
        onOk={submitRoomDialog}
        okText={roomDialog?.mode === 'rename' ? 'Enregistrer' : 'Créer'}
      >
        <Input
          value={roomNameInput}
          onChange={(e) => setRoomNameInput(e.target.value)}
          placeholder="Nom de la salle"
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitRoomDialog();
          }}
        />
      </AppModal>
    </>
  );
}
