import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { message } from '@/lib/toast';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import ShiftPlannerCalendar from '../../components/admin/ShiftPlannerCalendar';
import ListFilterBar from '../../components/ListFilterBar';
import TableListFilterBar from '../../components/TableListFilterBar';
import { CardLoading } from '../../components/loading/LoadingStates';
import SimpleTable from '@/components/data/SimpleTable';
import AppModal from '@/components/ui/AppModal';
import AppSelect from '@/components/ui/AppSelect';
import { tablePagination } from '../../utils/tablePagination';
import { defaultTodayRange, buildDateRangeParams, formatDateTime } from '../../utils/dateFilters';
import { rowMatchesSearch } from '../../utils/listSearch';
import {
  canCreateShiftPlan,
  canDeleteShiftPlan,
  canUpdateShiftPlan,
  canViewAllShifts,
  canViewShiftPlans,
} from '../../utils/shiftAccess';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const ROLE_OPTIONS = [
  { value: 'waiter', label: 'Serveur' },
  { value: 'cook', label: 'Cuisine' },
  { value: 'barman', label: 'Bar' },
];

function toDatetimeLocal(value) {
  if (!value) return '';
  return dayjs(value).format('YYYY-MM-DDTHH:mm');
}

export default function ShiftAdminPage() {
  const { user } = useAuth();
  const showPlans = canViewShiftPlans(user);
  const showAllShifts = canViewAllShifts(user);
  const canCreate = canCreateShiftPlan(user);
  const canUpdate = canUpdateShiftPlan(user);
  const canDelete = canDeleteShiftPlan(user);

  const [loading, setLoading] = useState(false);
  const [shifts, setShifts] = useState([]);
  const [plans, setPlans] = useState([]);
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deletePlanId, setDeletePlanId] = useState(null);
  const [weekStart, setWeekStart] = useState(() => dayjs().startOf('week'));

  const [dateFrom, setDateFrom] = useState(() => defaultTodayRange().from);
  const [dateTo, setDateTo] = useState(() => defaultTodayRange().to);

  const [shiftSearch, setShiftSearch] = useState('');
  const [shiftStatus, setShiftStatus] = useState(null);
  const [shiftApplied, setShiftApplied] = useState({ search: '', status: null });

  const [planUser, setPlanUser] = useState('');
  const [planStart, setPlanStart] = useState('');
  const [planEnd, setPlanEnd] = useState('');
  const [planNotes, setPlanNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const requests = [];
      const shiftParams = buildDateRangeParams(dateFrom, dateTo);
      const planParams = {
        from: weekStart.startOf('day').toISOString(),
        to: weekStart.add(6, 'day').endOf('day').toISOString(),
      };

      if (showAllShifts) {
        requests.push(client.get('/shift-admin/shifts', { params: shiftParams }));
      }
      if (showPlans) {
        requests.push(client.get('/shift-admin/plans', { params: planParams }));
        if (canCreate || canUpdate) {
          requests.push(client.get('/shift-admin/staff'));
        }
      }

      const results = await Promise.all(requests);
      let idx = 0;
      if (showAllShifts) {
        setShifts(results[idx++]?.data?.data || []);
      } else {
        setShifts([]);
      }
      if (showPlans) {
        setPlans(results[idx++]?.data?.data || []);
        if (canCreate || canUpdate) {
          setUsers(results[idx++]?.data?.data || []);
        } else {
          setUsers([]);
        }
      } else {
        setPlans([]);
        setUsers([]);
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur chargement shifts');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, weekStart, showAllShifts, showPlans, canCreate, canUpdate]);

  const filteredShifts = useMemo(() => shifts.filter((shift) => {
    if (!rowMatchesSearch(shift, shiftApplied.search, [
      (r) => r.user?.fullname,
      (r) => r.user?.role?.role_key,
      (r) => r.source,
    ])) return false;
    if (shiftApplied.status === 'active' && !shift.is_active) return false;
    if (shiftApplied.status === 'done' && shift.is_active) return false;
    return true;
  }), [shifts, shiftApplied]);

  useEffect(() => {
    load();
  }, [load]);

  const resetPlanForm = () => {
    setPlanUser('');
    setPlanStart('');
    setPlanEnd('');
    setPlanNotes('');
  };

  const openCreate = (start, end) => {
    if (!canCreate) return;
    setEditing(null);
    resetPlanForm();
    if (start && end) {
      setPlanStart(toDatetimeLocal(start));
      setPlanEnd(toDatetimeLocal(end));
    }
    setOpen(true);
  };

  const openEdit = (plan) => {
    if (!canUpdate) return;
    setEditing(plan);
    setPlanUser(plan.user?._id || '');
    setPlanStart(toDatetimeLocal(plan.planned_start));
    setPlanEnd(toDatetimeLocal(plan.planned_end));
    setPlanNotes(plan.notes || '');
    setOpen(true);
  };

  const onSavePlan = async () => {
    if (!planUser || !planStart || !planEnd) {
      message.warning('Remplissez les champs obligatoires');
      return;
    }
    try {
      const payload = {
        user: planUser,
        planned_start: dayjs(planStart).toDate(),
        planned_end: dayjs(planEnd).toDate(),
        notes: planNotes,
      };
      if (editing) await client.put(`/shift-admin/plans/${editing._id}`, payload);
      else await client.post('/shift-admin/plans', payload);
      message.success('Planning enregistré');
      setOpen(false);
      resetPlanForm();
      await load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur enregistrement planning');
    }
  };

  const confirmDeletePlan = async () => {
    if (!deletePlanId || !canDelete) return;
    try {
      await client.delete(`/shift-admin/plans/${deletePlanId}`);
      message.success('Planning supprimé');
      setOpen(false);
      setDeletePlanId(null);
      await load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur suppression');
    }
  };

  const updatePlanRange = async (planId, { planned_start, planned_end }) => {
    try {
      await client.put(`/shift-admin/plans/${planId}`, { planned_start, planned_end });
      message.success('Planning mis à jour');
      await load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur mise à jour planning');
    }
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <Alert>
        <AlertTitle>Planning prévisionnel</AlertTitle>
        <AlertDescription>
          Ce calendrier sert à planifier les créneaux. Pour ouvrir ou fermer un shift en service
          (commandes, clôture du jour), utilisez{' '}
          <Link to="/admin/shifts/manage" className="font-medium underline">
            Shifts en service
          </Link>
          .
        </AlertDescription>
      </Alert>

      {showPlans && (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
            <CardTitle>Planning shifts</CardTitle>
            {canCreate ? (
              <Button onClick={() => openCreate()}>Nouveau créneau</Button>
            ) : null}
          </CardHeader>
          <CardContent>
            {loading ? (
              <CardLoading />
            ) : (
              <ShiftPlannerCalendar
                plans={plans}
                weekStart={weekStart}
                onWeekChange={setWeekStart}
                onPlanClick={canUpdate ? openEdit : undefined}
                onRangeSelect={canCreate ? (start, end) => openCreate(start, end) : undefined}
                onPlanChange={canUpdate ? updatePlanRange : undefined}
              />
            )}
          </CardContent>
        </Card>
      )}

      {showAllShifts && (
        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <CardLoading />
            ) : (
              <>
                <ListFilterBar
                  from={dateFrom}
                  to={dateTo}
                  onFromChange={setDateFrom}
                  onToChange={setDateTo}
                  onApply={load}
                  onReset={({ from, to }) => {
                    setDateFrom(from);
                    setDateTo(to);
                  }}
                  loading={loading}
                />
                <h3 className="mb-4 mt-4 text-lg font-semibold">Shifts (actifs et terminés)</h3>
                <TableListFilterBar
                  search={shiftSearch}
                  onSearchChange={setShiftSearch}
                  searchPlaceholder="Employé, rôle, source…"
                  loading={loading}
                  onApply={() => setShiftApplied({ search: shiftSearch, status: shiftStatus })}
                  onReset={() => {
                    setShiftSearch('');
                    setShiftStatus(null);
                    setShiftApplied({ search: '', status: null });
                  }}
                  extra={(
                    <AppSelect
                      allowClear
                      placeholder="Statut"
                      style={{ width: 140 }}
                      value={shiftStatus}
                      onChange={setShiftStatus}
                      options={[
                        { value: 'active', label: 'Actif' },
                        { value: 'done', label: 'Terminé' },
                      ]}
                    />
                  )}
                />
                <SimpleTable
                  rowKey="_id"
                  dataSource={filteredShifts}
                  pagination={tablePagination}
                  columns={[
                    { title: 'Employé', render: (_, r) => r.user?.fullname || '—' },
                    { title: 'Rôle', render: (_, r) => r.user?.role?.role_key || '—' },
                    { title: 'Début', render: (_, r) => formatDateTime(r.clock_in) },
                    { title: 'Fin', render: (_, r) => formatDateTime(r.clock_out) },
                    {
                      title: 'Statut',
                      render: (_, r) => (
                        r.is_active
                          ? <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Actif</Badge>
                          : <Badge variant="outline">Terminé</Badge>
                      ),
                    },
                    { title: 'Source', dataIndex: 'source' },
                  ]}
                />
              </>
            )}
          </CardContent>
        </Card>
      )}

      <AppModal
        title={editing ? 'Modifier planning' : 'Nouveau planning'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={onSavePlan}
        okText="Enregistrer"
        footer={editing ? (
          <div className="flex w-full items-center justify-between gap-2">
            {canDelete ? (
              <Button variant="destructive" onClick={() => setDeletePlanId(editing._id)}>
                Supprimer
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button onClick={onSavePlan}>Enregistrer</Button>
            </div>
          </div>
        ) : undefined}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Employé</Label>
            <AppSelect
              value={planUser}
              onChange={setPlanUser}
              placeholder="Employé"
              options={users.map((u) => ({
                value: u._id,
                label: `${u.fullname} (${ROLE_OPTIONS.find((r) => r.value === u.role?.role_key)?.label || u.role?.role_key})`,
              }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="planned_start">Début prévu</Label>
            <Input
              id="planned_start"
              type="datetime-local"
              value={planStart}
              onChange={(e) => setPlanStart(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="planned_end">Fin prévue</Label>
            <Input
              id="planned_end"
              type="datetime-local"
              value={planEnd}
              onChange={(e) => setPlanEnd(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="plan_notes">Notes</Label>
            <Textarea
              id="plan_notes"
              rows={3}
              value={planNotes}
              onChange={(e) => setPlanNotes(e.target.value)}
            />
          </div>
        </div>
      </AppModal>

      <AlertDialog open={Boolean(deletePlanId)} onOpenChange={(next) => { if (!next) setDeletePlanId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce créneau ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDeletePlan}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
