import { formatDateTime } from './dateFilters';

function pad2(value) {
  return String(value).padStart(2, '0');
}

export function formatLicenseCountdown(remainingMs) {
  if (remainingMs == null) return null;
  const totalSec = Math.max(0, Math.floor(remainingMs / 1000));
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const time = `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
  if (days > 0) return `${days}j ${time}`;
  return time;
}

export function formatLicenseDate(value) {
  return formatDateTime(value, '—', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function getLicenseStatusLabel(status) {
  if (!status) return 'Inconnue';
  if (!status.valid) {
    if (status.code === 'LICENSE_MISSING') return 'Aucune licence';
    if (status.code === 'LICENSE_INCOMPLETE') return 'Licence corrompue — réactivation requise';
    return 'Expirée';
  }
  if (status.lifetime) return 'Active · illimitée';
  return 'Active';
}
