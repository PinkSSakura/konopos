const { Shift, Payment, User, Establishment } = require('../models');
const { query, serializers, staffexport } = require('../utils')();
const { getEstablishmentId } = query;
const { mapList, serializeShiftCurrent, serializeShiftHistory } = serializers;
const { canExportStaffReport } = staffexport;
const { shift, audit, print, reports } = require('../services')();
const { getWaiterDailyCloseReport, getWaiterDailyCloseReportForShift } = require('../services/waiter-daily-close');
const {
  findOpenShifts,
  validateShiftClose,
  closeShiftRecord,
  startShiftForUser,
} = require('../services/shift-close');
const { userHasPermission } = require('../services/permission');
const { buildWaiterDailyClosePdf } = reports;
const {
  isShiftRole,
  requiresManualShiftStart,
  requiresShiftAmounts,
  getPeriodRange,
  findActiveShift,
  resolveEstablishmentForUser,
} = shift;
const { logStaffActivity } = audit;

function sendPdf(res, buffer, filename) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}

async function resolveWaiterDailyCloseUser(req, estId) {
  const requestedUserId = req.query?.user_id || req.body?.user_id;
  const targetId = requestedUserId || req.user._id;

  if (!canExportStaffReport(req.user, targetId)) {
    return {
      error: {
        status: 403,
        message: 'Vous ne pouvez consulter que votre propre clôture.',
      },
    };
  }

  if (String(targetId) === String(req.user._id)) {
    return { user: req.user };
  }

  const user = await User.findOne({
    _id: targetId,
    establishment: estId,
    is_deleted: false,
  });
  if (!user) {
    return {
      error: {
        status: 404,
        message: 'Utilisateur introuvable.',
      },
    };
  }

  return { user };
}

async function loadEstablishmentForClose(estId) {
  return Establishment.findById(estId).select(
    'name legal_name address phone email patente ice identifiant_fiscal rc currency tax_id_label tax_rate',
  );
}

async function getCurrentShift(req, res, next) {
  try {
    const roleKey = req.user?.role?.role_key;
    const establishment = await resolveEstablishmentForUser(req.user);
    if (!isShiftRole(roleKey)) {
      return res.json({ success: true, data: { required: false } });
    }
    const estId = getEstablishmentId(req);
    const active = await findActiveShift(req.user._id, estId);
    const manualStart = requiresManualShiftStart(roleKey, establishment);
    return res.json({
      success: true,
      data: {
        required: true,
        manual_start_required: manualStart,
        auto_shift: !manualStart,
        requires_amounts: requiresShiftAmounts(roleKey),
        active_shift: serializeShiftCurrent(active),
      },
    });
  } catch (err) {
    next(err);
  }
}

async function startShift(req, res, next) {
  try {
    const roleKey = req.user?.role?.role_key;
    if (!isShiftRole(roleKey)) {
      return res.status(400).json({ success: false, message: 'Ce rôle n\'utilise pas les shifts.' });
    }
    if (roleKey === 'waiter') {
      return res.status(403).json({
        success: false,
        message: 'Demandez à un administrateur de démarrer votre shift.',
        code: 'SHIFT_ADMIN_REQUIRED',
      });
    }
    const estId = getEstablishmentId(req);
    const existing = await findActiveShift(req.user._id, estId);
    if (existing) {
      return res.json({ success: true, data: serializeShiftCurrent(existing), message: 'Shift déjà ouvert.' });
    }

    const openingAmount = Number(req.body?.opening_amount || 0);
    if (requiresShiftAmounts(roleKey) && (Number.isNaN(openingAmount) || openingAmount < 0)) {
      return res.status(400).json({ success: false, message: 'Montant de départ invalide.' });
    }

    const shift = await Shift.create({
      user: req.user._id,
      establishment: estId,
      opened_by: req.user._id,
      opening_amount: requiresShiftAmounts(roleKey) ? openingAmount : 0,
      source: req.session?.is_pin_session ? 'systempos' : 'manual',
      source_systempos_session: req.session?.parent_systempos_session || null,
      role_key: roleKey,
      notes: req.body?.notes,
    });
    req.session.shift = shift._id;
    await req.session.save();

    await logStaffActivity({
      establishment: estId,
      user: req.user,
      action: 'shift_start',
      module: 'shifts',
      resource: 'shift',
      resource_id: shift._id,
      description: 'Ouverture de shift',
      req,
    });

    return res.status(201).json({
      success: true,
      data: serializeShiftCurrent(shift),
      message: 'Shift ouvert.',
      meta: {
        redirect_to_pin: Boolean(req.session?.is_pin_session && ['cook', 'barman'].includes(roleKey)),
      },
    });
  } catch (err) {
    next(err);
  }
}

