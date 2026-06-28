/** Date du jour au format YYYY-MM-DD (fuseau local) */
export function todayDateString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Affichage date/heure sûr (évite « Invalid Date ») */
export function formatDateTime(value, fallback = '—', options) {
  if (value == null || value === '') return fallback;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return options ? d.toLocaleString('fr-FR', options) : d.toLocaleString('fr-FR');
}

/** Affichage date seule */
export function formatDate(value, fallback = '—') {
  if (value == null || value === '') return fallback;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString('fr-FR');
}

/** Date longue (ex. lundi 22 juin 2026) */
export function formatDateLong(value, fallback = '—') {
  return formatDateTime(value, fallback, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Paramètres API from / to à partir de champs date (YYYY-MM-DD) */
export function buildDateRangeParams(from, to) {
  const params = {};
  if (from) {
    const start = new Date(from);
    start.setHours(0, 0, 0, 0);
    params.from = start.toISOString();
  }
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    params.to = end.toISOString();
  }
  return params;
}

export const defaultTodayRange = () => {
  const t = todayDateString();
  return { from: t, to: t };
};
