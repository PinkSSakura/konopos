import React from 'react';
import { Badge } from '@/components/ui/badge';

function DetailField({ label, value }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value ?? '—'}</dd>
    </div>
  );
}

export default function MenuMobileDetail({ section, row }) {
  if (!row) return null;

  if (section === 'categories') {
    return (
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <DetailField label="Nom" value={row.name} />
        <div>
          <dt className="text-muted-foreground">Aperçu</dt>
          <dd className="mt-1">
            {row.image_url ? (
              <img
                src={row.image_url}
                alt=""
                className="size-16 rounded-lg object-cover"
              />
            ) : (
              <div
                className="size-16 rounded-lg"
                style={{ background: row.color || '#c2462d' }}
              />
            )}
          </dd>
        </div>
        {row.color ? <DetailField label="Couleur" value={row.color} /> : null}
      </dl>
    );
  }

  if (section === 'subcategories') {
    return (
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <DetailField label="Nom" value={row.name} />
        <DetailField label="Catégorie" value={row.category?.name} />
      </dl>
    );
  }

  if (section === 'items') {
    return (
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <DetailField label="Nom" value={row.name} />
        <DetailField label="Prix" value={`${row.price} MAD`} />
        <div>
          <dt className="text-muted-foreground">Type</dt>
          <dd className="mt-1">
            <Badge variant={row.product_type === 'FOOD' ? 'secondary' : 'outline'}>
              {row.product_type === 'FOOD' ? 'Cuisine' : 'Bar'}
            </Badge>
          </dd>
        </div>
        <DetailField label="Catégorie" value={row.category?.name} />
        {row.subcategory?.name ? (
          <DetailField label="Sous-catégorie" value={row.subcategory.name} />
        ) : null}
        {row.image_url ? (
          <div className="col-span-2">
            <dt className="text-muted-foreground">Image</dt>
            <dd className="mt-1">
              <img src={row.image_url} alt="" className="size-20 rounded-lg object-cover" />
            </dd>
          </div>
        ) : null}
      </dl>
    );
  }

  if (section === 'extras') {
    return (
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <DetailField label="Nom" value={row.name} />
        <DetailField label="Prix" value={`${row.price} MAD`} />
        <div>
          <dt className="text-muted-foreground">Statut</dt>
          <dd className="mt-1">
            <Badge variant={row.is_active !== false ? 'secondary' : 'outline'}>
              {row.is_active !== false ? 'Actif' : 'Inactif'}
            </Badge>
          </dd>
        </div>
        {row.image_url ? (
          <div className="col-span-2">
            <dt className="text-muted-foreground">Image</dt>
            <dd className="mt-1">
              <img src={row.image_url} alt="" className="size-20 rounded-lg object-cover" />
            </dd>
          </div>
        ) : null}
      </dl>
    );
  }

  return (
    <dl className="grid grid-cols-2 gap-3 text-sm">
      <DetailField label="Nom" value={row.name} />
    </dl>
  );
}