async function closeShift(req, res, next) {
  try {
    const roleKey = req.user?.role?.role_key;
    if (!isShiftRole(roleKey)) {
      return res.status(400).json({ success: false, message: 'Ce rôle n\'utilise pas les shifts.' });
    }
    const estId = getEstablishmentId(req);
    const shift = await findActiveShift(req.user._id, estId);
    if (!shift) {
      return res.status(404).json({ success: false, message: 'Aucun shift actif.' });
    }

    const establishment = await Establishment.findById(estId).select('shift_cash_optional name');
    const closingAmount = Number(req.body?.closing_amount || 0);
    const { needsAmounts } = await validateShiftClose({
      shift,
      user: req.user,
      establishment,
      closingAmount,
      force: false,
    });

    await closeShiftRecord({
      shift,
      closedByUser: req.user,
      closingAmount,
      notes: req.body?.notes,
      needsAmounts,
    });

    await logStaffActivity({
      establishment: estId,
      user: req.user,
      action: 'shift_close',
      module: 'shifts',
      resource: 'shift',
      resource_id: shift._id,
      description: 'Clôture de shift',
      req,
    });

    let printResult = null;
    let report = null;
    if (roleKey === 'waiter') {
      try {
        report = await getWaiterDailyCloseReportForShift(estId, req.user, shift);
        printResult = await print.printWaiterDailyClose(estId, report);
      } catch (printErr) {
        printResult = { skipped: true, reason: printErr.message || 'Erreur impression' };
      }
    }

    return res.json({
      success: true,
      data: serializeShiftHistory(shift),
      report,
      message: 'Shift clôturé.',
      meta: { daily_close_print: printResult },
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        message: err.message,
        code: err.code,
        data: err.data,
      });
    }
    next(err);
  }
}

