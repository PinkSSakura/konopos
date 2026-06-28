function toPlain(doc) {
  if (doc == null) return doc;
  if (typeof doc.toObject === 'function') return doc.toObject();
  return doc;
}

function resolveMenuItemExtraIds(menuItem) {
  const item = toPlain(menuItem);
  const itemIds = Array.isArray(item.extra_ids) ? item.extra_ids.map(String) : [];
  const useCategory = item.use_category_extras !== false && item.use_category_extras !== 0;
  if (!useCategory) {
    return [...new Set(itemIds)];
  }
  const cat = item.category;
  const catIds = cat && typeof cat === 'object' && Array.isArray(cat.extra_ids)
    ? cat.extra_ids.map(String)
    : [];
  return [...new Set([...catIds, ...itemIds])];
}

module.exports = {
  resolveMenuItemExtraIds,
};
