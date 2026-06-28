import React from 'react';
import { Badge } from '@/components/ui/badge';
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

export function groupServiceItemsByOrder(items) {
  const groups = [];
  const index = new Map();

  for (const item of items) {
    const orderId = item.order?._id;
    if (orderId == null) {
      groups.push({ order: item.order, items: [item] });
      continue;
    }
    if (!index.has(orderId)) {
      index.set(orderId, groups.length);
      groups.push({ order: item.order, items: [] });
    }
    groups[index.get(orderId)].items.push(item);
  }

  return groups;
}

export default function ServiceMobileCardList({ items, onSelectGroup }) {
  if (!items.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Aucun article à afficher.
      </p>
    );
  }

  const groups = groupServiceItemsByOrder(items);

  return (
    <ul className="orders-mobile-list">
      {groups.map(({ order, items: groupItems }) => {
        const tableLabel = order?.table?.name
          ? `Table ${order.table.name}`
          : 'Sans table';
        const groupKey = order?._id || groupItems.map((i) => i._id).join('-');

        return (
          <li key={groupKey}>
            <button
              type="button"
              className="orders-mobile-card orders-mobile-card--group"
              onClick={() => onSelectGroup({ order, items: groupItems })}
            >
              <div className="orders-mobile-card__header">
                <span className="orders-mobile-card__table">{tableLabel}</span>
                <span className="text-sm font-medium text-muted-foreground">
                  {order?.order_number}
                </span>
              </div>
              <div className="orders-mobile-card__meta">
                {order?.waiter?.fullname && <span>{order.waiter.fullname}</span>}
                {order?.daily_code != null && (
                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">
                    Code {String(order.daily_code).padStart(4, '0')}
                  </Badge>
                )}
                <span>{groupItems.length} article{groupItems.length > 1 ? 's' : ''}</span>
              </div>
              <ul className="service-mobile-group__items">
                {groupItems.map((item) => (
                  <li key={item._id} className="service-mobile-group__item-preview">
                    <span className="service-mobile-group__item-name">
                      {item.quantity}× {item.name}
                    </span>
                    <div className="service-mobile-group__item-tags">
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
                  </li>
                ))}
              </ul>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
