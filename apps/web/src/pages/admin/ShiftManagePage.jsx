import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, PlayCircle, Square, RefreshCw } from 'lucide-react';
import { message } from '@/lib/toast';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useEstablishment } from '../../context/EstablishmentContext';
import { formatDateTime } from '../../utils/dateFilters';
import { isSuperAdmin } from '../../utils/permissions';
import { CardLoading } from '../../components/loading/LoadingStates';
import AppSelect from '@/components/ui/AppSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function ShiftManagePage() {
  const { user } = useAuth();
  const { establishment } = useEstablishment();
  const cashOptional = establishment?.shift_cash_optional === true;
  const superAdmin = isSuperAdmin(user);

  const [openShifts, setOpenShifts] = useState([]);
  const [waiters, setWaiters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [closingUserId, setClosingUserId] = useState(null);
  const [unpaidOrders, setUnpaidOrders] = useState(null);

  const [startUserId, setStartUserId] = useState('');
  const [openingAmount, setOpeningAmount] = useState('');
  const [shiftLabel, setShiftLabel] = useState('');

  const [closeUserId, setCloseUserId] = useState('');
  const [closingAmount, setClosingAmount] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [reassignShiftId, setReassignShiftId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [openRes, waitersRes] = await Promise.all([
        client.get('/shifts/open'),
        client.get('/analytics/staff-report/users', { params: { role_key: 'waiter' } }),
      ]);
      setOpenShifts(openRes.data.data || []);
      setWaiters(waitersRes.data.data || []);
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur chargement shifts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openWaiterIds = useMemo(
    () => new Set(openShifts.map((s) => String(s.waiter?._id))),
    [openShifts],
  );

  const waitersAvailable = useMemo(
    () => waiters.filter((w) => !openWaiterIds.has(String(w._id))),
    [waiters, openWaiterIds],
  );

  const waiterOptions = useMemo(
    () => waitersAvailable.map((w) => ({ value: w._id, label: w.fullname })),
    [waitersAvailable],
  );

  const openShiftOptions = useMemo(
    () => openShifts.map((s) => ({
      value: s.waiter?._id,
      label: s.waiter?.fullname || 'Serveur',
    })),
    [openShifts],
  );

  const reassignOptions = useMemo(
    () => openShifts
      .filter((s) => String(s.waiter?._id) !== String(closeUserId))
      .map((s) => ({ value: s._id, label: s.waiter?.fullname || 'Shift ouvert' })),
    [openShifts, closeUserId],
  );

  useEffect(() => {
    if (waitersAvailable.length && !waitersAvailable.find((w) => w._id === startUserId)) {
      setStartUserId(waitersAvailable[0]?._id || '');
    }
  }, [waitersAvailable, startUserId]);

  useEffect(() => {
    if (openShifts.length && !openShifts.find((s) => s.waiter?._id === closeUserId)) {
      setCloseUserId(openShifts[0]?.waiter?._id || '');
    }
    if (!openShifts.length) {
      setCloseUserId('');
    }
  }, [openShifts, closeUserId]);

  const startShift = async (event) => {
    event.preventDefault();
    if (!startUserId) {
      message.warning('Sélectionnez un serveur');
      return;
    }
    if (!cashOptional && openingAmount === '') {
      message.warning('Montant caisse de départ requis');
      return;
    }
    setStarting(true);
    try {
      await client.post('/shifts/start-for-user', {
        user_id: startUserId,
        opening_amount: openingAmount === '' ? 0 : Number(openingAmount),
        shift_label: shiftLabel || undefined,
      });
      message.success('Shift ouvert — le serveur peut prendre des commandes');
      setOpeningAmount('');
      setShiftLabel('');
      setUnpaidOrders(null);
      await load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur ouverture shift');
    } finally {
      setStarting(false);
    }
  };

  const closeShift = async (event, { force = false } = {}) => {
    event.preventDefault();
    if (!closeUserId) {
      message.warning('Sélectionnez un shift à clôturer');
      return;
    }
    if (!cashOptional && closingAmount === '' && !force) {
      message.warning('Montant caisse de clôture requis');
      return;
    }
    if (force && !reassignShiftId) {
      message.warning('Choisissez un shift pour réassigner les commandes impayées');
      return;
    }
    setClosingUserId(closeUserId);
    setUnpaidOrders(null);
    try {
      const res = await client.post('/shifts/close-for-user', {
        user_id: closeUserId,
        closing_amount: closingAmount === '' ? 0 : Number(closingAmount),
        notes: closeNotes || undefined,
        force,
        reassign_to_shift_id: force ? reassignShiftId : undefined,
      });
      message.success(res.data?.message || 'Shift clôturé');
      setClosingAmount('');
      setCloseNotes('');
      setReassignShiftId('');
      await load();
    } catch (err) {
      if (err.response?.data?.code === 'SHIFT_UNPAID_ORDERS') {
        setUnpaidOrders(err.response.data.data?.orders || []);
        message.error(err.response.data.message);
      } else {
        message.error(err.response?.data?.message || 'Erreur clôture shift');
      }
    } finally {
      setClosingUserId(null);
    }
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <Alert>
        <AlertTitle>Shifts en service</AlertTitle>
        <AlertDescription>
          Ouvrez ou fermez le shift actif d&apos;un serveur. Le planning (Admin → Planning shifts) est
          un calendrier prévisionnel et n&apos;ouvre pas de shift réel.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle>Shifts ouverts ({openShifts.length})</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className="mr-2 size-4" />
            Actualiser
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <CardLoading />
          ) : openShifts.length ? (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Serveur</TableHead>
                    <TableHead>Début</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Caisse départ</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {openShifts.map((shift) => (
                    <TableRow key={shift._id}>
                      <TableCell className="font-medium">{shift.waiter?.fullname || '—'}</TableCell>
                      <TableCell>{formatDateTime(shift.clock_in)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{shift.source || 'manual'}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number(shift.opening_amount || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="link" size="sm" asChild>
                          <Link to={`/shift/daily-close?user_id=${shift.waiter?._id}`}>
                            Clôture du jour
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Aucun shift ouvert pour le moment.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlayCircle className="size-5" />
              Ouvrir un shift
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={startShift}>
              <div className="space-y-2">
                <Label>Serveur</Label>
                <AppSelect
                  value={startUserId}
                  onChange={setStartUserId}
                  options={waiterOptions}
                  placeholder="Choisir un serveur…"
                  disabled={!waiterOptions.length || starting}
                />
                {!waiterOptions.length && !loading ? (
                  <p className="text-xs text-muted-foreground">
                    Tous les serveurs ont déjà un shift ouvert.
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label>
                  Caisse départ
                  {cashOptional ? ' (optionnel)' : ''}
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={openingAmount}
                  onChange={(e) => setOpeningAmount(e.target.value)}
                  placeholder={cashOptional ? 'Optionnel' : '0.00'}
                />
              </div>
              <div className="space-y-2">
                <Label>Libellé (optionnel)</Label>
                <Input
                  value={shiftLabel}
                  onChange={(e) => setShiftLabel(e.target.value)}
                  placeholder="Ex. soirée, terrasse…"
                />
              </div>
              <Button type="submit" disabled={starting || !startUserId}>
                {starting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Ouvrir le shift
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Square className="size-5" />
              Clôturer un shift
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!openShifts.length ? (
              <p className="text-sm text-muted-foreground">Aucun shift à clôturer.</p>
            ) : (
              <form className="space-y-4" onSubmit={closeShift}>
                <div className="space-y-2">
                  <Label>Serveur</Label>
                  <AppSelect
                    value={closeUserId}
                    onChange={setCloseUserId}
                    options={openShiftOptions}
                    placeholder="Choisir…"
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    Caisse clôture
                    {cashOptional ? ' (optionnel)' : ''}
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={closingAmount}
                    onChange={(e) => setClosingAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notes (optionnel)</Label>
                  <Input
                    value={closeNotes}
                    onChange={(e) => setCloseNotes(e.target.value)}
                  />
                </div>

                {unpaidOrders?.length ? (
                  <Alert variant="destructive">
                    <AlertTitle>Commandes impayées ({unpaidOrders.length})</AlertTitle>
                    <AlertDescription>
                      <ul className="mt-2 list-inside list-disc text-sm">
                        {unpaidOrders.map((o) => (
                          <li key={o._id}>
                            #
                            {o.order_number}
                            {' '}
                            —
                            {Number(o.total || 0).toFixed(2)}
                            {' '}
                            (
                            {o.payment_status}
                            )
                          </li>
                        ))}
                      </ul>
                      {superAdmin ? (
                        <div className="mt-4 space-y-2">
                          <Label>Réassigner vers un shift ouvert</Label>
                          <AppSelect
                            value={reassignShiftId}
                            onChange={setReassignShiftId}
                            options={reassignOptions}
                            placeholder="Shift cible…"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={Boolean(closingUserId)}
                            onClick={(e) => closeShift(e, { force: true })}
                          >
                            Forcer la clôture (superadmin)
                          </Button>
                        </div>
                      ) : (
                        <p className="mt-2 text-sm">
                          Encaissez ou annulez ces commandes avant de clôturer.
                        </p>
                      )}
                    </AlertDescription>
                  </Alert>
                ) : null}

                <Button
                  type="submit"
                  variant="secondary"
                  disabled={Boolean(closingUserId)}
                >
                  {closingUserId ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : null}
                  Clôturer le shift
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
