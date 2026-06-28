import { message as toast } from '@/lib/toast';
import { isSystemTerminalContext } from './terminalContext';
import { restoreSystemposShell } from './restoreSystemposShell';

export function isDirectPinSession(user) {
  return Boolean(user?.is_quick_waiter_session);
}

export function goToPinScreen() {
  window.location.replace('/pin');
}

export function goToLoginPinScreen() {
  window.location.replace('/login?mode=pin');
}

export async function endDirectPinToLogin(
  { logoutPinSession } = {},
  { reason = 'manual', toastMessage } = {},
) {
  try {
    await logoutPinSession?.({ reason });
  } catch {
    /* session may already be closed server-side */
  }
  if (toastMessage) toast.info(toastMessage);
  goToLoginPinScreen();
}

/** After send kitchen or full payment — direct PIN sessions only. */
export async function handleDirectPinSessionEnd(
  { logoutPinSession, user } = {},
  { toastMessage = 'Session terminée' } = {},
) {
  if (!isDirectPinSession(user)) return false;
  await endDirectPinToLogin(
    { logoutPinSession },
    { reason: 'order_complete', toastMessage },
  );
  return true;
}

/**
 * End staff PIN session — SystemPOS shell stays logged in, or login PIN for direct sessions.
 */
export async function endStaffSessionToPin(
  { logoutPinSession, refreshUser, user } = {},
  { reason = 'manual', toastMessage } = {},
) {
  if (isDirectPinSession(user)) {
    await endDirectPinToLogin(
      { logoutPinSession },
      { reason, toastMessage: toastMessage || 'Retour à la connexion PIN' },
    );
    return;
  }

  try {
    await logoutPinSession?.({ reason });
  } catch {
    /* PIN session may already be closed server-side */
  }

  await restoreSystemposShell();

  try {
    await refreshUser?.();
  } catch {
    /* shell cookie may apply on next /pin load */
  }

  if (toastMessage) toast.info(toastMessage);
  goToPinScreen();
}

export function shouldEndPinSessionOnly(user, isPinSession) {
  if (isDirectPinSession(user)) return false;
  if (user?.role?.role_key === 'systempos') return false;
  if (isPinSession) return true;
  if (user?.is_pin_session) return true;
  if (isSystemTerminalContext()) return true;
  return false;
}
