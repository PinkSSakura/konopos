import React, { useState } from 'react';
import { DatabaseBackup, Download, Loader2 } from 'lucide-react';
import { message } from '@/lib/toast';
import { PageShell } from '../../components/layout/PageShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import client from '../../api/client';

function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export default function BackupPage() {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await client.get('/admin/backup/export', { responseType: 'blob' });
      const disposition = res.headers['content-disposition'] || '';
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] || `TouDev-backup-${Date.now()}.zip`;
      downloadBlob(res.data, filename);
      message.success('Sauvegarde téléchargée');
    } catch (err) {
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          message.error(parsed.message || 'Export impossible');
        } catch {
          message.error('Export impossible');
        }
      } else {
        message.error(err.response?.data?.message || 'Export impossible');
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <PageShell
      title="Sauvegarde"
      subtitle="Export manuel de la base SQLite et des fichiers uploadés (réservé super admin)."
    >
      <Card className="max-w-2xl">
        <CardHeader>
          <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-[var(--brand-charcoal)] text-[var(--brand-charcoal-foreground)]">
            <DatabaseBackup className="size-5" aria-hidden />
          </div>
          <CardTitle>Exporter une sauvegarde</CardTitle>
          <CardDescription>
            Télécharge un fichier ZIP contenant la base locale et le dossier uploads.
            Une sauvegarde automatique est aussi créée avant chaque mise à jour de schéma
            (3 dernières conservées dans le dossier données).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button disabled={exporting} onClick={handleExport}>
            {exporting ? (
              <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
            ) : (
              <Download className="size-4" data-icon="inline-start" />
            )}
            Télécharger la sauvegarde
          </Button>
        </CardContent>
      </Card>
    </PageShell>
  );
}
