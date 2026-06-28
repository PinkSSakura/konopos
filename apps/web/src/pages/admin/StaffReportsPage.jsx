import React, { useCallback, useEffect, useState } from 'react';
import { FileDown } from 'lucide-react';
import { toast } from 'sonner';
import client from '../../api/client';
import DatePicker from '../../components/DatePicker';
import Combobox from '../../components/Combobox';
import { todayDateString } from '../../utils/dateFilters';
import { downloadPdf } from '../../utils/pdfExport';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const MODE_OPTIONS = [
  { value: 'full', label: 'Journée complète (toute l\'équipe)' },
  { value: 'role', label: 'Par rôle' },
  { value: 'person', label: 'Une personne' },
];

const ROLE_OPTIONS = [
  { value: 'waiter', label: 'Serveurs' },
  { value: 'manager', label: 'Managers' },
  { value: 'submanager', label: 'Sous-managers' },
  { value: 'cook', label: 'Cuisine' },
  { value: 'barman', label: 'Bar' },
];

export default function StaffReportsPage() {
  const [date, setDate] = useState(todayDateString());
  const [mode, setMode] = useState('full');
  const [roleKey, setRoleKey] = useState('waiter');
  const [userId, setUserId] = useState('');
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await client.get('/analytics/staff-report/users', {
        params: mode === 'role' ? { role_key: roleKey } : {},
      });
      const list = res.data.data || [];
      setUsers(list);
      if (list.length && !list.find((u) => u._id === userId)) {
        setUserId(list[0]._id);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur chargement personnel');
    } finally {
      setLoadingUsers(false);
    }
  }, [mode, roleKey, userId]);

  useEffect(() => {
    if (mode === 'person' || mode === 'role') {
      loadUsers();
    }
  }, [mode, roleKey, loadUsers]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = { date, mode };
      if (mode === 'role') params.role_key = roleKey;
      if (mode === 'person') params.user_id = userId;
      await downloadPdf('/analytics/export/staff.pdf', params, `rapport-personnel-${date}.pdf`);
      toast.success('PDF téléchargé');
    } catch (err) {
      toast.error(err.message || 'Erreur export PDF');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h2 className="text-xl font-semibold sm:text-2xl">Rapports personnel</h2>
        <p className="text-sm text-muted-foreground">
          Export PDF journalier 80 mm — équipe, par rôle ou par personne.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Export journalier</CardTitle>
          <CardDescription>Format thermique 80 mm avec en-tête légal.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">Date</p>
              <DatePicker value={date} onChange={setDate} className="w-full" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Type d&apos;export</p>
              <Combobox
                options={MODE_OPTIONS}
                value={mode}
                onValueChange={setMode}
                placeholder="Type"
                className="w-full"
              />
            </div>
          </div>

          {mode === 'role' && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Rôle</p>
              <Combobox
                options={ROLE_OPTIONS}
                value={roleKey}
                onValueChange={setRoleKey}
                placeholder="Rôle"
                className="w-full"
              />
            </div>
          )}

          {mode === 'person' && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Personne</p>
              <Combobox
                options={users.map((u) => ({
                  value: u._id,
                  label: `${u.fullname} (${u.role_name || u.role_key})`,
                }))}
                value={userId}
                onValueChange={setUserId}
                placeholder={loadingUsers ? 'Chargement…' : 'Sélectionner'}
                className="w-full"
                disabled={loadingUsers || !users.length}
              />
            </div>
          )}

          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={handleExport}
            disabled={exporting || (mode === 'person' && !userId)}
          >
            <FileDown className="mr-2 size-4" />
            {exporting ? 'Export…' : 'Exporter PDF'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
