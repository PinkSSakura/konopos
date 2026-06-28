const { Shift, ShiftPlan, User, Role } = require('../../models');
const { query, serializers } = require('../../utils')();
const { getEstablishmentId } = query;
const { mapList, serializeShiftAdmin, serializeShiftPlan } = serializers;

function parseDayBounds(fromStr, toStr) {
  let from = fromStr ? new Date(fromStr) : null;
  let to = toStr ? new Date(toStr) : null;
  if (from && Number.isNaN(from.getTime())) from = null;
  if (to && Number.isNaN(to.getTime())) to = null;
  if (from) from.setHours(0, 0, 0, 0);
  if (to) {
    to.setHours(23, 59, 59, 999);
  } else if (from) {
    to = new Date(from);
    to.setHours(23, 59, 59, 999);
  }
  return { from, to };
}

async function listShifts(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const filter = { establishment: estId };
    if (req.query.active === 'true') filter.is_active = true;
    if (req.query.active === 'false') filter.is_active = false;

    const { from, to } = parseDayBounds(req.query.from, req.query.to);
    if (from || to) {
      filter.clock_in = {};
      if (from) filter.clock_in.$gte = from;
      if (to) filter.clock_in.$lte = to;
    }
    const shifts = await Shift.find(filter)
      .populate({ path: 'user', select: 'fullname role', populate: { path: 'role', select: 'role_key name' } })
      .sort({ clock_in: -1 })
      .limit(500);
    const roleKey = req.query.role_key;
    const filtered = roleKey
      ? shifts.filter((s) => s.user?.role?.role_key === roleKey)
      : shifts;
    res.json({ success: true, data: mapList(filtered, serializeShiftAdmin) });
  } catch (err) {
    next(err);
  }
}

async function listPlans(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const filter = { establishment: estId, is_deleted: { $ne: true } };
    const { from, to } = parseDayBounds(req.query.from, req.query.to);
    if (from || to) {
      filter.planned_start = {};
      if (from) filter.planned_start.$gte = from;
      if (to) filter.planned_start.$lte = to;
    }
    const plans = await ShiftPlan.find(filter)
      .populate({ path: 'user', select: 'fullname role', populate: { path: 'role', select: 'role_key name' } })
      .sort({ planned_start: 1 })
      .limit(500);
    res.json({ success: true, data: mapList(plans, serializeShiftPlan) });
  } catch (err) {
    next(err);
  }
}

function validatePlanDates(plannedStart, plannedEnd) {
  const start = new Date(plannedStart);
  const end = new Date(plannedEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 'Dates de planning invalides.';
  }
  if (end <= start) {
    return 'La fin doit être après le début.';
  }
  return null;
}

const SHIFT_STAFF_ROLES = ['waiter', 'cook', 'barman'];

async function listStaff(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const roles = await Role.find({ role_key: { $in: SHIFT_STAFF_ROLES } }).select('_id role_key name');
    const roleIds = roles.map((r) => r._id);
    const users = await User.find({
      establishment: estId,
      is_deleted: false,
      is_active: true,
      status: 'actif',
      role: { $in: roleIds },
    })
      .populate('role', 'name role_key')
      .sort({ fullname: 1 })
      .select('fullname role');

    res.json({
      success: true,
      data: users.map((u) => ({
        _id: u._id,
        fullname: u.fullname,
        role: u.role
          ? { _id: u.role._id, name: u.role.name, role_key: u.role.role_key }
          : null,
      })),
    });
  } catch (err) {
    next(err);
  }
}

async function createPlan(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const { user: userId, planned_start, planned_end, notes } = req.body;
    const dateError = validatePlanDates(planned_start, planned_end);
    if (dateError) {
      return res.status(400).json({ success: false, message: dateError });
    }
    const user = await User.findOne({ _id: userId, establishment: estId, is_deleted: false }).populate('role');
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
    const roleKey = user.role?.role_key;
    if (!['waiter', 'cook', 'barman'].includes(roleKey)) {
      return res.status(400).json({ success: false, message: 'Planning autorisé seulement waiter/cook/barman.' });
    }
    const plan = await ShiftPlan.create({
      establishment: estId,
      user: user._id,
      role_key: roleKey,
      planned_start,
      planned_end,
      notes,
    });
    res.status(201).json({ success: true, data: plan });
  } catch (err) {
    next(err);
  }
}

async function updatePlan(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const existing = await ShiftPlan.findOne({ _id: req.params.id, establishment: estId });
    if (!existing) return res.status(404).json({ success: false, message: 'Planning introuvable.' });

    const updates = {};
    if (req.body.planned_start !== undefined) updates.planned_start = req.body.planned_start;
    if (req.body.planned_end !== undefined) updates.planned_end = req.body.planned_end;
    if (req.body.notes !== undefined) updates.notes = req.body.notes;

    if (req.body.user !== undefined) {
      const user = await User.findOne({ _id: req.body.user, establishment: estId, is_deleted: false }).populate('role');
      if (!user) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
      const roleKey = user.role?.role_key;
      if (!['waiter', 'cook', 'barman'].includes(roleKey)) {
        return res.status(400).json({ success: false, message: 'Planning autorisé seulement waiter/cook/barman.' });
      }
      updates.user = user._id;
      updates.role_key = roleKey;
    }

    const start = updates.planned_start ?? existing.planned_start;
    const end = updates.planned_end ?? existing.planned_end;
    const dateError = validatePlanDates(start, end);
    if (dateError) {
      return res.status(400).json({ success: false, message: dateError });
    }

    const plan = await ShiftPlan.findOneAndUpdate(
      { _id: req.params.id, establishment: estId },
      { $set: updates },
      { new: true }
    )
      .populate({ path: 'user', select: 'fullname role', populate: { path: 'role', select: 'role_key name' } });
    res.json({ success: true, data: plan });
  } catch (err) {
    next(err);
  }
}

async function deletePlan(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const doc = await ShiftPlan.findOneAndDelete({ _id: req.params.id, establishment: estId });
    if (!doc) return res.status(404).json({ success: false, message: 'Planning introuvable.' });
    res.json({ success: true, message: 'Planning supprimé.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { listShifts, listPlans, listStaff, createPlan, updatePlan, deletePlan };
