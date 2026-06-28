const { Extra } = require('../models');
const { query, serializers } = require('../utils')();
const { baseQuery, getEstablishmentId } = query;
const { mapList, serializeExtra } = serializers;

async function listExtras(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const data = await Extra.find(baseQuery(estId)).sort({ name: 1 });
    res.json({ success: true, data: mapList(data, serializeExtra) });
  } catch (err) {
    next(err);
  }
}

async function getExtra(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const doc = await Extra.findOne({ _id: req.params.id, ...baseQuery(estId) });
    if (!doc) return res.status(404).json({ success: false, message: 'Extra introuvable.' });
    res.json({ success: true, data: serializeExtra(doc) });
  } catch (err) {
    next(err);
  }
}

async function createExtra(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const doc = await Extra.create({
      establishment: estId,
      name: req.body.name,
      price: req.body.price ?? 0,
      image_url: req.body.image_url || undefined,
      is_active: req.body.is_active !== false,
      created_by: req.user._id,
    });
    res.status(201).json({ success: true, data: serializeExtra(doc) });
  } catch (err) {
    next(err);
  }
}

async function updateExtra(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const updates = { modified_by: req.user._id };
    if (req.body.name != null) updates.name = req.body.name;
    if (req.body.price != null) updates.price = req.body.price;
    if (req.body.image_url !== undefined) updates.image_url = req.body.image_url || null;
    if (typeof req.body.is_active === 'boolean') updates.is_active = req.body.is_active;

    const doc = await Extra.findOneAndUpdate(
      { _id: req.params.id, ...baseQuery(estId) },
      { $set: updates },
      { new: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: 'Extra introuvable.' });
    res.json({ success: true, data: serializeExtra(doc) });
  } catch (err) {
    next(err);
  }
}

async function deleteExtra(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const doc = await Extra.findOneAndUpdate(
      { _id: req.params.id, ...baseQuery(estId) },
      { is_deleted: true, deleted_at: new Date(), deleted_by: req.user._id },
      { new: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: 'Extra introuvable.' });
    res.json({ success: true, message: 'Extra supprimé.' });
  } catch (err) {
    next(err);
  }
}

async function uploadExtraImage(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Image requise.' });
    }
    const url = `/api/uploads/extras/${req.file.filename}`;
    res.json({ success: true, data: { url } });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listExtras,
  getExtra,
  createExtra,
  updateExtra,
  deleteExtra,
  uploadExtraImage,
};
