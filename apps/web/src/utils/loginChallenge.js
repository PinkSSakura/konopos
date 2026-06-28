import client from '../api/client';

const POLL_INTERVAL_MS = 2000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForLoginChallenge(challenge, { onPending } = {}) {
  const { challenge_id: challengeId, challenge_secret: challengeSecret, expires_at: expiresAt } = challenge;
  const deadline = new Date(expiresAt).getTime();

  while (Date.now() < deadline) {
    const res = await client.get(`/auth/login-challenge/${challengeId}`, {
      params: { secret: challengeSecret },
    });

    const sessionData = res.data?.data;
    if (res.data?.success && sessionData?.role_key) {
      return sessionData;
    }

    const payload = sessionData;
    if (!payload) {
      throw new Error('Réponse de connexion invalide.');
    }

    if (payload.status === 'approved') {
      return payload;
    }

    if (payload.status === 'denied') {
      const err = new Error('Connexion refusée par l\'autre appareil.');
      err.code = 'LOGIN_CHALLENGE_DENIED';
      throw err;
    }

    if (payload.status === 'expired') {
      throw new Error('Demande de connexion expirée.');
    }

    onPending?.(payload);
    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error('Délai expiré. Réessayez la connexion.');
}

export const BACKOFFICE_ROLE_KEYS = ['superadmin', 'owner', 'manager', 'submanager'];

export function isBackofficeRoleKey(roleKey) {
  return BACKOFFICE_ROLE_KEYS.includes(roleKey);
}
