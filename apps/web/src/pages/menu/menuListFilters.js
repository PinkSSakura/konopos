import { rowMatchesSearch } from '../../utils/listSearch';

export function filterMenuRows(tab, rows, applied) {
  const { search = '', categoryId = null, productType = null, active = null } = applied || {};

  return rows.filter((row) => {
    if (!rowMatchesSearch(row, search, menuSearchGetters[tab])) return false;

    if (tab === 'subcategories' || tab === 'items') {
      if (categoryId && row.category?._id !== categoryId) return false;
    }

    if (tab === 'items' && productType && row.product_type !== productType) {
      return false;
    }

    if (tab === 'extras' && active !== null && active !== '') {
      const isActive = row.is_active !== false;
      if (active === 'yes' && !isActive) return false;
      if (active === 'no' && isActive) return false;
    }

    return true;
  });
}

const menuSearchGetters = {
  categories: [(r) => r.name],
  subcategories: [(r) => r.name, (r) => r.category?.name],
  extras: [(r) => r.name],
  items: [(r) => r.name, (r) => r.category?.name],
};

export const MENU_FILTER_PLACEHOLDERS = {
  categories: 'Nom de catégorie…',
  subcategories: 'Nom, catégorie…',
  extras: 'Nom d\'extra…',
  items: 'Nom, catégorie…',
};
