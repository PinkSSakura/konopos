export function normalizeSearch(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function rowMatchesSearch(row, search, getters) {
  const q = normalizeSearch(search);
  if (!q) return true;
  return getters.some((get) => normalizeSearch(typeof get === 'function' ? get(row) : row[get]).includes(q));
}
