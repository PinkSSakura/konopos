import React from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const SECTION_LABELS = {
  pending: 'En attente',
  preparing: 'En préparation',
  ready: 'Prêt à servir',
};

const SECTION_BADGE = {
  pending: 'border-orange-200 bg-orange-50 text-orange-800',
  preparing: 'border-blue-200 bg-blue-50 text-blue-800',
  ready: 'border-cyan-200 bg-cyan-50 text-cyan-800',
};

const PRODUCT_LABELS = { FOOD: 'Cuisine', DRINK: 'Bar' };

export default function ServiceOrderBottomSheet({
  open,
  onOpenChange,
  group,
  canActOnItem,
  onMarkServed,
  onAccept,
  onReject,
  onMarkReady,
}) {
  const order = group?.order;
  const items = group?.items || [];
  const tableLabel = order?.table?.name ? `Table ${order.table.name}` : 'Sans table';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="order-detail-sheet max-h-[90vh] overflow-y-auto rounded-t-2xl p-0"
      >
        <SheetHeader className="border-b px-4 py-4 pr-12 text-left">
          <SheetTitle className="text-lg">{tableLabel}</SheetTitle>
          <p className="text-sm text-muted-foreground">
            {[order?.order_number, order?.waiter?.fullname].filter(Boolean).join(' · ')}
          </p>
        </SheetHeader>
        <div className="px-4 py-4">
          <ul className="service-order-sheet__items">
            {items.map((item) => {
              const canAct = canActOnItem(item);
              return (
                <li key={item._id} className="service-order-sheet__item">
                  <div className="service-order-sheet__item-info">
                    <span className="service-order-sheet__item-name">
                      {item.quantity}× {item.name}
                    </span>
                    <div className="service-order-sheet__item-tags">
                      <Badge
                        variant="outline"
                        className={cn('shrink-0', SECTION_BADGE[item._section])}
                      >
                        {SECTION_LABELS[item._section]}
                      </Badge>
                      <Badge variant="outline">
                        {PRODUCT_LABELS[item.product_type] || item.product_type}
                      </Badge>
                    </div>
                    {item.notes && (
                      <p className="service-order-sheet__item-note">{item.notes}</p>
                    )}
                    {!canAct && (
                      <Badge variant="secondary" className="mt-2">Lecture seule</Badge>
                    )}
                  </div>
                  {canAct && item._section === 'ready' && (
                    <Button
                      className="service-order-sheet__item-action bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white"
                      onClick={() => onMarkServed(item)}
                    >
                      <Check data-icon="inline-start" />
                      Marquer servi
                    </Button>
                  )}
                  {canAct && item._section === 'pending' && (
                    <div className="service-order-sheet__item-actions">
                      <Button
                        className="service-order-sheet__item-action bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white"
                        onClick={() => onAccept(item)}
                      >
                        Accepter
                      </Button>
                      <Button
                        variant="destructive"
                        className="service-order-sheet__item-action"
                        onClick={() => onReject(item)}
                      >
                        <X data-icon="inline-start" />
                        Rejeter
                      </Button>
                    </div>
                  )}
                  {canAct && item._section === 'preparing' && (
                    <Button
                      className="service-order-sheet__item-action bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white"
                      onClick={() => onMarkReady(item)}
                    >
                      Marquer prêt
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
}
