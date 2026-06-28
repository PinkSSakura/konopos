import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { orderStatusLabel, orderItemStatusLabel } from '../../utils/orderStatusLabels';

const typeLabels = {
  dine_in: 'Sur place',
  takeaway: 'À emporter',
  delivery: 'Livraison',
};

const ACTION_VARIANT = {
  checkout: 'default',
  edit: 'outline',
  delivered: 'default',
  reprint: 'outline',
  'print-kitchen': 'outline',
  view: 'outline',
  cancel: 'destructive',
  'refund-cancel': 'destructive',
};

function ActionButton({ action, onClose }) {
  const variant = ACTION_VARIANT[action.key] || (action.danger ? 'destructive' : 'outline');

  if (action.link) {
    return (
      <Button variant={variant} className="order-detail-sheet__action" asChild>
        <Link to={action.link} onClick={onClose}>
          {action.label}
        </Link>
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      className={cn(
        'order-detail-sheet__action',
        action.key === 'checkout' && 'bg-emerald-600 hover:bg-emerald-700',
        action.key === 'edit' && 'border-blue-200 text-blue-900 hover:bg-blue-50',
      )}
      disabled={action.disabled}
      onClick={() => {
        action.onClick?.();
        if (action.key !== 'view') onClose?.();
      }}
    >
      {action.label}
    </Button>
  );
}

export default function OrderDetailBottomSheet({
  open,
  onOpenChange,
  detail,
  actions,
  isKitchenReadOnly,
  kitchenProductType,
  visibleItems,
  itemsTotal,
  readonlyBanner,
}) {
  if (!detail?.order) return null;

  const order = detail.order;
  const actionItems = (actions || []).filter((a) => a.key !== 'view');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="order-detail-sheet max-h-[90vh] overflow-y-auto rounded-t-2xl p-0"
      >
        <SheetHeader className="border-b px-4 py-4 pr-12 text-left">
          <SheetTitle className="flex flex-wrap items-center gap-2 text-lg">
            {order.order_number}
            {order.daily_code != null && (
              <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-800">
                Code {String(order.daily_code).padStart(4, '0')}
              </Badge>
            )}
          </SheetTitle>
          <p className="text-sm text-muted-foreground">
            {order.table?.name ? `Table ${order.table.name}` : (typeLabels[order.type] || order.type)}
            {' · '}
            {orderStatusLabel(order.status)}
          </p>
        </SheetHeader>

        <div className="px-4 py-4">
          {readonlyBanner}

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Type</dt>
              <dd className="font-medium">{typeLabels[order.type] || order.type}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Total</dt>
              <dd className="font-semibold">
                {isKitchenReadOnly
                  ? `${itemsTotal.toFixed(2)} MAD`
                  : `${order.total?.toFixed(2)} MAD`}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Serveur</dt>
              <dd className="font-medium">{order.waiter?.fullname || '—'}</dd>
            </div>
          </dl>

          <Separator className="my-4" />

          <p className="mb-2 font-semibold">Articles</p>
          {visibleItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun article.</p>
          ) : (
            <ul className="space-y-2">
              {visibleItems.map((item) => (
                <li key={item._id} className="rounded-lg border px-3 py-2 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <strong>{item.quantity}× {item.name}</strong>
                    <Badge variant="outline">{orderItemStatusLabel(item.status)}</Badge>
                  </div>
                  <div className="text-muted-foreground">{item.line_total?.toFixed(2)} MAD</div>
                </li>
              ))}
            </ul>
          )}

          {actionItems.length > 0 && (
            <>
              <Separator className="my-4" />
              <div className="order-detail-sheet__actions">
                {actionItems.map((action) => (
                  <ActionButton
                    key={action.key}
                    action={action}
                    onClose={() => onOpenChange(false)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
