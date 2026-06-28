import React from 'react';
import { Monitor } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function PinSessionBanner() {
  const { isPinSession } = useAuth();

  if (!isPinSession) return null;

  return (
    <div
      className="pin-session-banner"
      role="status"
    >
      <Monitor className="size-4 shrink-0" aria-hidden />
      <span className="pin-session-banner__text">
        Session temporaire sur terminal SystemPOS — vos actions sont enregistrées à votre nom.
        Utilisez « Retour PIN » dans le menu profil pour changer de serveur.
      </span>
    </div>
  );
}
