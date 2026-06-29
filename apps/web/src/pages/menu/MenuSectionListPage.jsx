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
import {
  canCreateMenuSection,
  canDeleteMenuSection,
  canUpdateMenuSection,
} from '../../utils/menuPermissions';
import { useAuth } from '../../context/AuthContext';
import { MenuSectionPanel } from './menuListShared';

const SECTION_ENDPOINTS = {
  categories: '/menu/categories',
  subcategories: '/menu/subcategories',
  extras: '/menu/extras',
  items: '/menu/items',
};

export default function MenuSectionListPage() {
  const { section: sectionKey } = useParams();
  const { user } = useAuth();
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

  const getRowActions = useCallback((row) => {
    if (!sectionMeta) return [];
    const canEdit = canUpdateMenuSection(user, sectionMeta.key);
    const canDelete = canDeleteMenuSection(user, sectionMeta.key);

    if (sectionMeta.key === 'categories') {
      const actions = [];
      if (canEdit) {
        actions.push({
          key: 'edit',
          label: 'Modifier',
          link: `/menu/categories/${row._id}/edit`,
        });
      }
      if (canDelete) {
        actions.push({
          key: 'delete',
          label: 'Supprimer',
          danger: true,
          confirm: 'Supprimer cette catégorie ?',
          onClick: () => client.delete(`/menu/categories/${row._id}`).then(load),
        });
      }
      return actions;
    }

    if (sectionMeta.key === 'subcategories') {
      return canEdit ? [{
        key: 'edit',
        label: 'Modifier',
        link: `/menu/subcategories/${row._id}/edit`,
      }] : [];
    }

    if (sectionMeta.key === 'items') {
      const actions = [];
      if (canEdit) {
        actions.push({
          key: 'edit',
          label: 'Modifier',
          link: `/menu/items/${row._id}/edit`,
        });
      }
      if (canDelete) {
        actions.push({
          key: 'delete',
          label: 'Supprimer',
          danger: true,
          confirm: 'Supprimer cet article ?',
          onClick: () => client.delete(`/menu/items/${row._id}`).then(load),
        });
      }
      return actions;
    }

    if (sectionMeta.key === 'extras') {
      const actions = [];
      if (canEdit) {
        actions.push({
          key: 'edit',
          label: 'Modifier',
          link: `/menu/extras/${row._id}/edit`,
        });
      }
      if (canDelete) {
        actions.push({
          key: 'delete',
          label: 'Supprimer',
          danger: true,
          confirm: 'Supprimer cet extra ?',
          onClick: () => client.delete(`/menu/extras/${row._id}`).then(load),
        });
      }
      return actions;
    }

    return [];
  }, [sectionMeta, load, user]);

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
            <div className="size-10 rounded-lg" style={{ background: r.color || '#c2462d' }} />
          )),
        },
        actionsCell(getRowActions),
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
        actionsCell(getRowActions),
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
        actionsCell(getRowActions),
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
        actionsCell(getRowActions),
      ];
    }

    return [];
  }, [sectionMeta, getRowActions]);

  if (!sectionMeta) {
    return <Navigate to="/menu" replace />;
  }

  const canCreate = sectionMeta && canCreateMenuSection(user, sectionMeta.key);

  return (
    <PageShell
      title={sectionMeta.title}
      subtitle={sectionMeta.description}
      action={canCreate ? (
        <PagePrimaryButton to={sectionMeta.addPath} icon={Plus} size="sm" className="w-auto">
          Créer
        </PagePrimaryButton>
      ) : null}
    >
      {loading ? (
        <TableLoading rows={8} columns={5} />
      ) : (
        <MenuSectionPanel
          section={sectionMeta.key}
          columns={columns}
          rows={rows}
          categories={categories}
          getRowActions={getRowActions}
        />
      )}
    </PageShell>
  );
}
