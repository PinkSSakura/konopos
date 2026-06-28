import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDateTime } from '../../utils/dateFilters';

const METHOD_LABELS = {
  cash: 'Espèces',
  card: 'Carte',
  credit: 'Crédit client',
  debit: 'Débit compte',
};

export default function PaymentHistoryMobileCardList({ rows, onSelect }) {
  if (!rows.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Aucun paiement trouvé.
      </p>
    );
  }

  return (
    <ul className="orders-mobile-list">
      {rows.map((row) => (
        <li key={row._id}>
          <button
            type="button"
            className={cn(
              'orders-mobile-card',
              row.is_void ? 'orders-mobile-card--void' : 'orders-mobile-card--ok',
            )}
            onClick={() => onSelect(row)}
          >
            <div className="orders-mobile-card__header">
              <span className="orders-mobile-card__table">
                {row.receipt_number || 'Ticket'}
              </span>
              {row.is_void && (
                <Badge
                  variant="outline"
                  className="shrink-0 border-red-300 bg-red-100 text-red-800"
                >
                  Annulé
                </Badge>
              )}
            </div>
            <div className="orders-mobile-card__meta">
              <span>{formatDateTime(row.processed_at)}</span>
              <Badge variant="outline">
                {METHOD_LABELS[row.method] || row.method}
              </Badge>
              {row.order_number && (
                <span className="orders-mobile-card__number">{row.order_number}</span>
              )}
            </div>
            <div className="orders-mobile-card__footer">
              <span className="orders-mobile-card__total">
                {row.amount != null ? `${Number(row.amount).toFixed(2)} MAD` : '—'}
              </span>
              {row.waiter && (
                <span className="text-xs text-muted-foreground">{row.waiter}</span>
              )}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
