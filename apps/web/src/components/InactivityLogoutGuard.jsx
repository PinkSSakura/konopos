import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { endStaffSessionToPin, shouldEndPinSessionOnly, endDirectPinToLogin } from '../utils/pinSession';
import {
  getInactivitySettings,
  INACTIVITY_WARNING_SECONDS,
  shouldTrackInactivity,
  inactivityTotalLabel,
} from '../utils/inactivityTimeout';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// scroll omitted — it fires passively and resets the idle timer without real user input
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'click'];

export default function InactivityLogoutGuard() {
  const { user, logout, logoutPinSession, refreshUser, isPinSession } = useAuth();
  const navigate = useNavigate();
  const [warningOpen, setWarningOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(INACTIVITY_WARNING_SECONDS);

  const warningTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const loggingOutRef = useRef(false);
  const warningOpenRef = useRef(false);

  const clearWarningTimer = () => {
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
  };

  const clearCountdownTimer = () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  };

  const inactivitySettings = getInactivitySettings(user);
  const warningSeconds = inactivitySettings.warningSeconds;

  const performLogout = useCallback(async () => {
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;
    clearWarningTimer();
    clearCountdownTimer();
    warningOpenRef.current = false;
    setWarningOpen(false);

    const directPin = Boolean(user?.is_quick_waiter_session);
    const pinOnly = shouldEndPinSessionOnly(user, isPinSession);
    try {
      if (directPin) {
        await endDirectPinToLogin(
          { logoutPinSession },
          { reason: 'timeout', toastMessage: 'Session terminée (inactivité)' },
        );
      } else if (pinOnly) {
        await endStaffSessionToPin(
          { logoutPinSession, refreshUser },
          { reason: 'timeout', toastMessage: 'Session serveur terminée (inactivité)' },
        );
      } else {
        await logout({ reason: 'timeout' });
        toast.info('Déconnecté pour inactivité');
        navigate('/login', { replace: true });
      }
    } finally {
      loggingOutRef.current = false;
    }
  }, [logout, logoutPinSession, refreshUser, navigate, isPinSession, user]);

  const startCountdownRef = useRef(() => {});

  startCountdownRef.current = () => {
    if (warningOpenRef.current || loggingOutRef.current) return;

    clearCountdownTimer();
    setSecondsLeft(warningSeconds);
    warningOpenRef.current = true;
    setWarningOpen(true);

    countdownTimerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearCountdownTimer();
          performLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const scheduleWarningRef = useRef(() => {});

  scheduleWarningRef.current = () => {
    if (warningOpenRef.current || loggingOutRef.current) return;
    clearWarningTimer();
    warningTimerRef.current = setTimeout(() => {
      startCountdownRef.current();
    }, inactivitySettings.idleBeforeWarningMs);
  };

  const resetInactivity = useCallback(() => {
    clearWarningTimer();
    clearCountdownTimer();
    warningOpenRef.current = false;
    setWarningOpen(false);
    setSecondsLeft(warningSeconds);
    scheduleWarningRef.current();
  }, [warningSeconds]);

  useEffect(() => {
    if (!shouldTrackInactivity(user)) {
      clearWarningTimer();
      clearCountdownTimer();
      warningOpenRef.current = false;
      setWarningOpen(false);
      return undefined;
    }

    const onActivity = () => {
      if (warningOpenRef.current || loggingOutRef.current) return;
      scheduleWarningRef.current();
    };

    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, onActivity, { passive: true }));
    scheduleWarningRef.current();

    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, onActivity));
      clearWarningTimer();
      clearCountdownTimer();
    };
  }, [user]);

  if (!user || !shouldTrackInactivity(user)) {
    return null;
  }

  return (
    <AlertDialog open={warningOpen} onOpenChange={() => {}}>
      <AlertDialogContent size="default" className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Session inactive</AlertDialogTitle>
          <AlertDialogDescription>
            Vous serez déconnecté dans{' '}
            <strong>{secondsLeft}</strong>
            {' '}
            seconde{secondsLeft > 1 ? 's' : ''} pour cause d&apos;inactivité ({inactivityTotalLabel(user)}).
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={resetInactivity}>Continuer</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={performLogout}>
            Déconnexion
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
