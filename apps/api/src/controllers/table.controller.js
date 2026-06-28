const { randomUUID } = require('crypto');
const { Table, Order, OrderItem } = require('../models');
const { TABLE_STATUS } = require('../models/table.model');
const { orderownership, query, serializers } = require('../utils')();
const { assertWaiterTableAccess, assertWaiterOrdersAccess, isOwnOrder } = orderownership;
const { baseQuery, getEstablishmentId } = query;
const { mapList, serializeTableList } = serializers;
const { order, notify } = require('../services')();
const { recalcOrderTotals, syncTableFromOrders } = order;
const { emitTablesChanged, emitOrderChanged } = notify;

function handleAccessError(res, err, next) {
  if (err.status) {
    return res.status(err.status).json({ success: false, message: err.message, code: err.code });
  }
  return next(err);
}

async function listTables(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const filter = { ...baseQuery(estId) };
    if (req.query.room) filter.room = req.query.room;
    const tables = await Table.find(filter).sort({ name: 1 });
    const orderIds = tables
      .map((table) => table.current_order)
      .filter(Boolean);
    const orders = orderIds.length
      ? await Order.find({ _id: { $in: orderIds }, establishment: estId, is_deleted: false })
      : [];
    const orderById = new Map(orders.map((order) => [String(order._id), order]));

    const data = mapList(tables, (table) => {
      const row = serializeTableList(table);
      const activeOrder = table.current_order
        ? orderById.get(String(table.current_order._id || table.current_order))
        : null;
      return {
        ...row,
        order_is_own: activeOrder ? isOwnOrder(activeOrder, req.user) : null,
      };
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function createTable(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const doc = await Table.create({
      establishment: estId,
      room: req.body.room,
      name: req.body.name,
      capacity: req.body.capacity ?? 4,
      position: req.body.position,
      created_by: req.user._id,
    });
    emitTablesChanged(estId, doc.room);
    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
}

async function updateTable(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const table = await Table.findOne({ _id: req.params.id, ...baseQuery(estId) });
    if (!table) return res.status(404).json({ success: false, message: 'Table introuvable.' });
    try {
      await assertWaiterTableAccess(req, table, estId);
    } catch (err) {
      return handleAccessError(res, err, next);
    }

    const updates = { ...req.body, modified_by: req.user._id };
    const doc = await Table.findOneAndUpdate(
      { _id: req.params.id, ...baseQuery(estId) },
      { $set: updates },
      { new: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: 'Table introuvable.' });
    emitTablesChanged(estId, doc.room);
    res.json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
}

async function deleteTable(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const doc = await Table.findOne({ _id: req.params.id, ...baseQuery(estId) });
    if (!doc) return res.status(404).json({ success: false, message: 'Table introuvable.' });
    if (doc.current_order) {
      return res.status(400).json({ success: false, message: 'Table avec commande active.' });
    }
    doc.is_deleted = true;
    doc.deleted_at = new Date();
    doc.deleted_by = req.user._id;
    await doc.save();
    emitTablesChanged(estId, doc.room);
    res.json({ success: true, message: 'Table supprimée.' });
  } catch (err) {
    next(err);
  }
}

async function updateTableStatus(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const { status } = req.body;
    if (!status || !TABLE_STATUS.includes(status)) {
      return res.status(400).json({ success: false, message: 'Statut invalide.' });
    }

    const table = await Table.findOne({ _id: req.params.id, ...baseQuery(estId) });
    if (!table) return res.status(404).json({ success: false, message: 'Table introuvable.' });

    try {
      await assertWaiterTableAccess(req, table, estId);
    } catch (err) {
      return handleAccessError(res, err, next);
    }

    if (status === 'libre') {
      await syncTableFromOrders(table._id, estId);
      const refreshed = await Table.findById(table._id);
      emitTablesChanged(estId, table.room);
      return res.json({ success: true, data: refreshed });
    }

    table.status = status;
    table.modified_by = req.user._id;
    await table.save();

    emitTablesChanged(estId, table.room);

    res.json({ success: true, data: table });
  } catch (err) {
    next(err);
  }
}

async function assignOrder(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const { order_id } = req.body;
    const table = await Table.findOne({ _id: req.params.id, ...baseQuery(estId) });
    if (!table) return res.status(404).json({ success: false, message: 'Table introuvable.' });

    const order = await Order.findOne({ _id: order_id, establishment: estId, is_deleted: false });
    if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable.' });
    try {
      await assertWaiterOrderAccess(req, order, 'table');
    } catch (err) {
      return handleAccessError(res, err, next);
    }

    if (table.current_order && table.current_order.toString() !== order_id) {
      return res.status(400).json({ success: false, message: 'Table déjà occupée.' });
    }

    table.current_order = order._id;
    table.status = 'occupee';
    await table.save();
    order.table = table._id;
    order.room = table.room;
    await order.save();

    emitTablesChanged(estId, table.room);
    emitOrderChanged(estId, order._id);

    res.json({ success: true, data: table });
  } catch (err) {
    next(err);
  }
}

async function unassignOrder(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const table = await Table.findOne({ _id: req.params.id, ...baseQuery(estId) });
    if (!table) return res.status(404).json({ success: false, message: 'Table introuvable.' });
    try {
      await assertWaiterTableAccess(req, table, estId);
    } catch (err) {
      return handleAccessError(res, err, next);
    }
    table.current_order = undefined;
    table.status = 'libre';
    await table.save();

    emitTablesChanged(estId, table.room);

    res.json({ success: true, data: table });
  } catch (err) {
    next(err);
  }
}

