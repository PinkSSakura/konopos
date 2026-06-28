import {
  Layers,
  ListTree,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react';

export const MENU_HUB_SECTIONS = [
  {
    key: 'categories',
    path: '/menu/categories',
    title: 'Catégories',
    description: 'Organisez le menu en grandes familles (entrées, plats, boissons…).',
    icon: Layers,
    countKey: 'categories',
    addPath: '/menu/categories/new',
    addLabel: 'Nouvelle catégorie',
  },
  {
    key: 'subcategories',
    path: '/menu/subcategories',
    title: 'Sous-catégories',
    description: 'Affinez chaque catégorie avec des sous-groupes.',
    icon: ListTree,
    countKey: 'subcategories',
    addPath: '/menu/subcategories/new',
    addLabel: 'Nouvelle sous-catégorie',
  },
  {
    key: 'extras',
    path: '/menu/extras',
    title: 'Extras',
    description: 'Suppléments et options payantes (fromage, sauce, taille…).',
    icon: Sparkles,
    countKey: 'extras',
    addPath: '/menu/extras/new',
    addLabel: 'Nouvel extra',
  },
  {
    key: 'items',
    path: '/menu/items',
    title: 'Articles',
    description: 'Produits vendus au POS avec prix, type et visuels.',
    icon: UtensilsCrossed,
    countKey: 'items',
    addPath: '/menu/items/new',
    addLabel: 'Nouvel article',
  },
];

export function getMenuSection(key) {
  return MENU_HUB_SECTIONS.find((section) => section.key === key);
}
