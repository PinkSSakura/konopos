import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { message } from '@/lib/toast';
import Table from '@/components/data/SimpleTable';
import { Badge as Tag } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Select from '@/components/ui/AppSelect';
import InfoResult from '@/components/feedback/InfoResult';
import client from '../../api/client';
import TableActions from '../../components/TableActions';
import TableListFilterBar from '../../components/TableListFilterBar';
import { TableLoading } from '../../components/loading/LoadingStates';
import { useEstablishment } from '../../context/EstablishmentContext';
import { PageShell, PageTableCard } from '../../components/layout/PageShell';
import PagePrimaryButton from '../../components/layout/PagePrimaryButton';
import { tablePagination } from '../../utils/tablePagination';
import { rowMatchesSearch } from '../../utils/listSearch';

export default function UsersPage() {
  const { hasEstablishment, loading: estLoading } = useEstablishment();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [applied, setApplied] = useState({
    search: '',
    roleFilter: null,
    statusFilter: null,
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await client.get('/admin/users');
      setUsers(res.data.data);
    } catch (err) {
      if (err.response?.data?.code !== 'ESTABLISHMENT_REQUIRED') {
        message.error(err.response?.data?.message || 'Erreur chargement');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasEstablishment) load();
  }, [hasEstablishment]);

  const roleOptions = useMemo(() => {
    const map = new Map();
    users.forEach((user) => {
      if (user.role?._id) map.set(user.role._id, user.role.name);
    });
    return [...map.entries()].map(([value, label]) => ({ value, label }));
  }, [users]);

  const filteredUsers = useMemo(() => users.filter((user) => {
    if (!rowMatchesSearch(user, applied.search, [
      (r) => r.fullname,
      (r) => r.username,
      (r) => r.code_user,
      (r) => r.matricule,
      (r) => r.role?.name,
    ])) return false;
    if (applied.roleFilter && user.role?._id !== applied.roleFilter) return false;
    if (applied.statusFilter === 'actif' && !(user.status === 'actif' && user.is_active)) return false;
    if (applied.statusFilter === 'inactif' && user.status === 'actif' && user.is_active) return false;
    return true;
  }), [users, applied]);

  const columns = [
    { key: 'code_user', title: 'Code', dataIndex: 'code_user', width: 110 },
    { key: 'matricule', title: 'Matricule', dataIndex: 'matricule', width: 110 },
    { key: 'fullname', title: 'Nom', dataIndex: 'fullname' },
    { key: 'username', title: 'Identifiant', dataIndex: 'username' },
    {
      key: 'role',
      title: 'Rôle',
      render: (_, r) => <Tag variant="secondary">{r.role?.name}</Tag>,
    },
    {
      key: 'has_pin',
      title: 'PIN',
      dataIndex: 'has_pin',
      render: (hasPin) => (hasPin ? 'Configuré' : '—'),
    },
    {
      key: 'status',
      title: 'Statut',
      dataIndex: 'status',
      render: (s, r) => (
        <Tag
          variant="outline"
          className={s === 'actif' && r.is_active
            ? 'border-green-200 bg-green-50 text-green-800'
            : 'border-red-200 bg-red-50 text-red-800'}
        >
          {s}
        </Tag>
      ),
    },
    {
      key: 'actions',
      title: 'Actions',
      className: 'page-table-actions-col',
      width: 120,
      align: 'center',
      render: (_, r) => {
        const items = [
          { key: 'edit', label: 'Modifier', link: `/admin/users/${r._id}/edit` },
        ];
        if (r.role?.role_key !== 'superadmin') {
          items.push({
            key: 'delete',
            label: 'Supprimer',
            danger: true,
            confirm: 'Supprimer cet utilisateur ?',
            onClick: () => client.delete(`/admin/users/${r._id}`).then(load),
          });
        }
        return <TableActions items={items} />;
      },
    },
  ];

  if (estLoading) return null;

  if (!hasEstablishment) {
    return (
      <InfoResult
        status="info"
        title="Créez d'abord un établissement"
        subTitle="Les utilisateurs sont rattachés à un établissement."
        extra={(
          <Button onClick={() => navigate('/admin/establishment')}>
            Créer l&apos;établissement
          </Button>
        )}
      />
    );
  }

  return (
    <PageShell
      title="Gestion des utilisateurs"
      subtitle="Comptes, rôles et accès au point de vente."
      action={(
        <PagePrimaryButton to="/admin/users/new" icon={Plus}>
          Nouvel utilisateur
        </PagePrimaryButton>
      )}
    >
      {loading ? (
        <TableLoading rows={8} columns={8} />
      ) : (
        <PageTableCard contentClassName="space-y-4">
          <TableListFilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Nom, identifiant, code, matricule…"
            loading={loading}
            onApply={() => setApplied({ search, roleFilter, statusFilter })}
            onReset={() => {
              setSearch('');
              setRoleFilter(null);
              setStatusFilter(null);
              setApplied({ search: '', roleFilter: null, statusFilter: null });
            }}
            extra={(
              <>
                <Select
                  allowClear
                  placeholder="Rôle"
                  style={{ width: 160 }}
                  value={roleFilter}
                  onChange={setRoleFilter}
                  options={roleOptions}
                />
                <Select
                  allowClear
                  placeholder="Statut"
                  style={{ width: 140 }}
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={[
                    { value: 'actif', label: 'Actif' },
                    { value: 'inactif', label: 'Inactif' },
                  ]}
                />
              </>
            )}
          />
          <div className="data-table-wrap">
            <Table
              rowKey="_id"
              dataSource={filteredUsers}
              columns={columns}
              pagination={tablePagination}
            />
          </div>
        </PageTableCard>
      )}
    </PageShell>
  );
}
