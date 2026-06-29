import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlayCircle, ClipboardCheck } from 'lucide-react';
import { message } from '@/lib/toast';
import client from '../../api/client';
import { todayDateString, formatDateTime, formatDate } from '../../utils/dateFilters';
import { downloadPdf } from '../../utils/pdfExport';
import DatePicker from '../../components/DatePicker';
import CollapsibleToolbar from '../../components/layout/CollapsibleToolbar';
import { CardLoading } from '../../components/loading/LoadingStates';
import { useAuth } from '../../context/AuthContext';
import { useShift } from '../../context/ShiftContext';
import { getPostShiftStartRoute } from '../../utils/shiftGate';
import { canViewWaiterDailyClose } from '../../utils/shiftAccess';
import { endStaffSessionToPin, shouldEndPinSessionOnly } from '../../utils/pinSession';
import AppSelect from '@/components/ui/AppSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const PERIODS = [
  { value: 'day', label: 'Jour' },
  { value: 'week', label: 'Semaine' },
  { value: 'month', label: 'Mois' },
  { value: 'year', label: 'Année' },
];

function fmtMoney(v, currency = 'MAD') {
  return `${Number(v || 0).toFixed(2)} ${currency}`;
}

function fmtHours(h) {
  return `${Number(h || 0).toFixed(2)} h`;
}

function shiftSourceLabel(source) {
  if (source === 'systempos') return 'SystemPOS (auto)';
  if (source === 'auto') return 'Automatique';
  return 'Manuel';
}

