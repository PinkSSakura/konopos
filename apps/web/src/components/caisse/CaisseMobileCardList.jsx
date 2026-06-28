import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { orderStatusLabel } from '../../utils/orderStatusLabels';

const TYPE_LABELS = { dine_in: 'Sur place', takeaway: 'À emporter', delivery: 'Livraison' };
const TYPE_TAG_CLASS = {
  dine_in: 'border-blue-200 bg-blue-50 text-blue-800',
  takeaway: 'border-orange-200 bg-orange-50 text-orange-800',
  delivery: 'border-purple-200 bg-purple-50 text-purple-800',
};

const statusBadgeClass = {
  open: 'border-slate-200 bg-slate-50 text-slate-800',
  sent: 'border-blue-200 bg-blue-50 text-blue-800',
  preparing: 'border-orange-200 bg-orange-50 text-orange-800',
  ready: 'border-cyan-200 bg-cyan-50 text-cyan-800',
  served: 'border-green-200 bg-green-50 text-green-800',
  delivered: 'border-blue-200 bg-blue-50 text-blue-800',
  paid: 'border-purple-200 bg-purple-50 text-purple-800',
  cancelled: 'border-red-200 bg-red-50 text-red-800',
};

export default function CaisseMobileCardList({
  rows,
  onSelect,
  selectionMode = false,
  selectedIds = new Set(),
  onToggleSelect,
  isEligible,
}) {
  if (!rows.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Aucune commande en attente de paiement.
      </p>
    );
  }

  return (
    <ul className="orders-mobile-list">
      {rows.map((row) => {
        const order = row.order;
        const tableLabel = order.table?.name
          ? `Table ${order.table.name}`
          : (TYPE_LABELS[order.type] || order.type);
        const balance = row.amounts?.balance_due;
        const eligible = isEligible ? isEligible(row) : false;
        const checked = selectedIds.has(order._id);

        return (
          <li key={order._id}>
            <div className="orders-mobile-card flex gap-3">
              {selectionMode && (
                <div className="flex items-start pt-1">
                  <Checkbox
                    checked={checked}
                    disabled={!eligible}
                    onCheckedChange={() => onToggleSelect?.(order._id)}
                    aria-label={`Sélectionner ${order.order_number}`}
                  />
                </div>
              )}
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => (selectionMode && eligible
                  ? onToggleSelect?.(order._id)
                  : onSelect(row))}
              >
                <div className="orders-mobile-card__header">
                  <span className="orders-mobile-card__table">{tableLabel}</span>
                  <Badge
                    variant="outline"
                    className={cn('shrink-0', statusBadgeClass[order.status])}
                  >
                    {orderStatusLabel(order.status)}
                  </Badge>
                </div>
                <div className="orders-mobile-card__meta">
                  <span className="orders-mobile-card__number">{order.order_number}</span>
                  {order.daily_code != null && (
                    <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-800">
                      Code {String(order.daily_code).padStart(4, '0')}
                    </Badge>
                  )}
                  <Badge variant="outline" className={TYPE_TAG_CLASS[order.type]}>
                    {TYPE_LABELS[order.type]}
                  </Badge>
                  {order.payment_status === 'partial' && (
                    <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                      Paiement partiel
                    </Badge>
                  )}
                </div>
                <div className="orders-mobile-card__footer">
                  <span className="orders-mobile-card__total">
                    {balance != null ? `${Number(balance).toFixed(2)} MAD` : '—'}
                  </span>
                  {order.waiter?.fullname && (
                    <span className="text-xs text-muted-foreground">{order.waiter.fullname}</span>
                  )}
                </div>
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