async function listOpenShifts(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const shifts = await findOpenShifts(estId);
    const data = await Promise.all(shifts.map(async (s) => {
      const user = await User.findById(s.user).select('fullname');
      return {
        ...serializeShiftCurrent(s),
        waiter: user ? { _id: user._id, fullname: user.fullname } : null,
      };
    }));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function startShiftForUserHandler(req, res, next) {
  try {
    if (!(await userHasPermission(req.user, 'shift_manage', getEstablishmentId(req)))) {
      return res.status(403).json({ success: false, message: 'Permission shift_manage requise.' });
    }
    const estId = getEstablishmentId(req);
    const targetId = req.body?.user_id;
    if (!targetId) {
      return res.status(400).json({ success: false, message: 'user_id requis.' });
    }
    const target = await User.findOne({ _id: targetId, establishment: estId, is_deleted: false }).populate('role');
    if (!target) {
      return res.status(404).json({ success: false, message: 'Serveur introuvable.' });
    }
    const roleKey = target.role?.role_key;
    if (roleKey !== 'waiter') {
      return res.status(400).json({ success: false, message: 'Seuls les serveurs ont des shifts de service.' });
    }
    const shift = await startShiftForUser({
      targetUser: target,
      establishmentId: estId,
      openedBy: req.user,
      openingAmount: req.body?.opening_amount,
      shiftLabel: req.body?.shift_label,
      roleKey: 'waiter',
      source: 'manual',
    });
    res.status(201).json({ success: true, data: serializeShiftCurrent(shift), message: 'Shift ouvert.' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    next(err);
  }
}

async function closeShiftForUserHandler(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const targetId = req.body?.user_id || req.user._id;
    const isSelf = String(targetId) === String(req.user._id);

    if (!isSelf && !(await userHasPermission(req.user, 'shift_manage', estId))) {
      return res.status(403).json({ success: false, message: 'Permission shift_manage requise.' });
    }
    if (isSelf && !isShiftRole(req.user?.role?.role_key)) {
      return res.status(400).json({ success: false, message: 'Ce rôle n\'utilise pas les shifts.' });
    }

    const target = isSelf
      ? req.user
      : await User.findOne({ _id: targetId, establishment: estId, is_deleted: false });
    if (!target) {
      return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
    }

    const shift = await findActiveShift(target._id, estId);
    if (!shift) {
      return res.status(404).json({ success: false, message: 'Aucun shift actif.' });
    }

    const establishment = await Establishment.findById(estId).select('shift_cash_optional name');
    const closingAmount = Number(req.body?.closing_amount || 0);
    const force = Boolean(req.body?.force);
    const { needsAmounts } = await validateShiftClose({
      shift,
      user: req.user,
      establishment,
      closingAmount,
      force,
      reassignToShiftId: req.body?.reassign_to_shift_id,
    });

    await closeShiftRecord({
      shift,
      closedByUser: req.user,
      closingAmount,
      notes: req.body?.notes,
      needsAmounts,
    });

    const report = await getWaiterDailyCloseReportForShift(estId, target, shift);
    let printResult = null;
    try {
      printResult = await print.printWaiterDailyClose(estId, report);
    } catch (printErr) {
      printResult = { skipped: true, reason: printErr.message || 'Erreur impression' };
    }

    res.json({
      success: true,
      data: serializeShiftHistory(shift),
      report,
      message: 'Clôture du jour — shift clôturé.',
      meta: { daily_close_print: printResult },
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        message: err.message,
        code: err.code,
        data: err.data,
      });
    }
    next(err);
  }
}

async function listMyShiftHistory(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const period = req.query?.period || 'month';
    const page = Math.max(1, Number.parseInt(req.query?.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query?.limit, 10) || 10));
    const { from, to } = getPeriodRange(period, req.query?.date);

    const all = await Shift.find({
      user: req.user._id,
      establishment: estId,
      clock_in: { $gte: from, $lte: to },
    }).sort({ clock_in: -1 });

    const total = all.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const data = all.slice((safePage - 1) * limit, safePage * limit);

    const totalMs = all.reduce((sum, s) => {
      const end = s.clock_out ? new Date(s.clock_out) : new Date();
      const start = new Date(s.clock_in);
      if (Number.isNaN(start.getTime())) return sum;
      return sum + (end - start);
    }, 0);

    res.json({
      success: true,
      data: mapList(data, serializeShiftHistory),
      meta: {
        period,
        from,
        to,
        count: total,
        page: safePage,
        limit,
        total_pages: totalPages,
        total_hours: Math.round((totalMs / 3600000) * 100) / 100,
      },
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    next(err);
  }
}

async function getMyDailySummary(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const period = req.query?.period || 'day';
    const { from, to } = getPeriodRange(period, req.query?.date);

    const payments = await Payment.find({
      establishment: estId,
      processed_by: req.user._id,
      processed_at: { $gte: from, $lte: to },
      is_void: false,
    }).select('amount method processed_at');

    const total = payments.reduce((s, p) => s + (p.amount || 0), 0);
    const byMethod = payments.reduce((acc, p) => {
      const key = p.method || 'other';
      acc[key] = (acc[key] || 0) + (p.amount || 0);
      return acc;
    }, {});

    const shifts = await Shift.find({
      user: req.user._id,
      establishment: estId,
      clock_in: { $gte: from, $lte: to },
    }).select('clock_in clock_out is_active');

    const shiftMs = shifts.reduce((sum, s) => {
      const end = s.clock_out ? new Date(s.clock_out) : (s.is_active ? new Date() : new Date(s.clock_in));
      return sum + (end - new Date(s.clock_in));
    }, 0);

    res.json({
      success: true,
      data: {
        period,
        from,
        to,
        count: payments.length,
        total,
        by_method: byMethod,
        shift_count: shifts.length,
        shift_hours: Math.round((shiftMs / 3600000) * 100) / 100,
      },
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    next(err);
  }
}

async function resolveCloseShiftDoc(establishmentId, userId, shiftIdInput) {
  if (shiftIdInput) {
    return Shift.findOne({
      _id: shiftIdInput,
      establishment: establishmentId,
      user: userId,
    });
  }
  const active = await findActiveShift(userId, establishmentId);
  if (active) return active;
  return Shift.findOne({
    establishment: establishmentId,
    user: userId,
    is_active: false,
  }).sort({ clock_out: -1, clock_in: -1 });
}

async function getWaiterCloseShiftOptions(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const resolved = await resolveWaiterDailyCloseUser(req, estId);
    if (resolved.error) {
      return res.status(resolved.error.status).json({
        success: false,
        message: resolved.error.message,
      });
    }
    const userId = resolved.user._id;
    const shifts = await Shift.find({
      establishment: estId,
      user: userId,
    })
      .sort({ clock_in: -1 })
      .limit(40)
      .select('_id clock_in clock_out is_active shift_label source role_key');

    const data = shifts.map((s) => serializeShiftHistory(s));
    const defaultId = data.find((s) => s.is_active)?._id || data[0]?._id || null;
    res.json({ success: true, data, meta: { default_shift_id: defaultId } });
  } catch (err) {
    next(err);
  }
}

async function getWaiterDailyClose(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const resolved = await resolveWaiterDailyCloseUser(req, estId);
    if (resolved.error) {
      return res.status(resolved.error.status).json({
        success: false,
        message: resolved.error.message,
      });
    }

    const shiftDoc = await resolveCloseShiftDoc(
      estId,
      resolved.user._id,
      req.query?.shift_id,
    );

    const data = shiftDoc
      ? await getWaiterDailyCloseReportForShift(estId, resolved.user, shiftDoc)
      : await getWaiterDailyCloseReport(estId, resolved.user, req.query?.date);
    res.json({ success: true, data });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    next(err);
  }
}

