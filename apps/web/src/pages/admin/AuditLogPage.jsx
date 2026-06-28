import React from 'react';
import JournalLogView from '../../components/journal/JournalLogView';

export default function AuditLogPage() {
  return (
    <JournalLogView
      title="Journal audit système"
      subtitle="Connexions, administration, configuration, sécurité — réservé super admin. Inclut IP et portée système / équipe."
      endpoint="/admin/audit-logs"
      showTechnical
    />
  );
}
