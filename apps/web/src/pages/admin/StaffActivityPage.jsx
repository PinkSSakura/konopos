import React from 'react';
import JournalLogView from '../../components/journal/JournalLogView';

export default function StaffActivityPage() {
  return (
    <JournalLogView
      title="Journal activité équipe"
      subtitle="Actions des serveurs, cuisine, bar, managers et sous-managers — commandes, encaissements, shifts. Ce n'est pas le journal technique système."
      endpoint="/activity/staff"
      showRoleFilter
    />
  );
}
