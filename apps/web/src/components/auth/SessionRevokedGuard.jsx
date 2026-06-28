import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { useSocketEvent } from '../../context/SocketContext';

function shouldHandleSessionRevoked(payload, sessionId, loginInProgressRef) {
  if (loginInProgressRef?.current) return false;

  const revokedIds = payload?.revoked_session_ids;
  if (Array.isArray(revokedIds) && revokedIds.length) {
    if (!sessionId) return false;
    return revokedIds.includes(String(sessionId));
  }

  if (payload?.session_id) {
    if (!sessionId) return false;
    return String(payload.session_id) === String(sessionId);
  }

  if (payload?.reason === 'replaced_by_new_login') return false;

  return true;
}

export default function SessionRevokedGuard() {
  const navigate = useNavigate();
  const { user, sessionId, isPinSession, logout, loginInProgressRef } = useAuth();

  const handleRevoked = useCallback(async (payload) => {
    if (!user || isPinSession) return;
    if (!shouldHandleSessionRevoked(payload, sessionId, loginInProgressRef)) return;

    if (payload?.reason === 'forced') {
      toast.warning('Votre session a été fermée par un administrateur.');
    } else if (payload?.reason === 'replaced_by_new_login' && !payload?.silent) {
      toast.info('Connexion ouverte sur un autre appareil.');
    }
    await logout({ reason: payload?.reason || 'forced' });
    navigate('/login', { replace: true });
  }, [user, sessionId, isPinSession, logout, navigate, loginInProgressRef]);

  useSocketEvent('auth:session_revoked', (payload) => {
    handleRevoked(payload);
  });

  return null;
}
