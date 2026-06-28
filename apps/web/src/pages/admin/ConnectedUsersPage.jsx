import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { message } from '@/lib/toast';
import Table from '@/components/data/SimpleTable';
import { Badge as Tag } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import client from '../../api/client';
import { PageShell, PageTableCard } from '../../components/layout/PageShell';
import { TableLoading } from '../../components/loading/LoadingStates';
import { tablePagination } from '../../utils/tablePagination';
import { formatDateTime } from '../../utils/dateFilters';
import { useAuth } from '../../context/AuthContext';
import { canForceLogoutSession } from '../../utils/sessionAccess';
import { useSocketEvent } from '../../context/SocketContext';
import { cn } from '@/lib/utils';

export default function ConnectedUsersPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [forcingId, setForcingId] = useState(null);
  const showForceLogout = canForceLogoutSession(user);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await client.get('/sessions');
      setRows(res.data.data || []);
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useSocketEvent('auth:session_revoked', () => {
    load();
  });

  const forceLogout = async (sessionId) => {
    setForcingId(sessionId);
    try {
      await client.post(`/sessions/${sessionId}/force-logout`);
      message.success('Session déconnectée');
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur');
    } finally {
      setForcingId(null);
    }
  };

  const columns = [
    {
      key: 'user',
      title: 'Utilisateur',
      render: (_, row) => (
        <div className={cn(row.is_current && 'rounded-md bg-[rgba(206,179,143,0.12)] p-1 -m-1')}>
          <div>{row.user?.fullname || '—'}</div>
          <div className="text-xs text-muted-foreground">{row.user?.username}</div>
        </div>
      ),
    },
    {
      key: 'role',
      title: 'Rôle',
      render: (_, row) => (
        <Tag variant="secondary">{row.user?.role_name || row.user?.role_key || '—'}</Tag>
      ),
    },
    {
      key: 'type',
      title: 'Type',
      render: (_, row) => (
        row.is_pin_session ? (
          <Tag variant="outline" className="border-purple-200 bg-purple-50 text-purple-800">
            PIN / POS
          </Tag>
        ) : (
          <Tag variant="secondary">Backoffice</Tag>
        )
      ),
    },
    {
      key: 'device_label',
      title: 'Appareil',
      dataIndex: 'device_label',
    },
    {
      key: 'login_time',
      title: 'Connexion',
      dataIndex: 'login_time',
      width: 170,
      render: (d) => formatDateTime(d),
    },
    {
      key: 'actions',
      title: '',
      width: 140,
      render: (_, row) => {
        if (!showForceLogout || row.is_current) return null;
        const isForcing = forcingId === row._id;
        return (
          <Button
            variant="destructive"
            size="sm"
            disabled={isForcing}
            onClick={() => forceLogout(row._id)}
          >
            {isForcing ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Déconnecter
          </Button>
        );
      },
    },
  ];

  return (
    <PageShell
      title="Utilisateurs connectés"
      subtitle="Sessions actives et déconnexion forcée."
      action={(
        <Button variant="outline" disabled={loading} onClick={load}>
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          Actualiser
        </Button>
      )}
    >
      <PageTableCard>
        {loading && rows.length === 0 ? (
          <TableLoading />
        ) : (
          <Table
            rowKey="_id"
            columns={columns}
            dataSource={rows}
            pagination={tablePagination}
            locale={{ emptyText: 'Aucune session active' }}
          />
        )}
      </PageTableCard>
    </PageShell>
  );
}
