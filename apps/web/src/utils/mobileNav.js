import {
  LayoutGrid,
  Wallet,
} from 'lucide-react';
import { getCaisseHubCards } from './caisseHub';
import { getAdminHubCards } from './adminHub';
import { MENU_HUB_SECTIONS } from './menuHub';
import { canViewAnalytics } from './analyticsAccess';
import { canProcessPayment } from './paymentAccess';
import { hasCaisseHubAccess } from './caisseHub';
import { hasPermission } from './permissions';
import { getKitchenDashboardPath, isKitchenStaffRole } from './kdsaccess';

const HUB_EXPAND = {
  '/caisse': getCaisseHubCards,
  '/admin': getAdminHubCards,
  '/menu': () => MENU_HUB_SECTIONS.map(({ key, path, title, icon, description }) => ({
    key,
    path,
    title,
    icon,
    description: description || '',
  })),
};

const NAV_DESCRIPTIONS = {
  '/dashboard': 'Vue d\'ensemble et statistiques.',
  '/pos': 'Prise de commande tactile.',
  '/orders': 'Liste et suivi des commandes.',
  '/service': 'Articles prêts à servir en salle.',
  '/shift': 'Ouverture et clôture de shift.',
  '/shift/daily-close': 'Récapitulatif journalier serveur.',
  '/caisse': 'Encaissement et clôture.',
  '/caisse/encaisser': 'Commandes prêtes à encaisser.',
  '/tables': 'Plan de salle et tables.',
  '/menu': 'Gestion du catalogue.',
  '/kds/food': 'File cuisine.',
  '/kds/drink': 'File bar.',
  '/admin/clients': 'Clients réguliers.',
  '/admin': 'Administration de l\'établissement.',
};

function shortLabelFor(item) {
  const map = {
    '/dashboard': 'Accueil',
    '/pos': 'POS',
    '/orders': 'Commandes',
    '/service': 'Servir',
    '/shift': 'Shift',
    '/shift/daily-close': 'Clôture',
    '/caisse': 'Caisse',
    '/caisse/encaisser': 'Caisse',
    '/tables': 'Salle',
    '/menu': 'Catalogue',
    '/kds/food': 'Cuisine',
    '/kds/drink': 'Bar',
    '/admin': 'Admin',
    '/admin/clients': 'Clients',
  };
  return map[item.key] || item.label;
}

function buildPriorityKeys(user, roleKey) {
  const keys = [];
  if (canViewAnalytics(user)) keys.push('/dashboard');
  if (isKitchenStaffRole(roleKey)) {
    const kds = getKitchenDashboardPath(roleKey);
    if (kds) keys.push(kds);
    keys.push('/orders', '/shift');
    return keys;
  }
  if (hasPermission(user, 'order_create')) keys.push('/pos');
  keys.push('/orders', '/service');
  if (canProcessPayment(user)) keys.push('/caisse/encaisser');
  else if (hasCaisseHubAccess(user)) keys.push('/caisse');
  keys.push('/shift', '/shift/daily-close', '/tables', '/menu', '/kds/food', '/kds/drink', '/admin/clients', '/admin');
  return keys;
}

function navItemToCard(item) {
  return {
    key: item.key,
    path: item.key,
    title: item.label,
    description: NAV_DESCRIPTIONS[item.key] || '',
    icon: item.icon,
  };
}

function expandHubToCards(key, user) {
  const expand = HUB_EXPAND[key];
  if (!expand) return [];
  return expand(user).map((card) => ({
    ...card,
    description: card.description || NAV_DESCRIPTIONS[card.path] || '',
  }));
}

/**
 * @param {Array} navItems — sidebar nav items (after shift gate)
 * @param {object} user
 * @param {string} roleKey
 * @returns {{ fixedTabs: Array, menuCards: Array }}
 */
export function buildMobileNav(navItems, user, roleKey) {
  if (!user || !navItems?.length) {
    return { fixedTabs: [], menuCards: [] };
  }

  const byKey = new Map(navItems.map((item) => [item.key, item]));
  const priority = buildPriorityKeys(user, roleKey);
  const fixedTabs = [];

  const tryAddFixed = (key) => {
    if (fixedTabs.length >= 4) return;
    const item = byKey.get(key);
    if (!item || fixedTabs.some((t) => t.key === item.key)) return;
    fixedTabs.push({
      ...item,
      shortLabel: shortLabelFor(item),
    });
  };

  for (const key of priority) {
    tryAddFixed(key);
  }

  if (canProcessPayment(user) && !byKey.has('/caisse/encaisser') && fixedTabs.length < 4) {
    const caisseParent = byKey.get('/caisse');
    if (caisseParent && !fixedTabs.some((t) => t.key === '/caisse/encaisser')) {
      fixedTabs.push({
        key: '/caisse/encaisser',
        icon: Wallet,
        label: 'À encaisser',
        shortLabel: 'Caisse',
      });
    }
  }

  for (const item of navItems) {
    if (fixedTabs.length >= 4) break;
    if (!fixedTabs.some((t) => t.key === item.key)) {
      fixedTabs.push({ ...item, shortLabel: shortLabelFor(item) });
    }
  }

  const fixedKeys = new Set(fixedTabs.map((t) => t.key));
  const menuCards = [];

  for (const item of navItems) {
    if (fixedKeys.has(item.key)) continue;
    if (HUB_EXPAND[item.key]) {
      menuCards.push(...expandHubToCards(item.key, user));
      continue;
    }
    menuCards.push(navItemToCard(item));
  }

  if (fixedTabs.some((t) => t.key === '/caisse/encaisser') && byKey.has('/caisse')) {
    const caisseCards = expandHubToCards('/caisse', user).filter((c) => c.path !== '/caisse/encaisser');
    for (const card of caisseCards) {
      if (!menuCards.some((m) => m.path === card.path)) menuCards.push(card);
    }
  }

  return { fixedTabs, menuCards };
}

export function isPathActive(pathname, tabKey) {
  if (tabKey === '/caisse/encaisser') {
    return pathname === '/caisse/encaisser' || pathname.startsWith('/caisse/encaisser/');
  }
  if (tabKey === '/caisse') {
    return pathname === '/caisse';
  }
  if (tabKey.startsWith('/kds')) {
    return pathname.startsWith(tabKey);
  }
  if (tabKey === '/shift') {
    return pathname === '/shift' || (pathname.startsWith('/shift/') && !pathname.startsWith('/shift/daily-close'));
  }
  return pathname === tabKey || pathname.startsWith(`${tabKey}/`);
}

export const MENU_TAB = {
  key: '__menu__',
  icon: LayoutGrid,
  shortLabel: 'Menu',
  label: 'Menu',
};
