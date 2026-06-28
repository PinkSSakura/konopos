/** Activation periods — kept client-side (not exposed via API). */
export const LICENSE_PERIOD_OPTIONS = [
  { value: 'week', label: '1 semaine (7 j)' },
  { value: 'month', label: '1 mois (30 j)' },
  { value: '3months', label: '3 mois (90 j)' },
  { value: '6months', label: '6 mois (180 j)' },
  { value: 'year', label: '1 an (365 j)' },
  { value: 'lifetime', label: 'À vie' },
  { value: 'custom', label: 'Personnalisé (jours ou date de fin)' },
];

export const MAX_CUSTOM_LICENSE_DAYS = 3660;