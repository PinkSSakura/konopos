const { Customer } = require('../models');
const { query, serializers } = require('../utils')();
const { getEstablishmentId } = query;
const { mapList, serializeCustomerList, serializeCustomerForm } = serializers;

async function list(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const filter = { establishment: estId, is_deleted: false };
    if (req.query.q) {
      const q = String(req.query.q).trim();
      if (q) {
        filter.$or = [
          { name: { $regex: q, $options: 'i' } },
          { phone: { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } },
        ];
      }
    }
    if (req.query.include_inactive !== '1') {
      filter.is_active = true;
    }
    const limit = Math.min(Number(req.query.limit) || 200, 500);
    const data = await Customer.find(filter).sort({ name: 1 }).limit(limit);
    res.json({ success: true, data: mapList(data, serializeCustomerList) });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const doc = await Customer.findOne({
      _id: req.params.id,
      establishment: estId,
      is_deleted: false,
    });
    if (!doc) return res.status(404).json({ success: false, message: 'Client introuvable.' });
    res.json({ success: true, data: serializeCustomerForm(doc) });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ success: false, message: 'Le nom du client est obligatoire.' });
    }
    const estId = getEstablishmentId(req);
    const doc = await Customer.create({
      establishment: estId,
      name,
      phone: req.body.phone?.trim() || undefined,
      email: req.body.email?.trim() || undefined,
      notes: req.body.notes?.trim() || undefined,
      created_by: req.user._id,
    });
    res.status(201).json({ success: true, data: serializeCustomerForm(doc) });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const name = req.body.name != null ? String(req.body.name).trim() : undefined;
    if (name !== undefined && !name) {
      return res.status(400).json({ success: false, message: 'Le nom du client est obligatoire.' });
    }
    const estId = getEstablishmentId(req);
    const patch = { modified_by: req.user._id };
    if (name !== undefined) patch.name = name;
    if (req.body.phone !== undefined) patch.phone = req.body.phone?.trim() || undefined;
    if (req.body.email !== undefined) patch.email = req.body.email?.trim() || undefined;
    if (req.body.notes !== undefined) patch.notes = req.body.notes?.trim() || undefined;
    if (req.body.is_active !== undefined) patch.is_active = Boolean(req.body.is_active);

    const doc = await Customer.findOneAndUpdate(
      { _id: req.params.id, establishment: estId, is_deleted: false },
      { $set: patch },
      { new: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: 'Client introuvable.' });
    res.json({ success: true, data: serializeCustomerForm(doc) });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const doc = await Customer.findOne({
      _id: req.params.id,
      establishment: estId,
      is_deleted: false,
    });
    if (!doc) return res.status(404).json({ success: false, message: 'Client introuvable.' });
    if (Math.abs(doc.balance || 0) > 0.01) {
      return res.status(400).json({
        success: false,
        message: 'Impossible de supprimer un client avec un solde impayé. Réglez le compte ou désactivez-le.',
      });
    }
    doc.is_deleted = true;
    doc.deleted_at = new Date();
    doc.deleted_by = req.user._id;
    doc.modified_by = req.user._id;
    await doc.save();
    res.json({ success: true, message: 'Client supprimé.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, create, update, remove };