function DetailGrid({ items }) {
  return (
    <dl className="grid gap-3 rounded-lg border text-sm">
      {items.map(({ label, value }) => (
        <div key={label} className="grid grid-cols-[140px_1fr] gap-2 border-b px-3 py-2 last:border-b-0">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function ShiftPage() {
  const { user, logout, logoutPinSession, refreshUser, isPinSession } = useAuth();
  const navigate = useNavigate();
  const { activeShift, refreshShift, shiftMeta } = useShift();
  const roleKey = user?.role?.role_key;

  const requiresAmounts = roleKey === 'waiter';

  const [history, setHistory] = useState([]);
  const [historyMeta, setHistoryMeta] = useState(null);
  const [summary, setSummary] = useState(null);
  const [period, setPeriod] = useState('day');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const historyPageSize = 10;
  const [reportDate, setReportDate] = useState(todayDateString());
  const [closeShiftId, setCloseShiftId] = useState('');
  const [closeShiftOptions, setCloseShiftOptions] = useState([]);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [dailyClose, setDailyClose] = useState(null);
  const [loadingDailyClose, setLoadingDailyClose] = useState(false);
  const [openingAmount, setOpeningAmount] = useState('');
  const [closingAmount, setClosingAmount] = useState('');

  const manualStartRequired = shiftMeta?.manual_start_required ?? true;
  const autoShift = shiftMeta?.auto_shift ?? false;
  const usesDailyCloseExport = roleKey === 'waiter' || canViewWaiterDailyClose(user);

  const loadDailyClose = useCallback(async () => {
    if (!usesDailyCloseExport) return;
    setLoadingDailyClose(true);
    try {
      const params = closeShiftId
        ? { shift_id: closeShiftId }
        : { date: reportDate || undefined };
      const res = await client.get('/shifts/waiter-daily-close', { params });
      setDailyClose(res.data.data);
    } catch (err) {
      setDailyClose(null);
      message.error(err.response?.data?.message || 'Erreur chargement clôture du jour');
    } finally {
      setLoadingDailyClose(false);
    }
  }, [reportDate, closeShiftId, usesDailyCloseExport]);

  const loadCloseShiftOptions = useCallback(async () => {
    if (!usesDailyCloseExport) return;
    try {
      const res = await client.get('/shifts/waiter-close-options');
      const rows = res.data.data || [];
      setCloseShiftOptions(rows);
      const defaultId = res.data.meta?.default_shift_id || rows[0]?._id || '';
      setCloseShiftId((prev) => rows.find((r) => r._id === prev)?._id || defaultId);
    } catch {
      setCloseShiftOptions([]);
    }
  }, [usesDailyCloseExport]);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const [historyRes, summaryRes] = await Promise.all([
        client.get('/shifts/history/me', {
          params: { period, page: historyPage, limit: historyPageSize },
        }),
        client.get('/shifts/daily-summary/me', { params: { period } }),
      ]);
      setHistory(historyRes.data.data || []);
      setHistoryMeta(historyRes.data.meta || null);
      setSummary(summaryRes.data.data || null);
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur chargement historique');
    } finally {
      setLoading(false);
    }
  }, [period, historyPage, historyPageSize]);

  const onPeriodChange = (value) => {
    if (!value) return;
    setHistoryPage(1);
    setPeriod(value);
  };

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    loadCloseShiftOptions();
  }, [loadCloseShiftOptions]);

  useEffect(() => {
    loadDailyClose();
  }, [loadDailyClose]);

  const refreshSummary = async () => {
    await Promise.all([loadHistory(), loadDailyClose()]);
  };

  const openShift = async (event) => {
    event.preventDefault();
    if (requiresAmounts && openingAmount === '') {
      message.warning('Montant requis');
      return;
    }
    setSubmitting(true);
    try {
      const res = await client.post('/shifts/start', {
        opening_amount: requiresAmounts ? Number(openingAmount || 0) : 0,
      });
      message.success('Shift ouvert');
      setOpeningAmount('');
      await refreshShift();
      await loadHistory();
      if (res.data?.meta?.redirect_to_pin && isPinSession) {
        await endStaffSessionToPin({ logoutPinSession, refreshUser, user });
        return;
      }
      navigate(getPostShiftStartRoute(roleKey));
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur ouverture shift');
    } finally {
      setSubmitting(false);
    }
  };

  const closeShift = async (values = {}) => {
    setSubmitting(true);
    try {
      const res = await client.post('/shifts/close', {
        closing_amount: requiresAmounts ? Number(values.closing_amount ?? closingAmount ?? 0) : 0,
      });
      const printMeta = res.data?.meta?.daily_close_print;
      if (printMeta?.printed) {
        message.success('Shift clôturé — clôture du jour imprimée à la caisse');
      } else if (printMeta?.skipped && user?.role?.role_key === 'waiter') {
        message.warning(`Shift clôturé — impression non envoyée (${printMeta.reason || 'caisse indisponible'})`);
      } else {
        message.success('Shift clôturé');
      }
      setClosingAmount('');
      await refreshShift();
      await loadHistory();
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur clôture shift');
    } finally {
      setSubmitting(false);
    }
  };

  const canPrintSummary = useMemo(() => Boolean(summary), [summary]);

  const exportMyReportPdf = async () => {
    setExportingPdf(true);
    try {
      if (usesDailyCloseExport) {
        const slug = (user?.fullname || 'serveur').replace(/\s+/g, '-').toLowerCase();
        await downloadPdf(
          '/shifts/waiter-daily-close.pdf',
          closeParams,
          `cloture-jour-${slug}-${closeShiftId || reportDate}.pdf`,
        );
      } else {
        await downloadPdf(
          '/analytics/export/staff.pdf',
          { mode: 'person', date: reportDate },
          `rapport-personnel-${reportDate}.pdf`,
        );
      }
      message.success('Rapport PDF téléchargé');
    } catch (err) {
      message.error(err.message || 'Erreur export PDF');
    } finally {
      setExportingPdf(false);
    }
  };

  const closeParams = useMemo(
    () => (closeShiftId ? { shift_id: closeShiftId } : { date: reportDate }),
    [closeShiftId, reportDate],
  );

  const closeShiftSelectOptions = useMemo(
    () => closeShiftOptions.map((shift) => ({
      value: shift._id,
      label: shift.is_active
        ? `Ouvert — ${formatDateTime(shift.clock_in)}`
        : `${formatDateTime(shift.clock_in)} → ${shift.clock_out ? formatDateTime(shift.clock_out) : '—'}`,
    })),
    [closeShiftOptions],
  );
  const dailyCloseOrders = dailyClose?.orders || {};
  const dailyCloseItems = dailyClose?.items || {};
  const dailyCloseCurrency = dailyClose?.currency || 'MAD';

  const showWaiterAdminGate = roleKey === 'waiter' && !activeShift;
  const showStartForm = manualStartRequired && !activeShift && roleKey !== 'waiter';
  const showCloseForm = Boolean(activeShift) && manualStartRequired;

  const periodToggle = (
    <ToggleGroup
      type="single"
      size="sm"
      value={period}
      onValueChange={onPeriodChange}
    >
      {PERIODS.map((p) => (
        <ToggleGroupItem key={p.value} value={p.value}>
          {p.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );

  return (
    <div className="flex w-full flex-col gap-6">
      {canViewWaiterDailyClose(user) && (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Clôture du jour</p>
              <p className="text-sm text-muted-foreground">
                Consultez, exportez PDF ou imprimez le récapitulatif journalier (commandes et articles).
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate('/shift/daily-close')}>
              <ClipboardCheck className="size-4" />
              Ouvrir clôture du jour
            </Button>
          </CardContent>
        </Card>
      )}
      {showWaiterAdminGate ? (
        <div className="shift-start-gate">
          <Card className="shift-start-gate__card border-0 shadow-none">
            <CardContent className="flex flex-col items-center px-6 py-8 text-center">
              <PlayCircle className="shift-start-gate__icon size-12 text-[var(--brand-primary)]" />
              <h2 className="mb-2 mt-2 text-xl font-semibold">Shift non démarré</h2>
              <p className="mb-2 max-w-md text-muted-foreground">
                Demandez à un administrateur (manager, responsable ou superadmin) de démarrer
                votre shift depuis <strong>Shifts en service</strong>.
              </p>
              <p className="text-sm text-muted-foreground">
                Le point de vente et le service sont indisponibles tant que votre shift n&apos;est pas ouvert.
              </p>
            </CardContent>
          </Card>
        </div>
      ) : showStartForm ? (
        <div className="shift-start-gate">
          <Card className="shift-start-gate__card border-0 shadow-none">
            <CardContent className="flex flex-col items-center px-6 py-8 text-center">
              <PlayCircle className="shift-start-gate__icon size-12 text-[var(--brand-primary)]" />
              <h2 className="mb-2 mt-2 text-xl font-semibold">Démarrer votre shift</h2>
              <p className="mb-6 max-w-md text-muted-foreground">
                Ouvrez votre shift pour accéder au point de vente et aux actions de service.
                L&apos;historique reste consultable ci-dessous.
              </p>
              <form onSubmit={openShift} className="w-full max-w-sm space-y-4">
                {requiresAmounts && (
                  <div className="space-y-2 text-left">
                    <Label htmlFor="opening_amount">Fond de caisse départ</Label>
                    <Input
                      id="opening_amount"
                      type="number"
                      min={0}
                      step="0.01"
                      size="lg"
                      value={openingAmount}
                      onChange={(e) => setOpeningAmount(e.target.value)}
                      required
                    />
                  </div>
                )}
                <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                  {submitting ? 'Ouverture…' : 'Démarrer le shift'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            {loading && !activeShift ? (
              <CardLoading />
            ) : (
              <>
                <h2 className="mb-4 text-xl font-semibold">Mon shift</h2>

                {autoShift && !manualStartRequired && (
                  <p className="mb-4 text-muted-foreground">
                    Mode automatique : le shift démarre à la connexion et reste ouvert jusqu&apos;à clôture manuelle.
                  </p>
                )}

                {activeShift ? (
                  <>
                    <DetailGrid
                      items={[
                        {
                          label: 'Statut',
                          value: <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Ouvert</Badge>,
                        },
                        {
                          label: 'Type',
                          value: <Badge variant="outline">{shiftSourceLabel(activeShift.source)}</Badge>,
                        },
                        {
                          label: 'Début',
                          value: formatDateTime(activeShift.clock_in),
                        },
                        ...(requiresAmounts
                          ? [{ label: 'Fond de caisse départ', value: fmtMoney(activeShift.opening_amount) }]
                          : []),
                      ]}
                    />

                    {showCloseForm ? (
                      <form
                        className="mt-4 space-y-4"
                        onSubmit={(e) => {
                          e.preventDefault();
                          closeShift({ closing_amount: closingAmount });
                        }}
                      >
                        {requiresAmounts && (
                          <div className="space-y-2">
                            <Label htmlFor="closing_amount">Montant clôture</Label>
                            <Input
                              id="closing_amount"
                              type="number"
                              min={0}
                              step="0.01"
                              value={closingAmount}
                              onChange={(e) => setClosingAmount(e.target.value)}
                              required
                            />
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <Button type="submit" disabled={submitting}>
                            {submitting ? 'Clôture…' : 'Clôturer le shift'}
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            disabled={submitting}
                            onClick={async () => {
                              await closeShift(requiresAmounts ? { closing_amount: closingAmount || 0 } : {});
                              if (shouldEndPinSessionOnly(user, isPinSession)) {
                                await endStaffSessionToPin({ logoutPinSession, refreshUser, user });
                              } else {
                                await logout();
                                navigate('/login');
                              }
                            }}
                          >
                            Clôturer et se déconnecter
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <p className="mt-4 text-muted-foreground">
                        Shift actif — clôturez-le manuellement en fin de service.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground">Aucun shift actif.</p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle>{usesDailyCloseExport ? 'Clôture du jour' : 'Résumé'}</CardTitle>
          {!usesDailyCloseExport && periodToggle}
        </CardHeader>
        <CardContent>
          {usesDailyCloseExport ? (
            <CollapsibleToolbar
              title="Options"
              summary={closeShiftSelectOptions.find((o) => o.value === closeShiftId)?.label || formatDate(reportDate)}
              className="mb-4"
            >
              <div className="collapsible-toolbar__actions">
                {closeShiftSelectOptions.length ? (
                  <AppSelect
                    value={closeShiftId}
                    onChange={setCloseShiftId}
                    options={closeShiftSelectOptions}
                    placeholder="Shift"
                    className="w-full sm:w-[280px]"
                  />
                ) : (
                  <DatePicker value={reportDate} onChange={setReportDate} className="w-full sm:w-[160px]" />
                )}
                <div className="collapsible-toolbar__primary">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={refreshSummary}
                    disabled={loading || loadingDailyClose}
                  >
                    Actualiser
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={async () => {
                      try {
                        await client.post('/shifts/waiter-daily-close/print', closeParams);
                        message.success('Rapport envoyé à l\'imprimante caisse');
                      } catch (err) {
                        message.error(err.response?.data?.message || 'Erreur impression');
                      }
                    }}
                  >
                    Imprimer (caisse)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={exportMyReportPdf}
                    disabled={exportingPdf}
                  >
                    Exporter PDF (jour)
                  </Button>
                </div>
              </div>
            </CollapsibleToolbar>
          ) : (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={refreshSummary}
                disabled={loading || loadingDailyClose}
              >
                Actualiser
              </Button>
              {canPrintSummary && (
                <Button variant="outline" size="sm" onClick={() => window.print()}>
                  Imprimer
                </Button>
              )}
              <DatePicker value={reportDate} onChange={setReportDate} className="w-[160px]" />
              <Button variant="outline" size="sm" onClick={exportMyReportPdf} disabled={exportingPdf}>
                Exporter PDF (jour)
              </Button>
            </div>
          )}
          {usesDailyCloseExport ? (
            loadingDailyClose ? (
              <CardLoading />
            ) : !dailyClose ? (
              <p className="text-muted-foreground">Aucune donnée pour cette date.</p>
            ) : (
              <div className="space-y-4">
                <DetailGrid
                  items={[
                    { label: 'Date', value: formatDate(dailyClose.date) },
                    { label: 'Commandes envoyées', value: dailyCloseOrders.sent ?? 0 },
                    { label: 'Commandes annulées', value: dailyCloseOrders.canceled ?? 0 },
                    { label: 'Commandes payées', value: dailyCloseOrders.paid ?? 0 },
                    { label: 'Commandes impayées', value: dailyCloseOrders.unpaid ?? 0 },
                    {
                      label: 'CA commandes',
                      value: fmtMoney(dailyCloseOrders.total_amount, dailyCloseCurrency),
                    },
                    {
                      label: 'Encaissé (payé)',
                      value: fmtMoney(dailyCloseItems.earned_amount, dailyCloseCurrency),
                    },
                    {
                      label: 'Impayé',
                      value: fmtMoney(dailyCloseItems.unpaid_amount, dailyCloseCurrency),
                    },
                    {
                      label: 'Total perdu',
                      value: fmtMoney(dailyCloseItems.lost_amount, dailyCloseCurrency),
                    },
                    { label: 'Articles envoyés', value: dailyCloseItems.sent_total ?? 0 },
                    { label: 'Articles payés', value: dailyCloseItems.paid_total ?? 0 },
                    { label: 'Articles impayés', value: dailyCloseItems.unpaid_total ?? 0 },
                    { label: 'Articles retournés', value: dailyCloseItems.returned_total ?? 0 },
                  ]}
                />
                {(dailyCloseItems.detail_by_name || dailyCloseItems.sent_by_name || []).length > 0 && (
                  <div className="rounded-lg border text-sm">
                    <p className="border-b px-3 py-2 font-medium">Détail par article</p>
                    <ul className="divide-y">
                      {(dailyCloseItems.detail_by_name || dailyCloseItems.sent_by_name || []).map((row) => (
                        <li
                          key={row.name}
                          className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 px-3 py-2"
                        >
                          <span className="font-medium">{row.name}</span>
                          <span className="text-right tabular-nums text-muted-foreground">
                            {row.ordered_qty != null ? (
                              <>
                                cmd {row.ordered_qty}
                                {row.returned_qty ? ` · ret ${row.returned_qty}` : ''}
                                {row.paid_qty ? ` · payé ${row.paid_qty}` : ''}
                                {row.unpaid_qty ? ` · imp ${row.unpaid_qty}` : ''}
                              </>
                            ) : (
                              <>x{row.quantity}</>
                            )}
                          </span>
                          <span className="col-span-2 text-right tabular-nums text-xs text-muted-foreground">
                            {row.ordered_amount != null ? (
                              <>
                                {fmtMoney(row.ordered_amount, dailyCloseCurrency)}
                                {row.paid_amount ? ` · payé ${fmtMoney(row.paid_amount, dailyCloseCurrency)}` : ''}
                                {row.unpaid_amount ? ` · imp ${fmtMoney(row.unpaid_amount, dailyCloseCurrency)}` : ''}
                              </>
                            ) : (
                              fmtMoney(row.amount, dailyCloseCurrency)
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )
          ) : !summary ? (
            <p className="text-muted-foreground">Aucune donnée.</p>
          ) : (
            <DetailGrid
              items={[
                { label: 'Période', value: PERIODS.find((p) => p.value === period)?.label || period },
                { label: 'Transactions', value: summary.count },
                { label: 'Total encaissé', value: fmtMoney(summary.total) },
                { label: 'Heures shift', value: fmtHours(summary.shift_hours) },
                { label: 'Shifts', value: summary.shift_count },
              ]}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle>Historique des shifts</CardTitle>
          {periodToggle}
        </CardHeader>
        <CardContent>
          {historyMeta?.total_hours != null && (
            <p className="mb-3 text-muted-foreground">
              Total période : {fmtHours(historyMeta.total_hours)} ({historyMeta.count} shift{historyMeta.count > 1 ? 's' : ''})
            </p>
          )}
          {history.length === 0 ? (
            <p className="text-muted-foreground">Aucun shift</p>
          ) : (
            <>
              <ul className="divide-y rounded-lg border">
                {history.map((s) => (
                  <li key={s._id} className="px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm">
                        {formatDateTime(s.clock_in)}
                        {' - '}
                        {s.clock_out ? formatDateTime(s.clock_out) : 'En cours'}
                      </span>
                      {s.source && <Badge variant="outline">{shiftSourceLabel(s.source)}</Badge>}
                      {s.auto_closed_reason && (
                        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                          Auto ({s.auto_closed_reason})
                        </Badge>
                      )}
                    </div>
                    {requiresAmounts && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Ouverture: {fmtMoney(s.opening_amount)} / Clôture: {fmtMoney(s.closing_amount)}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              {historyMeta?.total_pages > 1 && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground">
                    Page {historyMeta.page} / {historyMeta.total_pages}
                    {' '}({historyMeta.count} shift{historyMeta.count > 1 ? 's' : ''})
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={loading || historyMeta.page <= 1}
                      onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                    >
                      Précédent
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={loading || historyMeta.page >= historyMeta.total_pages}
                      onClick={() => setHistoryPage((p) => p + 1)}
                    >
                      Suivant
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
