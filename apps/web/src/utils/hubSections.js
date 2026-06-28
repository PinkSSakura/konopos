import { getCaisseHubCards } from './caisseHub';
import { getAdminHubCards } from './adminHub';
import { MENU_HUB_SECTIONS } from './menuHub';

const HUB_SECTIONS = [
  {
    id: 'caisse',
    hubPath: '/caisse',
    hubTitle: 'Caisse',
    getItems: getCaisseHubCards,
    isSubPage: (pathname) => pathname.startsWith('/caisse/'),
  },
  {
    id: 'admin',
    hubPath: '/admin',
    hubTitle: 'Administration',
    getItems: getAdminHubCards,
    isSubPage: (pathname) => pathname.startsWith('/admin/')
      && !pathname.startsWith('/admin/license'),
  },
  {
    id: 'menu',
    hubPath: '/menu',
    hubTitle: 'Menu',
    getItems: () => MENU_HUB_SECTIONS.map(({ key, path, title, icon }) => ({
      key,
      path,
      title,
      icon,
    })),
    isSubPage: (pathname) => pathname.startsWith('/menu/'),
  },
];

export function isHubItemActive(pathname, itemPath) {
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

/** Hub section config when the user is on a subpage (not the hub index). */
export function resolveHubSection(pathname, user) {
  if (!pathname || !user) return null;

  for (const section of HUB_SECTIONS) {
    if (!section.isSubPage(pathname)) continue;
    const items = section.getItems(user);
    if (!items.length) return null;
    return {
      id: section.id,
      hubPath: section.hubPath,
      hubTitle: section.hubTitle,
      items,
    };
  }

  return null;
}
