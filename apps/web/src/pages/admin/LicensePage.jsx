import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { KeyRound, Trash2 } from 'lucide-react';
import client from '../../api/client';
import { LICENSE_PERIOD_OPTIONS, MAX_CUSTOM_LICENSE_DAYS } from '../../constants/licensePeriods';
import { useEstablishment } from '../../context/EstablishmentContext';
import { useAuth } from '../../context/AuthContext';
import { useLicense } from '../../context/LicenseContext';
import { ESTABLISHMENT_CAP, hasEstablishmentCapability } from '../../utils/establishmentCapabilities';
import { formatDateTime } from '../../utils/dateFilters';

import { PageShell, PageTableCard } from '../../components/layout/PageShell';

import { Button } from '@/components/ui/button';

import { Badge } from '@/components/ui/badge';

import { Input } from '@/components/ui/input';

import { Label } from '@/components/ui/label';

import Combobox from '../../components/Combobox';

import { InlineLoading } from '../../components/loading/LoadingStates';
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

function computeCustomPreview({ mode, customDays, customExpiry }) {
  const now = new Date();
  if (mode === 'expires' && customExpiry) {
    const expiry = new Date(`${customExpiry}T23:59:59`);
    if (Number.isNaN(expiry.getTime()) || expiry.getTime() <= now.getTime()) return null;
    const days = Math.max(1, Math.ceil((expiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
    return { expiresAt: expiry, days };
  }
  const days = Number.parseInt(String(customDays), 10);
  if (mode === 'days' && Number.isFinite(days) && days >= 1) {
    const expiry = new Date(now.getTime());
    expiry.setUTCDate(expiry.getUTCDate() + days);
    return { expiresAt: expiry, days };
  }
  return null;
}

export default function LicensePage() {
  const navigate = useNavigate();

  const { status, loading, refresh: refreshLicense } = useLicense();

  const { refresh: refreshEstablishment } = useEstablishment();
  const { refreshUser } = useAuth();

  const [period, setPeriod] = useState('week');
  const [customMode, setCustomMode] = useState('expires');
  const [customDays, setCustomDays] = useState('');
  const [customExpiry, setCustomExpiry] = useState('');
  const [activating, setActivating] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const [revokeOpen, setRevokeOpen] = useState(false);



  const hasLicenseRecord = Boolean(status?.code && status.code !== 'LICENSE_MISSING');
  const isCustomPeriod = period === 'custom';
  const customPreview = useMemo(
    () => (isCustomPeriod ? computeCustomPreview({ mode: customMode, customDays, customExpiry }) : null),
    [isCustomPeriod, customMode, customDays, customExpiry]
  );

  const activate = async () => {
    if (!period) {
      toast.warning('Choisissez une période.');
      return;
    }

    const payload = { period };
    if (isCustomPeriod) {
      if (customMode === 'expires') {
        if (!customExpiry) {
          toast.warning('Indiquez la date de fin de licence.');
          return;
        }
        payload.expires_at = new Date(`${customExpiry}T23:59:59`).toISOString();
      } else {
        const days = Number.parseInt(String(customDays), 10);
        if (!Number.isFinite(days) || days < 1 || days > MAX_CUSTOM_LICENSE_DAYS) {
          toast.warning(`Indiquez un nombre de jours entre 1 et ${MAX_CUSTOM_LICENSE_DAYS}.`);
          return;
        }
        payload.days = days;
      }
    }

    setActivating(true);

    try {
      const res = await client.post('/license/activate', payload);
      await refreshLicense({ background: true });
      const access = await refreshUser();
      await refreshEstablishment();

      toast.success(res.data.message || 'Licence activée.');

      if (!hasEstablishmentCapability(access?.capabilities, ESTABLISHMENT_CAP.SETUP_COMPLETE)) {
        navigate('/admin/establishment', { replace: true });
      }

    } catch (err) {

      toast.error(err.response?.data?.message || 'Erreur activation');

    } finally {

      setActivating(false);

    }

  };



  const revoke = async () => {

    setRevoking(true);

    try {

      const res = await client.delete('/license/revoke');

      await refreshLicense({ background: true });

      setRevokeOpen(false);

      toast.success(res.data.message || 'Licence révoquée.');

    } catch (err) {

      toast.error(err.response?.data?.message || 'Erreur révocation');

    } finally {

      setRevoking(false);

    }

  };



  return (

    <PageShell

      title="Licence"

      subtitle="Activez TouDev pour cette machine. La licence est liée à l'empreinte matérielle du serveur."

    >

      {loading ? (

        <InlineLoading label="Chargement de la licence…" />

      ) : (

        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">

          <PageTableCard title="État de la licence">

            <div className="space-y-3 text-sm">

              <div className="flex flex-wrap items-center gap-2">

                <span className="text-muted-foreground">Statut</span>

                {status?.valid ? (

                  <Badge variant="secondary">Active</Badge>

                ) : (

                  <Badge variant="destructive">Inactive / expirée</Badge>

                )}

              </div>

              {status?.code && (

                <p>

                  <span className="text-muted-foreground">Code :</span>{' '}

                  <strong>{status.code}</strong>

                </p>

              )}

              {!status?.valid && status?.message ? (

                <p className="text-destructive">{status.message}</p>

              ) : null}

              {status?.period_label ? (

                <p>

                  <span className="text-muted-foreground">Période :</span>{' '}

                  <strong>{status.period_label}</strong>

                </p>

              ) : null}

              {status?.valid && status?.lifetime ? (

                <p>

                  <span className="text-muted-foreground">Expiration :</span>{' '}

                  <strong>Illimitée (à vie)</strong>

                </p>

              ) : status?.expires_at ? (

                <p>

                  <span className="text-muted-foreground">Expire le :</span>{' '}

                  <strong>{formatDateTime(status.expires_at)}</strong>

                  {!status.valid ? (

                    <span className="text-destructive"> (expirée)</span>

                  ) : status.days_remaining != null ? (

                    <span className="text-muted-foreground">

                      {' '}({status.days_remaining} jour{status.days_remaining > 1 ? 's' : ''} restant{status.days_remaining > 1 ? 's' : ''})

                    </span>

                  ) : null}

                </p>

              ) : null}

              {hasLicenseRecord && (

                <div className="pt-2">

                  <Button

                    type="button"

                    variant="destructive"

                    size="sm"

                    onClick={() => setRevokeOpen(true)}

                    disabled={revoking}

                  >

                    <Trash2 data-icon="inline-start" />

                    Révoquer la licence

                  </Button>

                  <p className="mt-2 text-xs text-muted-foreground">

                    Suppression définitive de la licence sur cette machine. L&apos;application sera bloquée jusqu&apos;à une nouvelle activation.

                  </p>

                </div>

              )}

            </div>

          </PageTableCard>



          <PageTableCard title="Activation pour cette machine" contentClassName="space-y-4">

            <div>

              <p className="mb-2 text-sm text-muted-foreground">Empreinte machine (hardware)</p>

              <code className="block break-all rounded-md border border-border bg-muted/40 p-3 text-xs">

                {status?.fingerprint}

              </code>

            </div>



            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Période de licence</p>
              <Combobox
                value={period}
                onValueChange={setPeriod}
                options={LICENSE_PERIOD_OPTIONS}
                placeholder="Choisir une période"
                className="w-full sm:max-w-xs"
              />
            </div>

            {isCustomPeriod ? (
              <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
                <div>
                  <p className="text-sm font-medium">Licence personnalisée</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Utile en cas de remplacement de machine : reprenez la date de fin de l&apos;ancienne licence
                    pour ne pas perdre le temps restant, ou saisissez le nombre de jours restants.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={customMode === 'expires' ? 'default' : 'outline'}
                    onClick={() => setCustomMode('expires')}
                  >
                    Date de fin
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={customMode === 'days' ? 'default' : 'outline'}
                    onClick={() => setCustomMode('days')}
                  >
                    Nombre de jours
                  </Button>
                </div>

                {customMode === 'expires' ? (
                  <div className="space-y-2">
                    <Label htmlFor="license-expiry">Expire le (fin de l&apos;ancienne licence)</Label>
                    <Input
                      id="license-expiry"
                      type="date"
                      value={customExpiry}
                      min={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setCustomExpiry(e.target.value)}
                      className="max-w-xs"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="license-days">Durée en jours</Label>
                    <Input
                      id="license-days"
                      type="number"
                      min={1}
                      max={MAX_CUSTOM_LICENSE_DAYS}
                      value={customDays}
                      onChange={(e) => setCustomDays(e.target.value)}
                      placeholder={`1 à ${MAX_CUSTOM_LICENSE_DAYS}`}
                      className="max-w-xs"
                    />
                  </div>
                )}

                {customPreview ? (
                  <p className="text-sm text-muted-foreground">
                    Aperçu : expire le{' '}
                    <strong>{formatDateTime(customPreview.expiresAt)}</strong>
                    {' '}({customPreview.days} jour{customPreview.days > 1 ? 's' : ''})
                  </p>
                ) : null}
              </div>
            ) : null}

            <Button
              type="button"
              onClick={activate}
              disabled={activating || !period || (isCustomPeriod && !customPreview)}
            >
              <KeyRound data-icon="inline-start" />

              {activating ? 'Activation…' : 'Générer et activer la licence'}

            </Button>



            <p className="text-xs text-muted-foreground">

              La licence signée est enregistrée sur ce serveur et valide uniquement pour cette machine.

              Renouvelez avant expiration pour éviter l&apos;interruption du service.

            </p>

          </PageTableCard>

        </div>

      )}



      <AlertDialog open={revokeOpen} onOpenChange={setRevokeOpen}>

        <AlertDialogContent>

          <AlertDialogHeader>

            <AlertDialogTitle>Révoquer la licence ?</AlertDialogTitle>

            <AlertDialogDescription>

              La licence sera supprimée définitivement de cette installation (suppression en base).

              Tous les utilisateurs perdront l&apos;accès jusqu&apos;à une nouvelle activation par le Super Admin.

            </AlertDialogDescription>

          </AlertDialogHeader>

          <AlertDialogFooter>

            <AlertDialogCancel disabled={revoking}>Annuler</AlertDialogCancel>

            <AlertDialogAction variant="destructive" onClick={revoke} disabled={revoking}>

              {revoking ? 'Révocation…' : 'Révoquer définitivement'}

            </AlertDialogAction>

          </AlertDialogFooter>

        </AlertDialogContent>

      </AlertDialog>

    </PageShell>

  );

}


