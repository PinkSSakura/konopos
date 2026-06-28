import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { RefreshCw, Info } from 'lucide-react';
import { message } from '@/lib/toast';
import client from '../../api/client';
import { useSocketEvent } from '../../context/SocketContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import AppModal from '@/components/ui/AppModal';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

const KDS_COLUMNS = [
  { key: 'new', title: 'En attente de validation', badgeClass: 'bg-amber-100 text-amber-800 border-amber-200' },
  { key: 'preparing', title: 'Préparation', badgeClass: 'bg-blue-100 text-blue-800 border-blue-200' },
  { key: 'ready', title: 'Prêt', badgeClass: 'bg-green-100 text-green-800 border-green-200' },
];

const kdsActionBtn = 'min-h-[52px] text-base font-semibold';

export default function KdsPage() {
  const { type } = useParams();
  const productType = type === 'drink' ? 'DRINK' : 'FOOD';
  const title = type === 'drink' ? 'Tableau de bord — Bar' : 'Tableau de bord — Cuisine';

  const [items, setItems] = useState([]);
  const [kitchenAcceptReject, setKitchenAcceptReject] = useState(false);
  const [rejectModal, setRejectModal] = useState({ open: false, item: null, reason: '' });

  const load = useCallback(async () => {
    try {
      const res = await client.get(`/kds/${productType}`);
      setItems(res.data.data.items);
      setKitchenAcceptReject(res.data.data.kitchen_staff_dispatch);
    } catch (err) {
      message.error(err.response?.data?.message || 'Impossible de charger l\'écran cuisine / bar');
    }
  }, [productType]);

  useEffect(() => {
    load();
  }, [load]);

  useSocketEvent('kds:changed', (payload) => {
    if (!payload?.productType || payload.productType === productType) {
      load();
    }
  });

  useSocketEvent('order:changed', load);
  useSocketEvent('service:changed', load);

  const updateStatus = async (itemId, status, rejection_reason) => {
    try {
      await client.patch(`/kds/items/${itemId}`, { status, rejection_reason });
      message.success(status === 'ready' ? 'Article prêt — envoyé au serveur' : 'Mis à jour');
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur');
    }
  };

  const grouped = KDS_COLUMNS.reduce((acc, col) => {
    acc[col.key] = items.filter((i) => i.status === col.key);
    return acc;
  }, {});

  const Ticket = ({ item }) => (
    <Card size="sm" className="mb-2 py-3">
      <CardHeader className="px-3 pb-2">
        <CardTitle className="text-base">
          {item.quantity}× {item.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pt-0">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{item.order?.order_number}</span>
          {item.order?.table?.name && (
            <Badge variant="outline">Table {item.order.table.name}</Badge>
          )}
        </div>
        {item.notes && (
          <p className="mt-1 text-sm italic text-muted-foreground">{item.notes}</p>
        )}
        {kitchenAcceptReject && item.status === 'new' && (
          <div className="mt-3 flex w-full flex-col gap-3">
            <Button className={kdsActionBtn} size="lg" onClick={() => updateStatus(item._id, 'preparing')}>
              Valider
            </Button>
            <Button
              variant="destructive"
              className={kdsActionBtn}
              size="lg"
              onClick={() => setRejectModal({ open: true, item, reason: '' })}
            >
              Rejeter
            </Button>
          </div>
        )}
        {kitchenAcceptReject && item.status === 'preparing' && (
          <Button
            className={cn(kdsActionBtn, 'mt-3 w-full')}
            size="lg"
            onClick={() => updateStatus(item._id, 'ready')}
          >
            Prêt
          </Button>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="m-0 text-xl font-semibold">{title}</h1>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="mr-1 size-4" />
          Actualiser
        </Button>
      </div>

      {!kitchenAcceptReject && (
        <Alert className="mb-4">
          <Info />
          <AlertTitle>Affichage seul</AlertTitle>
          <AlertDescription>
            Les articles apparaissent ici dès l&apos;envoi en cuisine. Le serveur valide, rejette et marque prêt depuis l&apos;écran Service.
          </AlertDescription>
        </Alert>
      )}

      <div className="kds-board grid grid-cols-1 gap-4 lg:grid-cols-3">
        {KDS_COLUMNS.map((col) => (
          <Card key={col.key}>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2 text-base">
                {col.title}
                <Badge variant="outline" className={col.badgeClass}>
                  {grouped[col.key].length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {grouped[col.key].length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun article</p>
              ) : (
                grouped[col.key].map((item) => <Ticket key={item._id} item={item} />)
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <AppModal
        title="Motif de rejet"
        open={rejectModal.open}
        onCancel={() => setRejectModal({ open: false, item: null, reason: '' })}
        onOk={() => {
          if (!rejectModal.reason?.trim()) {
            message.warning('Indiquez un motif de rejet');
            return;
          }
          updateStatus(rejectModal.item._id, 'rejected', rejectModal.reason);
          setRejectModal({ open: false, item: null, reason: '' });
        }}
        okText="Rejeter"
      >
        <Textarea
          rows={3}
          value={rejectModal.reason}
          onChange={(e) => setRejectModal((s) => ({ ...s, reason: e.target.value }))}
          placeholder="Ex: rupture stock, client a changé d'avis…"
        />
      </AppModal>
    </div>
  );
}
