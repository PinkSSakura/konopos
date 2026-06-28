import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

function CategoryPreview({ row }) {
  if (row.image_url) {
    return (
      <img
        src={row.image_url}
        alt=""
        className="menu-mobile-card__thumb size-10 shrink-0 rounded-lg object-cover"
      />
    );
  }
  return (
    <div
      className="menu-mobile-card__thumb size-10 shrink-0 rounded-lg"
      style={{ background: row.color || '#c2462d' }}
    />
  );
}

function ItemPreview({ row }) {
  if (!row.image_url) {
    return null;
  }
  return (
    <img
      src={row.image_url}
      alt=""
      className="menu-mobile-card__thumb size-10 shrink-0 rounded-lg object-cover"
    />
  );
}

function renderCard(section, row) {
  if (section === 'categories') {
    return (
      <>
        <div className="orders-mobile-card__header">
          <span className="orders-mobile-card__table">{row.name}</span>
          <CategoryPreview row={row} />
        </div>
      </>
    );
  }

  if (section === 'subcategories') {
    return (
      <>
        <div className="orders-mobile-card__header">
          <span className="orders-mobile-card__table">{row.name}</span>
        </div>
        <div className="orders-mobile-card__meta">
          <span>{row.category?.name || 'Sans catégorie'}</span>
        </div>
      </>
    );
  }

  if (section === 'items') {
    const isFood = row.product_type === 'FOOD';
    return (
      <div className="menu-mobile-card__row">
        <div className="menu-mobile-card__cell">
          <span className="menu-mobile-card__title">{row.name}</span>
          <span className="menu-mobile-card__sub">{row.category?.name || '—'}</span>
        </div>
        <div className="menu-mobile-card__cell menu-mobile-card__cell--end">
          <span className="menu-mobile-card__price">{row.price} MAD</span>
          <Badge variant={isFood ? 'secondary' : 'outline'} className="mt-1">
            {isFood ? 'Cuisine' : 'Bar'}
          </Badge>
        </div>
      </div>
    );
  }

  if (section === 'extras') {
    return (
      <>
        <div className="orders-mobile-card__header">
          <span className="orders-mobile-card__table">{row.name}</span>
          <ItemPreview row={row} />
        </div>
        <div className="orders-mobile-card__meta">
          <Badge variant={row.is_active !== false ? 'secondary' : 'outline'}>
            {row.is_active !== false ? 'Actif' : 'Inactif'}
          </Badge>
        </div>
        <div className="orders-mobile-card__footer">
          <span className="orders-mobile-card__total">{row.price} MAD</span>
        </div>
      </>
    );
  }

  return (
    <div className="orders-mobile-card__header">
      <span className="orders-mobile-card__table">{row.name || '—'}</span>
    </div>
  );
}

export default function MenuMobileCardList({ section, rows, onSelect }) {
  if (!rows.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Aucun élément pour le moment.
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
              'orders-mobile-card menu-mobile-card',
              section === 'items' && (
                row.product_type === 'FOOD'
                  ? 'menu-mobile-card--food'
                  : 'menu-mobile-card--drink'
              ),
            )}
            onClick={() => onSelect(row)}
          >
            {renderCard(section, row)}
          </button>
        </li>
      ))}
    </ul>
  );
}
