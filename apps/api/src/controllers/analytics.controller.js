const { Establishment } = require('../models');
const { query, staffexport } = require('../utils')();
const { resolveEstablishmentId } = query;
const { canExportStaffReport, canExportAnyStaffReport } = staffexport;
const { reports } = require('../services')();
const {
  getDashboardAnalytics,
  getClosingSummaryForRange,
  getStaffDailyReport,
  buildBusinessPdf,
  buildStaffPdf,
  listStaffUsers,
} = reports;
function sendPdf(res, buffer, filename) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}

function formatFilename(prefix, dateStr) {
  const safe = (dateStr || new Date().toISOString().slice(0, 10)).replace(/[^\d-]/g, '');
  return `${prefix}-${safe}.pdf`;
}

async function loadEstablishment(estId) {
  return Establishment.findById(estId).select(
    'name legal_name address phone email patente ice identifiant_fiscal rc currency tax_id_label tax_rate'
  );
}

async function dashboard(req, res, next) {
  try {
    const estId = await resolveEstablishmentId(req);
    if (!estId) {
      return res.status(404).json({ success: false, message: 'Établissement introuvable.' });
    }
    const data = await getDashboardAnalytics(estId, {
      period: req.query.period,
      date: req.query.date,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function exportBusinessPdf(req, res, next) {
  try {
    const estId = await resolveEstablishmentId(req);
    if (!estId) {
      return res.status(404).json({ success: false, message: 'Établissement introuvable.' });
    }

    const establishment = await loadEstablishment(estId);
    const analytics = await getDashboardAnalytics(estId, {
      period: req.query.period,
      date: req.query.date,
    });
    const closing = await getClosingSummaryForRange(estId, analytics.from, analytics.to);
    const buffer = await buildBusinessPdf(establishment, analytics, closing);
    const period = analytics.period || 'day';
    sendPdf(res, buffer, formatFilename(`rapport-${period}`, req.query.date));
  } catch (err) {
    next(err);
  }
}

async function exportStaffPdf(req, res, next) {
  try {
    const estId = await resolveEstablishmentId(req);
    if (!estId) {
      return res.status(404).json({ success: false, message: 'Établissement introuvable.' });
    }

    const mode = req.query.mode || 'person';
    const date = req.query.date;
    const roleKey = req.query.role_key || null;
    const requestedUserId = req.query.user_id || req.user._id;
    const requesterRole = req.user.role?.role_key;

    if (!canExportStaffReport(req.user, requestedUserId)) {
      return res.status(403).json({
        success: false,
        message: 'Vous ne pouvez exporter que votre propre rapport.',
      });
    }

    if (mode === 'full' && !canExportAnyStaffReport(requesterRole)) {
      return res.status(403).json({
        success: false,
        message: 'Export complet réservé à la direction.',
      });
    }

    if (mode === 'role' && !canExportAnyStaffReport(requesterRole)) {
      return res.status(403).json({
        success: false,
        message: 'Export par rôle réservé à la direction.',
      });
    }

    if (mode === 'role' && !roleKey) {
      return res.status(400).json({
        success: false,
        message: 'role_key requis pour l\'export par rôle.',
      });
    }

    const establishment = await loadEstablishment(estId);
    const report = await getStaffDailyReport(estId, {
      date,
      mode: mode === 'full' ? 'full' : (mode === 'role' ? 'role' : 'person'),
      roleKey,
      userId: mode === 'person' ? requestedUserId : undefined,
    });

    const buffer = await buildStaffPdf(establishment, report);
    const suffix = mode === 'role' ? roleKey : (mode === 'full' ? 'equipe' : 'personnel');
    sendPdf(res, buffer, formatFilename(`rapport-${suffix}`, date));
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    next(err);
  }
}

async function listStaffReportUsers(req, res, next) {
  try {
    if (!canExportAnyStaffReport(req.user.role?.role_key)) {
      return res.status(403).json({
        success: false,
        message: 'Accès réservé à la direction.',
      });
    }

    const estId = await resolveEstablishmentId(req);
    if (!estId) {
      return res.status(404).json({ success: false, message: 'Établissement introuvable.' });
    }

    const users = await listStaffUsers(estId, req.query.role_key || null);
    res.json({
      success: true,
      data: users.map((u) => ({
        _id: u._id,
        fullname: u.fullname,
        role_key: u.role?.role_key,
        role_name: u.role?.name,
      })),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  dashboard,
  exportBusinessPdf,
  exportStaffPdf,
  listStaffReportUsers,
};
