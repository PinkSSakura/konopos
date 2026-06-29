import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { message } from '@/lib/toast';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  canSelectWaiterDailyCloseTarget,
  canViewWaiterDailyClose,
} from '../../utils/shiftAccess';
import { todayDateString, formatDateLong, formatDateTime } from '../../utils/dateFilters';
import { downloadPdf } from '../../utils/pdfExport';
import DatePicker from '../../components/DatePicker';
import Combobox from '../../components/Combobox';
import CollapsibleToolbar from '../../components/layout/CollapsibleToolbar';
import { CardLoading } from '../../components/loading/LoadingStates';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function formatAmount(value, currency = 'MAD') {
  return `${Number(value || 0).toFixed(2)} ${currency}`;
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function QtyAmountCell({ qty, amount, currency }) {
  if (!qty) {
    return <TableCell className="text-right text-muted-foreground">—</TableCell>;
  }
  return (
    <TableCell className="text-right tabular-nums">
      <div>{qty}</div>
      <div className="text-xs text-muted-foreground">{formatAmount(amount, currency)}</div>
    </TableCell>
  );
}

function ItemDetailTable({ title, rows, currency, emptyLabel }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {rows?.length ? (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Article</TableHead>
                <TableHead className="text-right">Commandés</TableHead>
                <TableHead className="text-right">Retournés</TableHead>
                <TableHead className="text-right">Payés</TableHead>
                <TableHead className="text-right">Impayés</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.name}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <QtyAmountCell qty={row.ordered_qty} amount={row.ordered_amount} currency={currency} />
                  <QtyAmountCell qty={row.returned_qty} amount={row.returned_amount} currency={currency} />
                  <QtyAmountCell qty={row.paid_qty} amount={row.paid_amount} currency={currency} />
                  <QtyAmountCell qty={row.unpaid_qty} amount={row.unpaid_amount} currency={currency} />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      )}
    </div>
  );
}

function formatShiftLabel(shift) {
  if (!shift) return 'Shift';
  const start = formatDateTime(shift.clock_in);
  if (shift.is_active) return `Ouvert — ${start}`;
  const end = shift.clock_out ? formatDateTime(shift.clock_out) : '—';
  return `${start} → ${end}`;
}

