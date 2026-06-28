import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { orderStatusLabel } from '../../utils/orderStatusLabels';

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

const typeLabels = {
  dine_in: 'Sur place',
  takeaway: 'À emporter',
  delivery: 'Livraison',
};

export default function OrdersMobileCardList({ orders, onSelect, showWaiterBadge, userId }) {
  if (!orders.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Aucune commande active.
      </p>
    );
  }

  return (
    <ul className="orders-mobile-list">
      {orders.map((order) => {
        const tableLabel = order.table?.name
          ? `Table ${order.table.name}`
          : (typeLabels[order.type] || order.type);
        return (
          <li key={order._id}>
            <button
              type="button"
              className="orders-mobile-card"
              onClick={() => onSelect(order._id)}
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
                {order.payment_status === 'partial' && (
                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                    Paiement partiel
                  </Badge>
                )}
              </div>
              <div className="orders-mobile-card__footer">
                <span className="orders-mobile-card__total">
                  {order.total != null ? `${Number(order.total).toFixed(2)} MAD` : '—'}
                </span>
                {showWaiterBadge && order.is_own === false && (
                  <Badge variant="outline">Autre serveur</Badge>
                )}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
