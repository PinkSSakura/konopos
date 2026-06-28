const { Room, Table } = require('../models');
const { query, serializers } = require('../utils')();
const { baseQuery, getEstablishmentId } = query;
const { mapList, serializeRoom } = serializers;

async function listRooms(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const data = await Room.find(baseQuery(estId)).sort({ sort_order: 1 });
    res.json({ success: true, data: mapList(data, serializeRoom) });
  } catch (err) {
    next(err);
  }
}

async function createRoom(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const doc = await Room.create({
      establishment: estId,
      name: req.body.name,
      sort_order: req.body.sort_order ?? 0,
      layout_width: req.body.layout_width ?? 800,
      layout_height: req.body.layout_height ?? 600,
      created_by: req.user._id,
    });
    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
}

async function updateRoom(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const doc = await Room.findOneAndUpdate(
      { _id: req.params.id, ...baseQuery(estId) },
      { $set: req.body },
      { new: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: 'Salle introuvable.' });
    res.json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
}

async function deleteRoom(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const tablesCount = await Table.countDocuments({ room: req.params.id, is_deleted: false });
    if (tablesCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Supprimez ou déplacez les tables avant de supprimer la salle.',
      });
    }
    await Room.findOneAndUpdate(
      { _id: req.params.id, ...baseQuery(estId) },
      { is_deleted: true, deleted_at: new Date(), deleted_by: req.user._id }
    );
    res.json({ success: true, message: 'Salle supprimée.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { listRooms, createRoom, updateRoom, deleteRoom };