async function mergeTables(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const { table_ids: tableIds } = req.body;
    if (!Array.isArray(tableIds) || tableIds.length < 2) {
      return res.status(400).json({ success: false, message: 'Au moins 2 tables requises.' });
    }

    const idOrder = [...new Set(tableIds.map((id) => String(id)))];
    const tables = await Table.find({ _id: { $in: idOrder }, ...baseQuery(estId) });
    if (tables.length !== idOrder.length) {
      return res.status(400).json({ success: false, message: 'Tables invalides.' });
    }

    const orderedTables = idOrder
      .map((id) => tables.find((table) => String(table._id) === id))
      .filter(Boolean);

    const roomIds = new Set(orderedTables.map((table) => String(table.room?._id || table.room)));
    if (roomIds.size > 1) {
      return res.status(400).json({
        success: false,
        message: 'Les tables fusionnées doivent être dans la même salle.',
      });
    }

    const existingGroups = new Set(
      orderedTables.map((table) => table.merge_group_id).filter(Boolean),
    );
    if (existingGroups.size > 1) {
      return res.status(400).json({
        success: false,
        message: 'Séparez d\'abord les groupes de tables existants.',
      });
    }

    const activeOrderIds = new Set(
      orderedTables
        .map((table) => table.current_order && String(table.current_order._id || table.current_order))
        .filter(Boolean),
    );
    if (activeOrderIds.size > 1) {
      return res.status(400).json({
        success: false,
        message: 'Les tables ont des commandes différentes. Fusionnez les commandes avant de fusionner les tables.',
      });
    }

    for (const table of orderedTables) {
      try {
        await assertWaiterTableAccess(req, table, estId);
      } catch (err) {
        return handleAccessError(res, err, next);
      }
    }

    const primaryIndex = orderedTables.findIndex((table) => table.current_order);
    const rotated = primaryIndex > 0
      ? [...orderedTables.slice(primaryIndex), ...orderedTables.slice(0, primaryIndex)]
      : orderedTables;
    const primary = rotated[0];
    const groupId = existingGroups.size === 1
      ? [...existingGroups][0]
      : randomUUID();

    for (let i = 0; i < rotated.length; i += 1) {
      const table = rotated[i];
      table.merge_group_id = groupId;
      table.is_merge_primary = i === 0;
      if (i > 0 && primary.current_order) {
        table.current_order = primary.current_order;
        table.status = 'occupee';
      }
      table.modified_by = req.user._id;
      await table.save();
    }

    emitTablesChanged(estId, primary.room);

    res.json({ success: true, data: rotated, merge_group_id: groupId });
  } catch (err) {
    next(err);
  }
}

async function splitTables(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const table = await Table.findOne({ _id: req.params.id, ...baseQuery(estId) });
    if (!table?.merge_group_id) {
      return res.status(400).json({ success: false, message: 'Table non fusionnée.' });
    }
    try {
      await assertWaiterTableAccess(req, table, estId);
    } catch (err) {
      return handleAccessError(res, err, next);
    }

    const group = await Table.find({ merge_group_id: table.merge_group_id, ...baseQuery(estId) });
    const roomIds = new Set();
    for (const t of group) {
      if (!t.is_merge_primary) {
        t.current_order = undefined;
        t.status = 'libre';
      }
      t.merge_group_id = undefined;
      t.is_merge_primary = false;
      t.modified_by = req.user._id;
      await t.save();
      roomIds.add(String(t.room?._id || t.room));
    }

    for (const roomId of roomIds) {
      emitTablesChanged(estId, roomId);
    }

    res.json({ success: true, message: 'Tables séparées.' });
  } catch (err) {
    next(err);
  }
}

async function mergeOrders(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const { order_ids, target_order_id } = req.body;
    if (!Array.isArray(order_ids) || order_ids.length < 2) {
      return res.status(400).json({ success: false, message: 'Au moins 2 commandes requises.' });
    }

    const targetId = target_order_id || order_ids[0];
    const target = await Order.findOne({ _id: targetId, establishment: estId, is_deleted: false });
    if (!target) return res.status(404).json({ success: false, message: 'Commande cible introuvable.' });

    const allOrders = await Order.find({
      _id: { $in: order_ids },
      establishment: estId,
      is_deleted: false,
    });
    try {
      await assertWaiterOrdersAccess(req, allOrders, 'table');
    } catch (err) {
      return handleAccessError(res, err, next);
    }

    const sourceIds = order_ids.filter((id) => id.toString() !== targetId.toString());

    for (const srcId of sourceIds) {
      await OrderItem.updateMany({ order: srcId }, { order: target._id });
      await Order.updateOne(
        { _id: srcId },
        {
          status: 'cancelled',
          merged_into: target._id,
          is_deleted: false,
        }
      );
      target.merged_from_orders = target.merged_from_orders || [];
      if (!target.merged_from_orders.includes(srcId)) {
        target.merged_from_orders.push(srcId);
      }
      emitOrderChanged(estId, srcId);
    }

    await target.save();
    await recalcOrderTotals(target._id);

    const tables = await Table.find({ current_order: { $in: order_ids }, ...baseQuery(estId) });
    const roomIds = new Set();
    for (const t of tables) {
      t.current_order = target._id;
      t.status = 'occupee';
      t.modified_by = req.user._id;
      await t.save();
      roomIds.add(String(t.room?._id || t.room));
    }

    emitOrderChanged(estId, target._id);
    for (const roomId of roomIds) {
      emitTablesChanged(estId, roomId);
    }

    res.json({ success: true, data: target });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listTables,
  createTable,
  updateTable,
  updateTableStatus,
  deleteTable,
  assignOrder,
  unassignOrder,
  mergeTables,
  splitTables,
  mergeOrders,
};