export default function WaiterDailyClosePage() {
  const { user, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const [dateStr, setDateStr] = useState(todayDateString());
  const [targetUserId, setTargetUserId] = useState('');
  const [shiftOptions, setShiftOptions] = useState([]);
  const [selectedShiftId, setSelectedShiftId] = useState('');
  const [loadingShifts, setLoadingShifts] = useState(false);
  const [waiters, setWaiters] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingWaiters, setLoadingWaiters] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const canSelectTarget = canSelectWaiterDailyCloseTarget(user);
  const effectiveUserId = canSelectTarget ? (targetUserId || user?._id) : user?._id;

  const loadWaiters = useCallback(async () => {
    if (!canSelectTarget) return;
    setLoadingWaiters(true);
    try {
      const res = await client.get('/analytics/staff-report/users', {
        params: { role_key: 'waiter' },
      });
      setWaiters(res.data.data || []);
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur chargement serveurs');
    } finally {
      setLoadingWaiters(false);
    }
  }, [canSelectTarget]);

  useEffect(() => {
    const fromUrl = searchParams.get('user_id');
    if (fromUrl && canSelectTarget) {
      setTargetUserId(fromUrl);
    }
  }, [searchParams, canSelectTarget]);

  useEffect(() => {
    if (!canSelectTarget || loadingWaiters) return;
    if (user?.role?.role_key === 'waiter') {
      setTargetUserId(user._id);
      return;
    }
    if (waiters.length && !waiters.find((entry) => entry._id === targetUserId)) {
      setTargetUserId(waiters[0]._id);
    }
  }, [canSelectTarget, loadingWaiters, waiters, targetUserId, user]);

  const loadShiftOptions = useCallback(async (userId) => {
    if (!userId) return;
    setLoadingShifts(true);
    try {
      const params = {};
      if (canSelectTarget && userId !== user?._id) {
        params.user_id = userId;
      }
      const res = await client.get('/shifts/waiter-close-options', { params });
      const rows = res.data.data || [];
      setShiftOptions(rows);
      const defaultId = res.data.meta?.default_shift_id || rows[0]?._id || '';
      setSelectedShiftId((prev) => (
        rows.find((row) => row._id === prev)?._id || defaultId
      ));
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur chargement shifts');
      setShiftOptions([]);
      setSelectedShiftId('');
    } finally {
      setLoadingShifts(false);
    }
  }, [canSelectTarget, user?._id]);

  const load = useCallback(async (userId, shiftId) => {
    if (!userId) return;
    setLoading(true);
    try {
      const params = {};
      if (shiftId) {
        params.shift_id = shiftId;
      } else {
        params.date = dateStr || undefined;
      }
      if (canSelectTarget && userId !== user?._id) {
        params.user_id = userId;
      }
      const res = await client.get('/shifts/waiter-daily-close', { params });
      setReport(res.data.data);
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur chargement');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [canSelectTarget, user?._id, dateStr]);

  useEffect(() => {
    if (canSelectTarget) {
      loadWaiters();
    }
  }, [canSelectTarget, loadWaiters]);

  useEffect(() => {
    if (canViewWaiterDailyClose(user) && effectiveUserId) {
      loadShiftOptions(effectiveUserId);
    }
  }, [user, effectiveUserId, loadShiftOptions]);

  useEffect(() => {
    if (canViewWaiterDailyClose(user) && effectiveUserId && !loadingShifts) {
      if (shiftOptions.length && selectedShiftId) {
        load(effectiveUserId, selectedShiftId);
      } else if (!shiftOptions.length) {
        load(effectiveUserId, null);
      }
    }
  }, [user, effectiveUserId, selectedShiftId, shiftOptions.length, loadingShifts, load]);

  const waiterOptions = useMemo(() => {
    const entries = waiters.map((entry) => ({
      value: entry._id,
      label: entry.fullname,
    }));
    if (
      canSelectTarget
      && user?._id
      && !entries.find((entry) => entry.value === user._id)
    ) {
      entries.unshift({ value: user._id, label: `${user.fullname} (moi)` });
    }
    return entries;
  }, [canSelectTarget, user, waiters]);

  const shiftComboboxOptions = useMemo(
    () => shiftOptions.map((shift) => ({
      value: shift._id,
      label: formatShiftLabel(shift),
    })),
    [shiftOptions],
  );

  const buildParams = () => {
    const params = selectedShiftId
      ? { shift_id: selectedShiftId }
      : { date: dateStr || undefined };
    if (canSelectTarget && effectiveUserId !== user?._id) {
      params.user_id = effectiveUserId;
    }
    return params;
  };

  const handlePrint = async () => {
    setPrinting(true);
    try {
      const body = buildParams();
      await client.post('/shifts/waiter-daily-close/print', body);
      message.success('Rapport envoyé à l\'imprimante caisse');
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur impression');
    } finally {
      setPrinting(false);
    }
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      const params = buildParams();
      const slug = (report?.waiter?.fullname || 'serveur').replace(/\s+/g, '-').toLowerCase();
      await downloadPdf(
        '/shifts/waiter-daily-close.pdf',
        params,
        `cloture-jour-${slug}-${dateStr}.pdf`,
      );
      message.success('PDF téléchargé');
    } catch (err) {
      message.error(err.message || 'Erreur export PDF');
    } finally {
      setExportingPdf(false);
    }
  };

  if (authLoading) {
    return <CardLoading />;
  }

  if (!canViewWaiterDailyClose(user)) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Accès non autorisé.</p>
        </CardContent>
      </Card>
    );
  }

  const orders = report?.orders || {};
  const items = report?.items || {};
  const currency = report?.currency || 'MAD';

  const selectedWaiterLabel =
    waiterOptions.find((entry) => entry.value === (targetUserId || user?._id))?.label
    || report?.waiter?.fullname
    || user?.fullname;
  const selectedShift = shiftOptions.find((s) => s._id === selectedShiftId);
  const toolbarSummary = [
    selectedShift ? formatShiftLabel(selectedShift) : formatDateLong(dateStr),
    canSelectTarget ? selectedWaiterLabel : null,
  ].filter(Boolean).join(' · ');

  return (
    <Card>
      <CardContent className="space-y-6 pt-4">
        <CollapsibleToolbar title="Clôture du jour" summary={toolbarSummary}>
          <div className="daily-close-toolbar-grid">
            <div
              className={cn(
                'daily-close-toolbar-grid__filters',
                !canSelectTarget && 'daily-close-toolbar-grid__filters--single',
              )}
            >
              {canSelectTarget ? (
                <Combobox
                  options={waiterOptions}
                  value={targetUserId || user?._id}
                  onValueChange={setTargetUserId}
                  placeholder="Serveur"
                  disabled={loadingWaiters || !waiterOptions.length}
                  className="w-full"
                />
              ) : null}
              {shiftComboboxOptions.length ? (
                <Combobox
                  options={shiftComboboxOptions}
                  value={selectedShiftId}
                  onValueChange={setSelectedShiftId}
                  placeholder="Shift"
                  disabled={loadingShifts || !shiftComboboxOptions.length}
                  className="w-full"
                />
              ) : (
                <DatePicker value={dateStr} onChange={setDateStr} className="w-full" />
              )}
            </div>
            <div className="daily-close-toolbar-grid__actions">
              <Button
                variant="outline"
                className="w-full"
                disabled={loading || exportingPdf || !report}
                onClick={handleExportPdf}
              >
                {exportingPdf ? <Loader2 className="size-4 animate-spin" /> : 'PDF'}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                disabled={loading || printing || !report}
                onClick={handlePrint}
              >
                {printing ? <Loader2 className="size-4 animate-spin" /> : 'Imprimer Caisse'}
              </Button>
            </div>
          </div>
        </CollapsibleToolbar>

        {loading ? (
          <CardLoading />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{report?.waiter?.fullname || user?.fullname}</Badge>
              {report?.date && (
                <span className="text-sm text-muted-foreground">
                  {formatDateLong(report.date)}
                </span>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                label="Encaissé (payé)"
                value={formatAmount(items.earned_amount, currency)}
              />
              <StatCard
                label="Impayé"
                value={formatAmount(items.unpaid_amount, currency)}
              />
              <StatCard
                label="Total perdu"
                value={formatAmount(items.lost_amount, currency)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Commandes envoyées" value={orders.sent ?? 0} />
              <StatCard label="Commandes annulées" value={orders.canceled ?? 0} />
              <StatCard label="Commandes impayées" value={orders.unpaid ?? 0} />
              <StatCard label="Commandes payées" value={orders.paid ?? 0} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                label="CA commandes envoyées"
                value={formatAmount(orders.total_amount, currency)}
              />
              <StatCard
                label="Montant commandes annulées"
                value={formatAmount(orders.canceled_amount, currency)}
              />
              <StatCard
                label="Montant articles commandés"
                value={formatAmount(items.ordered_amount, currency)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Articles envoyés" value={items.sent_total ?? 0} />
              <StatCard label="Articles payés" value={items.paid_total ?? 0} />
              <StatCard label="Articles impayés" value={items.unpaid_total ?? 0} />
              <StatCard label="Articles retournés" value={items.returned_total ?? 0} />
            </div>

            <ItemDetailTable
              title={selectedShiftId ? 'Détail par article (shift)' : 'Détail par article (jour)'}
              rows={items.detail_by_name}
              currency={currency}
              emptyLabel={selectedShiftId
                ? 'Aucun article pour ce shift.'
                : 'Aucun article ce jour.'}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
