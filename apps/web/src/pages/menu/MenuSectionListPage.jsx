import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import client from '../../api/client';
import TableActions from '../../components/TableActions';
import { TableLoading } from '../../components/loading/LoadingStates';
import { PageShell } from '../../components/layout/PageShell';
import PagePrimaryButton from '../../components/layout/PagePrimaryButton';
import { Badge } from '@/components/ui/badge';
import { getMenuSection } from '../../utils/menuHub';
import { MenuSectionPanel } from './menuListShared';

const SECTION_ENDPOINTS = {
  categories: '/menu/categories',
  subcategories: '/menu/subcategories',
  extras: '/menu/extras',
  items: '/menu/items',
};

export default function MenuSectionListPage() {
  const { section: sectionKey } = useParams();
  const sectionMeta = getMenuSection(sectionKey);
  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!sectionMeta) return;
    setLoading(true);
    try {
      const requests = [client.get(SECTION_ENDPOINTS[sectionMeta.key])];
      if (sectionMeta.key === 'subcategories' || sectionMeta.key === 'items') {
        requests.push(client.get('/menu/categories'));
      }
      const results = await Promise.all(requests);
      setRows(results[0].data.data);
      if (results[1]) {
        setCategories(results[1].data.data);
      } else {
        setCategories([]);
      }
    } finally {
      setLoading(false);
    }
  }, [sectionMeta]);

  useEffect(() => {
    load().catch(() => toast.error('Erreur chargement menu'));
  }, [load]);

  const actionsCell = (items) => ({
    key: 'actions',
    title: 'Actions',
    className: 'page-table-actions-col',
    render: (row) => <TableActions items={items(row)} />,
  });

  const columns = useMemo(() => {
    if (!sectionMeta) return [];

    if (sectionMeta.key === 'categories') {
      return [
        { key: 'name', title: 'Nom' },
        {
          key: 'preview',
          title: 'Aperçu',
          render: (r) => (r.image_url ? (
            <img src={r.image_url} alt="" className="size-10 rounded-lg object-cover" />
          ) : (
            <div className="size-10 rounded-lg" style={{ background: r.color || '#ceb38f' }} />
          )),
        },
        actionsCell((r) => [
          {
            key: 'edit',
            label: 'Modifier',
            link: `/menu/categories/${r._id}/edit`,
          },
          {
            key: 'delete',
            label: 'Supprimer',
            danger: true,
            confirm: 'Supprimer cette catégorie ?',
            onClick: () => client.delete(`/menu/categories/${r._id}`).then(load),
          },
        ]),
      ];
    }

    if (sectionMeta.key === 'subcategories') {
      return [
        { key: 'name', title: 'Nom' },
        {
          key: 'category',
          title: 'Catégorie',
          render: (r) => r.category?.name || '—',
        },
        actionsCell((r) => [
          {
            key: 'edit',
            label: 'Modifier',
            link: `/menu/subcategories/${r._id}/edit`,
          },
        ]),
      ];
    }

    if (sectionMeta.key === 'items') {
      return [
        { key: 'name', title: 'Nom' },
        {
          key: 'image',
          title: 'Image',
          render: (r) => (r.image_url ? (
            <img src={r.image_url} alt="" className="size-10 rounded-lg object-cover" />
          ) : '—'),
        },
        {
          key: 'price',
          title: 'Prix',
          render: (r) => `${r.price} MAD`,
        },
        {
          key: 'product_type',
          title: 'Type',
          render: (r) => (
            <Badge variant={r.product_type === 'FOOD' ? 'secondary' : 'outline'}>
              {r.product_type === 'FOOD' ? 'Cuisine' : 'Bar'}
            </Badge>
          ),
        },
        {
          key: 'category',
          title: 'Catégorie',
          render: (r) => r.category?.name || '—',
        },
        actionsCell((r) => [
          {
            key: 'edit',
            label: 'Modifier',
            link: `/menu/items/${r._id}/edit`,
          },
          {
            key: 'delete',
            label: 'Supprimer',
            danger: true,
            confirm: 'Supprimer cet article ?',
            onClick: () => client.delete(`/menu/items/${r._id}`).then(load),
          },
        ]),
      ];
    }

    if (sectionMeta.key === 'extras') {
      return [
        { key: 'name', title: 'Nom' },
        {
          key: 'image',
          title: 'Image',
          render: (r) => (r.image_url ? (
            <img src={r.image_url} alt="" className="size-10 rounded-lg object-cover" />
          ) : '—'),
        },
        {
          key: 'price',
          title: 'Prix',
          render: (r) => `${r.price} MAD`,
        },
        {
          key: 'is_active',
          title: 'Actif',
          render: (r) => (
            <Badge variant={r.is_active !== false ? 'secondary' : 'outline'}>
              {r.is_active !== false ? 'Oui' : 'Non'}
            </Badge>
          ),
        },
        actionsCell((r) => [
          {
            key: 'edit',
            label: 'Modifier',
            link: `/menu/extras/${r._id}/edit`,
          },
          {
            key: 'delete',
            label: 'Supprimer',
            danger: true,
            confirm: 'Supprimer cet extra ?',
            onClick: () => client.delete(`/menu/extras/${r._id}`).then(load),
          },
        ]),
      ];
    }

    return [];
  }, [sectionMeta, load]);

  if (!sectionMeta) {
    return <Navigate to="/menu" replace />;
  }

  return (
    <PageShell
      title={sectionMeta.title}
      subtitle={sectionMeta.description}
      action={(
        <PagePrimaryButton to={sectionMeta.addPath} icon={Plus}>
          {sectionMeta.addLabel}
        </PagePrimaryButton>
      )}
    >
      {loading ? (
        <TableLoading rows={8} columns={5} />
      ) : (
        <MenuSectionPanel
          section={sectionMeta.key}
          label={sectionMeta.title}
          columns={columns}
          rows={rows}
          categories={categories}
        />
      )}
    </PageShell>
  );
}
