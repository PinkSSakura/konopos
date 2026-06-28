const { Category, Subcategory, MenuItem, Extra } = require('../models');
const { query, serializers } = require('../utils')();
const { baseQuery, getEstablishmentId } = query;
const { mapList, serializeCategory, serializeSubcategory, serializeMenuItemList, serializeMenuItemPos, serializeMenuItemForm } = serializers;
const { audit } = require('../services')();
const { logAudit } = audit;

async function listCategories(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const data = await Category.find(baseQuery(estId)).sort({ name: 1 });
    res.json({ success: true, data: mapList(data, serializeCategory) });
  } catch (err) {
    next(err);
  }
}

async function getCategory(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const doc = await Category.findOne({ _id: req.params.id, ...baseQuery(estId) });
    if (!doc) return res.status(404).json({ success: false, message: 'Catégorie introuvable.' });
    res.json({ success: true, data: serializeCategory(doc) });
  } catch (err) {
    next(err);
  }
}

async function createCategory(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const doc = await Category.create({
      establishment: estId,
      name: req.body.name,
      image_url: req.body.image_url || undefined,
      color: req.body.color || '#fc2c46',
      extra_ids: Array.isArray(req.body.extra_ids) ? req.body.extra_ids : [],
      created_by: req.user._id,
    });
    await logAudit({
      establishment: estId,
      user: req.user,
      action: 'create',
      module: 'menu',
      resource: 'category',
      resource_id: doc._id,
      req,
    });
    res.status(201).json({ success: true, data: serializeCategory(doc) });
  } catch (err) {
    next(err);
  }
}

async function updateCategory(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const doc = await Category.findOneAndUpdate(
      { _id: req.params.id, ...baseQuery(estId) },
      {
        $set: {
          name: req.body.name,
          image_url: req.body.image_url || null,
          color: req.body.color || '#fc2c46',
          extra_ids: Array.isArray(req.body.extra_ids) ? req.body.extra_ids : [],
          modified_by: req.user._id,
        },
      },
      { new: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: 'Catégorie introuvable.' });
    res.json({ success: true, data: serializeCategory(doc) });
  } catch (err) {
    next(err);
  }
}

async function deleteCategory(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const doc = await Category.findOneAndUpdate(
      { _id: req.params.id, ...baseQuery(estId) },
      { is_deleted: true, deleted_at: new Date(), deleted_by: req.user._id },
      { new: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: 'Catégorie introuvable.' });
    res.json({ success: true, message: 'Catégorie supprimée.' });
  } catch (err) {
    next(err);
  }
}

async function uploadCategoryImage(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Image requise.' });
    }
    const url = `/api/uploads/categories/${req.file.filename}`;
    res.json({ success: true, data: { url } });
  } catch (err) {
    next(err);
  }
}

async function uploadMenuItemImage(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Image requise.' });
    }
    const url = `/api/uploads/menu-items/${req.file.filename}`;
    res.json({ success: true, data: { url } });
  } catch (err) {
    next(err);
  }
}

async function listSubcategories(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const filter = { ...baseQuery(estId) };
    if (req.query.category) filter.category = req.query.category;
    const data = await Subcategory.find(filter).sort({ sort_order: 1 }).populate('category', 'name');
    res.json({ success: true, data: mapList(data, serializeSubcategory) });
  } catch (err) {
    next(err);
  }
}

async function getSubcategory(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const doc = await Subcategory.findOne({ _id: req.params.id, ...baseQuery(estId) })
      .populate('category', 'name');
    if (!doc) return res.status(404).json({ success: false, message: 'Sous-catégorie introuvable.' });
    res.json({ success: true, data: serializeSubcategory(doc) });
  } catch (err) {
    next(err);
  }
}

async function createSubcategory(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const doc = await Subcategory.create({
      establishment: estId,
      category: req.body.category,
      name: req.body.name,
      sort_order: req.body.sort_order ?? 0,
      created_by: req.user._id,
    });
    res.status(201).json({ success: true, data: serializeSubcategory(doc) });
  } catch (err) {
    next(err);
  }
}

async function updateSubcategory(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const doc = await Subcategory.findOneAndUpdate(
      { _id: req.params.id, ...baseQuery(estId) },
      {
        $set: {
          name: req.body.name,
          category: req.body.category,
          sort_order: req.body.sort_order,
          modified_by: req.user._id,
        },
      },
      { new: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: 'Sous-catégorie introuvable.' });
    res.json({ success: true, data: serializeSubcategory(doc) });
  } catch (err) {
    next(err);
  }
}

async function deleteSubcategory(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    await Subcategory.findOneAndUpdate(
      { _id: req.params.id, ...baseQuery(estId) },
      { is_deleted: true, deleted_at: new Date(), deleted_by: req.user._id }
    );
    res.json({ success: true, message: 'Sous-catégorie supprimée.' });
  } catch (err) {
    next(err);
  }
}

async function listItems(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const filter = { ...baseQuery(estId) };
    if (req.query.category) filter.category = req.query.category;
    if (req.query.product_type) filter.product_type = req.query.product_type;
    const data = await MenuItem.find(filter)
      .populate('category', 'name extra_ids')
      .populate('subcategory', 'name')
      .sort({ name: 1 });
    const serializer = req.query.view === 'pos' ? serializeMenuItemPos : serializeMenuItemList;
    res.json({ success: true, data: mapList(data, serializer) });
  } catch (err) {
    next(err);
  }
}

async function getItem(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const doc = await MenuItem.findOne({ _id: req.params.id, ...baseQuery(estId) })
      .populate('category')
      .populate('subcategory');
    if (!doc) return res.status(404).json({ success: false, message: 'Article introuvable.' });
    res.json({ success: true, data: serializeMenuItemForm(doc) });
  } catch (err) {
    next(err);
  }
}

async function createItem(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const doc = await MenuItem.create({
      establishment: estId,
      ...req.body,
      created_by: req.user._id,
    });
    res.status(201).json({ success: true, data: serializeMenuItemForm(doc) });
  } catch (err) {
    next(err);
  }
}

async function updateItem(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const doc = await MenuItem.findOneAndUpdate(
      { _id: req.params.id, ...baseQuery(estId) },
      { $set: { ...req.body, modified_by: req.user._id } },
      { new: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: 'Article introuvable.' });
    res.json({ success: true, data: serializeMenuItemForm(doc) });
  } catch (err) {
    next(err);
  }
}

async function deleteItem(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    await MenuItem.findOneAndUpdate(
      { _id: req.params.id, ...baseQuery(estId) },
      { is_deleted: true, deleted_at: new Date(), deleted_by: req.user._id }
    );
    res.json({ success: true, message: 'Article supprimé.' });
  } catch (err) {
    next(err);
  }
}

async function getCounts(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const query = baseQuery(estId);
    const [categories, subcategories, extras, items] = await Promise.all([
      Category.countDocuments(query),
      Subcategory.countDocuments(query),
      Extra.countDocuments(query),
      MenuItem.countDocuments(query),
    ]);
    res.json({
      success: true,
      data: { categories, subcategories, extras, items },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listCategories,
  getCategory,
  getCounts,
  createCategory,
  updateCategory,
  deleteCategory,
  uploadCategoryImage,
  uploadMenuItemImage,
  listSubcategories,
  getSubcategory,
  createSubcategory,
  updateSubcategory,
  deleteSubcategory,
  listItems,
  getItem,
  createItem,
  updateItem,
  deleteItem,
};