async function printWaiterDailyClose(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const resolved = await resolveWaiterDailyCloseUser(req, estId);
    if (resolved.error) {
      return res.status(resolved.error.status).json({
        success: false,
        message: resolved.error.message,
      });
    }

    const shiftDoc = await resolveCloseShiftDoc(
      estId,
      resolved.user._id,
      req.body?.shift_id || req.query?.shift_id,
    );
    const report = shiftDoc
      ? await getWaiterDailyCloseReportForShift(estId, resolved.user, shiftDoc)
      : await getWaiterDailyCloseReport(
        estId,
        resolved.user,
        req.body?.date || req.query?.date,
      );
    const result = await print.printWaiterDailyClose(estId, report);
    if (result.skipped) {
      return res.status(400).json({
        success: false,
        message: result.reason || 'Impression impossible.',
      });
    }
    res.json({ success: true, data: result, message: 'Rapport imprimé sur la caisse.' });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    next(err);
  }
}

async function exportWaiterDailyClosePdf(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const resolved = await resolveWaiterDailyCloseUser(req, estId);
    if (resolved.error) {
      return res.status(resolved.error.status).json({
        success: false,
        message: resolved.error.message,
      });
    }

    const establishment = await loadEstablishmentForClose(estId);
    const shiftDoc = await resolveCloseShiftDoc(
      estId,
      resolved.user._id,
      req.query?.shift_id,
    );
    const report = shiftDoc
      ? await getWaiterDailyCloseReportForShift(estId, resolved.user, shiftDoc)
      : await getWaiterDailyCloseReport(estId, resolved.user, req.query?.date);
    const buffer = await buildWaiterDailyClosePdf(establishment, report);
    const dateSafe = (req.query?.date || new Date().toISOString().slice(0, 10)).replace(/[^\d-]/g, '');
    const waiterSlug = (report.waiter?.fullname || 'serveur').replace(/[^\w.-]+/g, '-').slice(0, 40);
    sendPdf(res, buffer, `cloture-jour-${waiterSlug}-${dateSafe}.pdf`);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    next(err);
  }
}

async function getMyWaiterDailyClose(req, res, next) {
  return getWaiterDailyClose(req, res, next);
}

async function printMyWaiterDailyClose(req, res, next) {
  return printWaiterDailyClose(req, res, next);
}

module.exports = {
  closeShiftForUserHandler,
  listOpenShifts,
  startShiftForUserHandler,
  getCurrentShift,
  startShift,
  closeShift,
  listMyShiftHistory,
  getMyDailySummary,
  getMyWaiterDailyClose,
  printMyWaiterDailyClose,
  getWaiterCloseShiftOptions,
  getWaiterDailyClose,
  printWaiterDailyClose,
  exportWaiterDailyClosePdf,
};
