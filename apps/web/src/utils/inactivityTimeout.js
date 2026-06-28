export const INACTIVITY_WARNING_SECONDS = 45;

const DEFAULT_INACTIVITY_TOTAL_MS = 7 * 60 * 1000 + 45 * 1000;
const SYSTEMPOS_INACTIVITY_TOTAL_MS = 60 * 60 * 1000;
/** 1 min idle + 45 s warning (same pattern as default 7 min 45 s) */
const DIRECT_PIN_INACTIVITY_TOTAL_MS = 1 * 60 * 1000 + 45 * 1000;

export function getInactivitySettings(user) {
  if (user?.is_quick_waiter_session) {
    return {
      totalMs: DIRECT_PIN_INACTIVITY_TOTAL_MS,
      warningSeconds: INACTIVITY_WARNING_SECONDS,
      idleBeforeWarningMs: DIRECT_PIN_INACTIVITY_TOTAL_MS - INACTIVITY_WARNING_SECONDS * 1000,
    };
  }
  const isSystemposShell = user?.role?.role_key === 'systempos' && !user?.is_pin_session;
  const totalMs = isSystemposShell ? SYSTEMPOS_INACTIVITY_TOTAL_MS : DEFAULT_INACTIVITY_TOTAL_MS;
  return {
    totalMs,
    warningSeconds: INACTIVITY_WARNING_SECONDS,
    idleBeforeWarningMs: totalMs - INACTIVITY_WARNING_SECONDS * 1000,
  };
}

/** @deprecated use getInactivitySettings */
export const INACTIVITY_TOTAL_MS = DEFAULT_INACTIVITY_TOTAL_MS;
/** @deprecated use getInactivitySettings */
export const INACTIVITY_IDLE_BEFORE_WARNING_MS =
  DEFAULT_INACTIVITY_TOTAL_MS - INACTIVITY_WARNING_SECONDS * 1000;

export function inactivityTotalLabel(user) {
  const { totalMs } = getInactivitySettings(user);
  const minutes = Math.floor(totalMs / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const minLabel = minutes === 1 ? '1 minute' : `${minutes} minutes`;
  if (seconds === 0) return minLabel;
  return `${minLabel} et ${seconds} secondes`;
}

export function shouldTrackInactivity(user) {
  return Boolean(user);
}
