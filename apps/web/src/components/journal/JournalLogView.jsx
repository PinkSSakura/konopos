import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { message } from '@/lib/toast';
import Table from '@/components/data/SimpleTable';
import { Badge as Tag } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Select from '@/components/ui/AppSelect';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import client from '../../api/client';
import DatePicker from '../../components/DatePicker';
import { TableLoading } from '../../components/loading/LoadingStates';
import { tablePagination } from '../../utils/tablePagination';
import { todayDateString, formatDateTime } from '../../utils/dateFilters';

const ROLE_OPTIONS = [
  { value: 'waiter', label: 'Serveur' },
  { value: 'cook', label: 'Cuisine' },
  { value: 'barman', label: 'Bar' },
  { value: 'manager', label: 'Manager' },
  { value: 'submanager', label: 'Sous-manager' },
];

export default function JournalLogView({
  title,
  subtitle,
  endpoint,
  showTechnical = false,
  showRoleFilter = false,
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(todayDateString());
  const [roleKey, setRoleKey] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = { from, to, limit: 200 };
    if (showRoleFilter && roleKey) params.role_key = roleKey;
    client
      .get(endpoint, { params })
      .then((res) => setRows(res.data.data || []))
      .catch((err) => message.error(err.response?.data?.message || 'Erreur chargement'))
      .finally(() => setLoading(false));
  }, [endpoint, from, to, roleKey, showRoleFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const columns = [
    {
      key: 'createdAt',
      title: 'Date',
      dataIndex: 'createdAt',
      width: 160,
      render: (value) => formatDateTime(value),
    },
    {
      key: 'user',
      title: 'Utilisateur',
      render: (_, r) => (
        <div>
          <div>{r.user?.fullname || '—'}</div>
          {r.user?.role_name && (
            <div className="text-xs text-muted-foreground">{r.user.role_name}</div>
          )}
        </div>
      ),
    },
    {
      key: 'module_label',
      title: 'Module',
      dataIndex: 'module_label',
      width: 120,
    },
    {
      key: 'action_label',
      title: 'Action',
      dataIndex: 'action_label',
      width: 140,
      render: (label, r) => (
        <Tag
          variant="outline"
          className={r.success === false
            ? 'border-red-200 bg-red-50 text-red-800'
            : 'border-blue-200 bg-blue-50 text-blue-800'}
        >
          {label}
        </Tag>
      ),
    },
    {
      key: 'description',
      title: 'Détail',
      dataIndex: 'description',
      render: (v) => (
        <span className="block max-w-md truncate" title={v || undefined}>
          {v || '—'}
        </span>
      ),
    },
  ];

  if (showTechnical) {
    columns.push(
      {
        key: 'ip',
        title: 'IP',
        dataIndex: 'ip',
        width: 120,
        render: (v) => v || '—',
      },
      {
        key: 'audience',
        title: 'Portée',
        dataIndex: 'audience',
        width: 90,
        render: (v) => (
          <Tag variant="secondary">{v === 'staff' ? 'Équipe' : 'Système'}</Tag>
        ),
      },
    );
  }

  return (
    <Card>
      <CardHeader className="border-b border-border/60">
        <CardTitle className="text-xl font-semibold">{title}</CardTitle>
        <CardAction>
          <Button variant="outline" disabled={loading} onClick={load}>
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Actualiser
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {subtitle && (
          <CardDescription>{subtitle}</CardDescription>
        )}

        <div className="flex flex-wrap gap-2">
          <DatePicker value={from} onChange={setFrom} className="w-[160px]" />
          <DatePicker value={to} onChange={setTo} className="w-[160px]" />
          {showRoleFilter && (
            <Select
              allowClear
              placeholder="Rôle"
              style={{ width: 160 }}
              value={roleKey}
              onChange={setRoleKey}
              options={ROLE_OPTIONS}
            />
          )}
          <Button disabled={loading} onClick={load}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : null}
            Filtrer
          </Button>
        </div>

        {loading ? (
          <TableLoading rows={8} columns={columns.length} />
        ) : (
          <div className="overflow-x-auto">
            <Table
              rowKey="_id"
              dataSource={rows}
              columns={columns}
              pagination={tablePagination}
              locale={{ emptyText: 'Aucune entrée sur cette période' }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
