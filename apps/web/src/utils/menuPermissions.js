import { hasPermission } from './permissions';

const SECTION_PERMS = {
  categories: {
    view: 'category_view',
    create: 'category_create',
    update: 'category_update',
    delete: 'category_softdelete',
  },
  subcategories: {
    view: 'subcategory_view',
    create: 'subcategory_create',
    update: 'subcategory_update',
    delete: 'subcategory_softdelete',
  },
  extras: {
    view: 'extra_view',
    create: 'extra_create',
    update: 'extra_update',
    delete: 'extra_softdelete',
  },
  items: {
    view: 'item_view',
    create: 'item_create',
    update: 'item_update',
    delete: 'item_softdelete',
  },
};

export function getMenuSectionPermissions(sectionKey) {
  return SECTION_PERMS[sectionKey] || {};
}

export function canViewMenuSection(user, sectionKey) {
  const code = getMenuSectionPermissions(sectionKey).view;
  return code ? hasPermission(user, code) : false;
}

export function canCreateMenuSection(user, sectionKey) {
  const code = getMenuSectionPermissions(sectionKey).create;
  return code ? hasPermission(user, code) : false;
}

export function canUpdateMenuSection(user, sectionKey) {
  const code = getMenuSectionPermissions(sectionKey).update;
  return code ? hasPermission(user, code) : false;
}

export function canDeleteMenuSection(user, sectionKey) {
  const code = getMenuSectionPermissions(sectionKey).delete;
  return code ? hasPermission(user, code) : false;
}
