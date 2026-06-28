export function getExtrasForMenuItem(menuItem, allExtras = []) {
  const ids = new Set((menuItem?.assigned_extra_ids || []).map(String));
  if (!ids.size) return [];
  return allExtras.filter((extra) => ids.has(String(extra._id)));
}

/** Item-specific extra ids stored on the article (not including category inheritance). */
export function getItemOwnExtraIds(menuItem) {
  return Array.isArray(menuItem?.extra_ids) ? menuItem.extra_ids.map(String) : [];
}

export function menuItemNeedsCustomize(menuItem) {
  if (!menuItem) return false;
  const hasExtras = (menuItem.assigned_extra_ids?.length ?? 0) > 0;
  const hasVariants = (menuItem.variants?.length ?? 0) > 0;
  const hasModifiers = (menuItem.modifier_groups?.length ?? 0) > 0;
  return hasExtras || hasVariants || hasModifiers;
}
