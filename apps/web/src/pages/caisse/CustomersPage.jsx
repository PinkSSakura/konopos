import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { message } from '@/lib/toast';
import Table from '@/components/data/SimpleTable';
import { Badge as Tag } from '@/components/ui/badge';
import Select from '@/components/ui/AppSelect';
import { cn } from '@/lib/utils';
import client from '../../api/client';
import TableActions from '../../components/TableActions';
import TableListFilterBar from '../../components/TableListFilterBar';
import { TableLoading } from '../../components/loading/LoadingStates';
import { PageShell, PageTableCard } from '../../components/layout/PageShell';
import PagePrimaryButton from '../../components/layout/PagePrimaryButton';
import { tablePagination } from '../../utils/tablePagination';

function formatMad(value) {
  const n = Number(value) || 0;
  return `${n.toFixed(2)} MAD`;
}

const BALANCE_TAG_CLASS = {
  positive: 'border-orange-200 bg-orange-50 text-orange-800',
  negative: 'border-blue-200 bg-blue-50 text-blue-800',
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(null);
  const [applied, setApplied] = useState({ search: '', statusFilter: null });

  const load = async (filters = applied) => {
    setLoading(true);
    try {
      const res = await client.get('/customers', {
        params: {
          q: filters.search.trim() || undefined,
          include_inactive: '1',
        },
      });
      let data = res.data.data;
      if (filters.statusFilter === 'active') {
        data = data.filter((c) => c.is_active);
      } else if (filters.statusFilter === 'inactive') {
        data = data.filter((c) => !c.is_active);
      }
      setCustomers(data);
    } catch {
      message.error('Erreur chargement des clients');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const columns = [
    { key: 'name', title: 'Nom', dataIndex: 'name' },
    { key: 'phone', title: 'Téléphone', dataIndex: 'phone', render: (v) => v || '—' },
    { key: 'email', title: 'E-mail', dataIndex: 'email', render: (v) => v || '—' },
    {
      key: 'balance',
      title: 'Solde dû',
      dataIndex: 'balance',
      width: 130,
      render: (b) => {
        const n = Number(b) || 0;
        const tone = n > 0.01 ? 'positive' : n < -0.01 ? 'negative' : null;
        return (
          <Tag
            variant={tone ? 'outline' : 'secondary'}
            className={cn(tone && BALANCE_TAG_CLASS[tone])}
          >
            {formatMad(n)}
          </Tag>
        );
      },
    },
    {
      key: 'status',
      title: 'Statut',
      dataIndex: 'is_active',
      width: 100,
      render: (active) => (
        <Tag
          variant="outline"
          className={cn(active && 'border-green-200 bg-green-50 text-green-800')}
        >
          {active ? 'Actif' : 'Inactif'}
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
          { key: 'edit', label: 'Modifier', link: `/admin/clients/${r._id}/edit` },
        ];
        if (Math.abs(r.balance || 0) <= 0.01) {
          items.push({
            key: 'delete',
            label: 'Supprimer',
            danger: true,
            confirm: `Supprimer le client « ${r.name} » ?`,
            onClick: async () => {
              try {
                await client.delete(`/customers/${r._id}`);
                message.success('Client supprimé');
                load();
              } catch (err) {
                message.error(err.response?.data?.message || 'Erreur');
              }
            },
          });
        }
        return <TableActions items={items} />;
      },
    },
  ];

  return (
    <PageShell
      title="Clients réguliers"
      subtitle="Comptes pour crédit, débit et paiements partiels à l'encaissement."
      action={(
        <PagePrimaryButton to="/admin/clients/new" icon={Plus}>
          Nouveau client
        </PagePrimaryButton>
      )}
    >
      <PageTableCard contentClassName="space-y-4">
        <TableListFilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Nom, téléphone, e-mail…"
          loading={loading}
          onApply={() => {
            const next = { search, statusFilter };
            setApplied(next);
            load(next);
          }}
          onReset={() => {
            const next = { search: '', statusFilter: null };
            setSearch('');
            setStatusFilter(null);
            setApplied(next);
            load(next);
          }}
          extra={(
            <Select
              allowClear
              placeholder="Statut"
              style={{ width: 140 }}
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'active', label: 'Actif' },
                { value: 'inactive', label: 'Inactif' },
              ]}
            />
          )}
        />

        {loading ? (
          <TableLoading rows={10} columns={7} />
        ) : (
          <div className="data-table-wrap">
            <Table
              rowKey="_id"
              dataSource={customers}
              columns={columns}
              pagination={tablePagination}
            />
          </div>
        )}
      </PageTableCard>
    </PageShell>
  );
}
