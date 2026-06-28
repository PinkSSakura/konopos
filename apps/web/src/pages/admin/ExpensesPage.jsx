import React, { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { message } from '@/lib/toast';
import Table from '@/components/data/SimpleTable';
import { Badge as Tag } from '@/components/ui/badge';
import Select from '@/components/ui/AppSelect';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import client from '../../api/client';
import ListFilterBar from '../../components/ListFilterBar';
import { TableLoading } from '../../components/loading/LoadingStates';
import TableActions from '../../components/TableActions';
import { PageShell, PageTableCard } from '../../components/layout/PageShell';
import PagePrimaryButton from '../../components/layout/PagePrimaryButton';
import { buildDateRangeParams, defaultTodayRange, formatDate } from '../../utils/dateFilters';
import { tablePagination } from '../../utils/tablePagination';
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_CATEGORY_OPTIONS,
  EXPENSE_PAYMENT_METHOD_LABELS,
} from '../../utils/expenseLabels';

const initialDates = defaultTodayRange();

function formatMad(value) {
  return `${(Number(value) || 0).toFixed(2)} MAD`;
}

const CATEGORY_TAG_CLASS = {
  bills: 'border-orange-300 bg-orange-50 text-orange-900',
  merchandise: 'border-orange-200 bg-orange-50 text-orange-800',
  salary: 'border-blue-200 bg-blue-50 text-blue-800',
  maintenance: 'border-cyan-200 bg-cyan-50 text-cyan-800',
  marketing: 'border-purple-200 bg-purple-50 text-purple-800',
  tax: 'border-red-200 bg-red-50 text-red-800',
  other: '',
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState(initialDates.from);
  const [dateTo, setDateTo] = useState(initialDates.to);
  const [category, setCategory] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = {
      limit: 500,
      ...buildDateRangeParams(dateFrom, dateTo),
    };
    if (search.trim()) params.q = search.trim();
    if (category) params.category = category;

    Promise.all([
      client.get('/expenses', { params }),
      client.get('/expenses/summary', { params }),
    ])
      .then(([listRes, summaryRes]) => {
        setExpenses(listRes.data.data);
        setSummary(summaryRes.data.data);
      })
      .catch(() => message.error('Erreur chargement des dépenses'))
      .finally(() => setLoading(false));
  }, [search, dateFrom, dateTo, category]);

  useEffect(() => {
    load();
  }, [load]);

  const handleReset = ({ search: s, from, to }) => {
    setSearch(s);
    setDateFrom(from);
    setDateTo(to);
    setCategory(null);
  };

  const columns = [
    {
      key: 'expense_date',
      title: 'Date',
      dataIndex: 'expense_date',
      width: 110,
      render: (d) => formatDate(d),
    },
    { key: 'title', title: 'Libellé', dataIndex: 'title' },
    {
      key: 'category',
      title: 'Catégorie',
      dataIndex: 'category',
      width: 180,
      render: (c) => (
        <Tag variant="outline" className={cn(CATEGORY_TAG_CLASS[c])}>
          {EXPENSE_CATEGORY_LABELS[c] || c}
        </Tag>
      ),
    },
    {
      key: 'supplier',
      title: 'Fournisseur',
      dataIndex: 'supplier',
      render: (v) => v || '—',
    },
    {
      key: 'reference',
      title: 'Référence',
      dataIndex: 'reference',
      render: (v) => v || '—',
      width: 120,
    },
    {
      key: 'payment_method',
      title: 'Paiement',
      dataIndex: 'payment_method',
      width: 100,
      render: (m) => EXPENSE_PAYMENT_METHOD_LABELS[m] || m,
    },
    {
      key: 'amount',
      title: 'Montant',
      dataIndex: 'amount',
      width: 120,
      render: (a) => <strong>{formatMad(a)}</strong>,
    },
    {
      key: 'recorded_by',
      title: 'Saisi par',
      dataIndex: ['recorded_by', 'fullname'],
      width: 130,
      render: (v) => v || '—',
    },
    {
      key: 'actions',
      title: 'Actions',
      className: 'page-table-actions-col',
      width: 120,
      align: 'center',
      render: (_, r) => (
        <TableActions
          items={[
            { key: 'edit', label: 'Modifier', link: `/admin/expenses/${r._id}/edit` },
            {
              key: 'delete',
              label: 'Supprimer',
              danger: true,
              confirm: `Supprimer la dépense « ${r.title} » ?`,
              onClick: async () => {
                try {
                  await client.delete(`/expenses/${r._id}`);
                  message.success('Dépense supprimée');
                  load();
                } catch (err) {
                  message.error(err.response?.data?.message || 'Erreur');
                }
              },
            },
          ]}
        />
      ),
    },
  ];

  return (
    <PageShell
      title="Dépenses"
      subtitle="Factures, marchandise, salaires et autres charges de l'établissement."
      action={(
        <PagePrimaryButton to="/admin/expenses/new" icon={Plus}>
          Nouvelle dépense
        </PagePrimaryButton>
      )}
    >
      <ListFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Libellé, fournisseur, référence…"
        from={dateFrom}
        to={dateTo}
        onFromChange={setDateFrom}
        onToChange={setDateTo}
        onApply={load}
        onReset={handleReset}
        loading={loading}
        extra={(
          <Select
            allowClear
            placeholder="Catégorie"
            style={{ width: 200 }}
            value={category}
            onChange={setCategory}
            options={EXPENSE_CATEGORY_OPTIONS}
          />
        )}
      />

      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="p-4">
            <CardContent className="p-0">
              <p className="text-sm text-muted-foreground">Total période</p>
              <p className="text-2xl font-semibold">
                {formatMad(summary.total)}
              </p>
            </CardContent>
          </Card>
          <Card className="p-4">
            <CardContent className="p-0">
              <p className="text-sm text-muted-foreground">Nombre de dépenses</p>
              <p className="text-2xl font-semibold">{summary.count}</p>
            </CardContent>
          </Card>
          <Card className="p-4 sm:col-span-2 lg:col-span-1">
            <CardContent className="p-0">
              <div className="flex flex-wrap gap-1">
                {Object.entries(summary.by_category || {}).map(([key, val]) => (
                  <Tag key={key} variant="outline" className={cn(CATEGORY_TAG_CLASS[key])}>
                    {EXPENSE_CATEGORY_LABELS[key]}: {formatMad(val.total)}
                  </Tag>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <PageTableCard>
        {loading ? (
          <TableLoading rows={10} columns={8} />
        ) : (
          <div className="data-table-wrap">
            <Table
              rowKey="_id"
              dataSource={expenses}
              columns={columns}
              pagination={tablePagination}
            />
          </div>
        )}
      </PageTableCard>
    </PageShell>
  );
}
