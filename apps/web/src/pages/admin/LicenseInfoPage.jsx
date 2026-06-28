import React from 'react';
import { KeyRound } from 'lucide-react';
import { useLicense } from '../../context/LicenseContext';
import { PageShell, PageTableCard } from '../../components/layout/PageShell';
import { Badge } from '@/components/ui/badge';
import { InlineLoading } from '../../components/loading/LoadingStates';
import useLicenseCountdown from '../../hooks/useLicenseCountdown';
import {
  formatLicenseDate,
  getLicenseStatusLabel,
} from '../../utils/licenseDisplay';

export default function LicenseInfoPage() {
  const { status, loading, valid } = useLicense();
  const { countdown, expired } = useLicenseCountdown(status);

  if (loading) {
    return (
      <PageShell title="Licence" subtitle="Informations sur la licence KonoPOS de cette installation.">
        <InlineLoading label="Chargement de la licence…" />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Licence"
      subtitle="Informations sur la licence KonoPOS de cette installation."
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <PageTableCard title="État de la licence">
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <KeyRound className="size-4 text-muted-foreground" />
              <span className="text-muted-foreground">Statut</span>
              <Badge variant={valid && !expired ? 'secondary' : 'destructive'}>
                {getLicenseStatusLabel(status)}
              </Badge>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground">Empreinte</p>
                <p className="break-all font-mono text-xs">{status?.fingerprint || '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Code</p>
                <p className="font-medium">{status?.code || '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Période</p>
                <p className="font-medium">{status?.period_label || '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Expiration</p>
                <p className="font-medium">
                  {status?.lifetime && status?.valid
                    ? 'Illimitée (à vie)'
                    : formatLicenseDate(status?.expires_at)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Jours restants</p>
                <p className="font-medium">
                  {status?.days_remaining != null ? status.days_remaining : '—'}
                </p>
              </div>
            </div>

            {status?.expires_at ? (
              <div className="rounded-lg border border-border bg-muted/30 p-4 text-center">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Temps restant</p>
                <p className="mt-1 font-mono text-3xl font-semibold tabular-nums tracking-tight">
                  {countdown || '00:00:00'}
                </p>
              </div>
            ) : null}
          </div>
        </PageTableCard>
      </div>
    </PageShell>
  );
}
