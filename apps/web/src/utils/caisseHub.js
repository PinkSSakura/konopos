import { Wallet, History, ClipboardCheck } from 'lucide-react';
import {
  canProcessPayment,
  canViewPaymentHistory,
  canDailyClose,
} from './paymentAccess';

export function getCaisseHubCards(user) {
  if (!user) return [];

  const cards = [];

  if (canProcessPayment(user)) {
    cards.push({
      key: 'encaisser',
      path: '/caisse/encaisser',
      title: 'À encaisser',
      description: 'Commandes prêtes pour encaissement et paiement.',
      icon: Wallet,
    });
  }

  if (canViewPaymentHistory(user)) {
    cards.push({
      key: 'history',
      path: '/caisse/history',
      title: 'Historique',
      description: 'Paiements enregistrés, reçus et annulations.',
      icon: History,
    });
  }

  if (canDailyClose(user)) {
    cards.push({
      key: 'closing',
      path: '/caisse/closing',
      title: 'Clôture jour',
      description: 'Clôture quotidienne et rapports de caisse.',
      icon: ClipboardCheck,
    });
  }

  return cards;
}

export function hasCaisseHubAccess(user) {
  return getCaisseHubCards(user).length > 0;
}
