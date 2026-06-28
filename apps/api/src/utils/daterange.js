function parseAnchor(dateStr) {
  if (!dateStr) return new Date();
  const d = new Date(`${dateStr}T12:00:00`);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Lundi = début de semaine */
function startOfWeek(d) {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

function endOfWeek(d) {
  const x = startOfWeek(d);
  x.setDate(x.getDate() + 6);
  return endOfDay(x);
}

function startOfMonth(d) {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}

function endOfMonth(d) {
  const x = startOfMonth(d);
  x.setMonth(x.getMonth() + 1);
  x.setDate(0);
  return endOfDay(x);
}

function startOfYear(d) {
  const x = startOfDay(d);
  x.setMonth(0, 1);
  return x;
}

function endOfYear(d) {
  const x = startOfYear(d);
  x.setMonth(11, 31);
  return endOfDay(x);
}

const PERIODS = ['day', 'week', 'month', 'year'];

function getAnalyticsRange(period, dateStr) {
  const anchor = parseAnchor(dateStr);
  const p = PERIODS.includes(period) ? period : 'day';

  if (p === 'day') {
    return { period: p, from: startOfDay(anchor), to: endOfDay(anchor), anchor };
  }
  if (p === 'week') {
    return { period: p, from: startOfWeek(anchor), to: endOfWeek(anchor), anchor };
  }
  if (p === 'month') {
    return { period: p, from: startOfMonth(anchor), to: endOfMonth(anchor), anchor };
  }
  return { period: p, from: startOfYear(anchor), to: endOfYear(anchor), anchor };
}

module.exports = {
  PERIODS,
  getAnalyticsRange,
  startOfDay,
  endOfDay,
};
