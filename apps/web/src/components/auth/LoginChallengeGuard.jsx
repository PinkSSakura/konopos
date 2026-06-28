import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useSocketEvent } from '../../context/SocketContext';
import { isBackofficeRoleKey } from '../../utils/loginChallenge';
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

export default function LoginChallengeGuard() {
  const navigate = useNavigate();
  const { user, isPinSession, logout } = useAuth();
  const [challenge, setChallenge] = useState(null);
  const [responding, setResponding] = useState(false);

  const isBackofficeSession = Boolean(user) && !isPinSession && isBackofficeRoleKey(user?.role?.role_key);

  useSocketEvent('auth:login_challenge', (payload) => {
    if (!isBackofficeSession || !payload?.challenge_id) return;
    setChallenge({
      id: payload.challenge_id,
      deviceLabel: payload.device_label || 'Autre appareil',
      expiresAt: payload.expires_at,
    });
  });

  useSocketEvent('auth:login_challenge_resolved', (payload) => {
    if (!challenge || payload?.challenge_id !== challenge.id) return;
    if (payload.status === 'denied') {
      setChallenge(null);
    }
  });

  const closeChallenge = useCallback(() => {
    setChallenge(null);
  }, []);

  const respond = async (action) => {
    if (!challenge?.id) return;
    setResponding(true);
    try {
      const res = await client.post(`/auth/login-challenge/${challenge.id}/respond`, { action });
      if (action === 'approve') {
        toast.info(res.data.message || 'Vous êtes déconnecté. L\'autre appareil peut se connecter.');
        await logout({ reason: 'replaced_by_new_login' });
        navigate('/login', { replace: true });
      } else {
        toast.success(res.data.message || 'Connexion refusée.');
      }
      closeChallenge();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action impossible.');
    } finally {
      setResponding(false);
    }
  };

  if (!isBackofficeSession) return null;

  return (
    <AlertDialog open={Boolean(challenge)} onOpenChange={(open) => !open && closeChallenge()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Connexion depuis le terminal</AlertDialogTitle>
          <AlertDialogDescription>
            Une connexion est demandée depuis le terminal SystemPOS
            {challenge?.deviceLabel ? ` (${challenge.deviceLabel})` : ''}.
            {' '}Souhaitez-vous vous déconnecter ici pour autoriser cette connexion, ou la refuser ?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={responding} onClick={() => respond('deny')}>
            Refuser la connexion
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={responding}
            onClick={() => respond('approve')}
          >
            {responding ? 'Traitement…' : 'Se déconnecter ici'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
