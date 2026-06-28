const { Establishment, User } = require('../models');
const { codes, serializers, tenant } = require('../utils')();
const { generateEstablishmentCode } = codes;
const { serializeEstablishmentCurrent, serializeEstablishmentSettings } = serializers;
const {
  resolveRoleKey,
  findEstablishmentForUser,
  resolveEstablishmentId,
  getUserEstablishmentId,
} = tenant;
const { audit } = require('../services')();
const { logAudit } = audit;
const {
  normalizeKitchenPrinters,
  normalizeCaissePrinter,
} = require('../utils/printer-config');
const { listSystemPrinters } = require('../services/printer-transport');

function mergeEstablishmentClientPayload(establishment) {
  return serializeEstablishmentCurrent(establishment);
}

async function loadEstablishmentForUser(req, res) {
  const establishment = await findEstablishmentForUser(req.user);
  const roleKey = await resolveRoleKey(req.user);

  if (!establishment) {
    res.status(404).json({
      success: false,
      message: 'Établissement introuvable.',
      code: 'ESTABLISHMENT_NOT_FOUND',
    });
    return null;
  }

  if (!establishment.is_setup_complete && roleKey !== 'superadmin') {
    res.status(404).json({
      success: false,
      message: 'Établissement introuvable.',
      code: 'ESTABLISHMENT_NOT_FOUND',
    });
    return null;
  }

  return establishment;
}

const BRANDING_FIELDS = ['name', 'phone', 'email', 'website', 'logo', 'address'];
const FISCAL_FIELDS = ['patente', 'ice', 'identifiant_fiscal', 'rc', 'tax_id_label', 'legal_name'];
const OPS_FIELDS = [
  'tables_enabled',
  'server_sections_enabled',
  'delivery_enabled',
  'fiscal_morocco_enabled',
  'waiter_shift_manual_start',
  'kitchen_shift_manual_start',
  'kds_kitchen_accept_reject',
  'kds_accept_required',
  'maincolor',
  'secondarycolor',
  'currency',
  'tax_rate',
  'auto_print_on_send',
  'printers',
  'caisse_printer',
  'checkout_ui_mode',
  'waiter_can_void_payment',
  'waiter_can_cancel_order',
  'waiter_service_served_only',
  'service_ready_on_send',
  'waiter_quick_pin_mode',
  ...FISCAL_FIELDS,
];

function canEditBranding(roleKey) {
  return ['superadmin', 'owner'].includes(roleKey);
}

function canEditCdsPin(roleKey) {
  return ['superadmin', 'owner', 'manager'].includes(roleKey);
}

async function getCurrent(req, res, next) {
  try {
    const establishment = await loadEstablishmentForUser(req, res);
    if (!establishment) return;

    res.json({ success: true, data: serializeEstablishmentCurrent(establishment) });
  } catch (err) {
    next(err);
  }
}

async function getSettings(req, res, next) {
  try {
    const establishment = await loadEstablishmentForUser(req, res);
    if (!establishment) return;

    const roleKey = await resolveRoleKey(req.user);
    const data = serializeEstablishmentSettings(establishment);
    if (!canEditCdsPin(roleKey)) {
      delete data.cds_pin;
    }

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function linkSuperadminEstablishment(userId, establishmentId) {
  await User.updateOne(
    { _id: userId },
    { establishment: establishmentId, modified_by: userId },
  );
}

async function createCurrent(req, res, next) {
  try {
    if (!req.user?._id) {
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non identifié. Reconnectez-vous.',
        code: 'USER_NOT_IDENTIFIED',
      });
    }

    const roleKey = await resolveRoleKey(req.user);
    if (roleKey !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Seul le Super Admin peut créer l\'établissement initial.',
      });
    }

    const existingComplete = await Establishment.findOne({
      is_deleted: false,
      is_setup_complete: true,
    });
    if (existingComplete) {
      if (!getUserEstablishmentId(req.user)) {
        await linkSuperadminEstablishment(req.user._id, existingComplete._id);
        return res.json({
          success: true,
          message: 'Établissement associé à votre compte.',
          data: mergeEstablishmentClientPayload(existingComplete),
        });
      }
      return res.status(400).json({
        success: false,
        message: 'Un établissement est déjà configuré.',
      });
    }

    const {
      name, address, phone, email, website,
      patente, ice, identifiant_fiscal, rc,
    } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Nom de l\'établissement requis.',
      });
    }

    let establishment = await Establishment.findOne({ is_deleted: false });
    if (establishment) {
      establishment.name = name.trim();
      establishment.address = address;
      establishment.phone = phone;
      establishment.email = email;
      establishment.website = website;
      establishment.patente = patente;
      establishment.ice = ice;
      establishment.identifiant_fiscal = identifiant_fiscal;
      establishment.rc = rc;
      establishment.status = 'actif';
      establishment.is_setup_complete = true;
      establishment.modified_by = req.user._id;
      await establishment.save();
    } else {
      const code = await generateEstablishmentCode();
      establishment = await Establishment.create({
        code_establishment: code,
        name: name.trim(),
        address,
        phone,
        email,
        website,
        patente,
        ice,
        identifiant_fiscal,
        rc,
        status: 'actif',
        is_setup_complete: true,
        created_by: req.user._id,
      });
    }

    await linkSuperadminEstablishment(req.user._id, establishment._id);

    await logAudit({
      establishment: establishment._id,
      user: req.user,
      action: 'create',
      module: 'establishment',
      resource: 'establishment',
      resource_id: establishment._id,
      description: 'Établissement créé',
      req,
    });

    res.status(201).json({
      success: true,
      message: 'Établissement créé avec succès.',
      data: mergeEstablishmentClientPayload(establishment),
    });
  } catch (err) {
    next(err);
  }
}

async function updateCurrent(req, res, next) {
  try {
    const estId = await resolveEstablishmentId(req);
    if (!estId) {
      return res.status(404).json({ success: false, message: 'Établissement introuvable.' });
    }

    const roleKey = await resolveRoleKey(req.user);
    const updates = {};

    for (const key of OPS_FIELDS) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (canEditBranding(roleKey)) {
      for (const key of BRANDING_FIELDS) {
        if (req.body[key] !== undefined) updates[key] = req.body[key];
      }
    } else {
      const attempted = BRANDING_FIELDS.filter((key) => req.body[key] !== undefined);
      if (attempted.length) {
        return res.status(403).json({
          success: false,
          message: 'Seuls le super admin et le propriétaire peuvent modifier l\'identité de l\'établissement.',
        });
      }
    }

    if (req.body.cds_pin !== undefined) {
      if (!canEditCdsPin(roleKey)) {
        return res.status(403).json({
          success: false,
          message: 'Seuls le super admin, le propriétaire et le manager peuvent modifier le code CDS.',
        });
      }
      updates.cds_pin = req.body.cds_pin;
    }

    if (req.body.kds_kitchen_accept_reject !== undefined) {
      updates.kds_accept_required = req.body.kds_kitchen_accept_reject;
    }

    if (updates.printers !== undefined) {
      updates.printers = normalizeKitchenPrinters(updates.printers);
    }
    if (updates.caisse_printer !== undefined) {
      updates.caisse_printer = normalizeCaissePrinter(updates.caisse_printer);
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ success: false, message: 'Aucune modification.' });
    }

    updates.modified_by = req.user._id;

    const doc = await Establishment.findOneAndUpdate(
      { _id: estId, is_deleted: false },
      { $set: updates },
      { new: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: 'Établissement introuvable.' });
    res.json({ success: true, data: mergeEstablishmentClientPayload(doc) });
  } catch (err) {
    next(err);
  }
}

async function uploadLogo(req, res, next) {
  try {
    const roleKey = await resolveRoleKey(req.user);
    if (!canEditBranding(roleKey)) {
      return res.status(403).json({
        success: false,
        message: 'Seuls le super admin et le propriétaire peuvent modifier le logo.',
      });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Fichier image requis.' });
    }

    const estId = await resolveEstablishmentId(req);
    if (!estId) {
      return res.status(404).json({ success: false, message: 'Établissement introuvable.' });
    }

    const logo = `/api/uploads/establishments/${req.file.filename}`;
    const doc = await Establishment.findOneAndUpdate(
      { _id: estId, is_deleted: false },
      { $set: { logo, modified_by: req.user._id } },
      { new: true }
    );

    res.json({ success: true, data: { logo: doc.logo } });
  } catch (err) {
    next(err);
  }
}

async function getSystemPrinters(req, res, next) {
  try {
    const printers = await listSystemPrinters();
    res.json({
      success: true,
      data: {
        platform: process.platform,
        printers,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getCurrent,
  getSettings,
  createCurrent,
  updateCurrent,
  uploadLogo,
  getSystemPrinters,
  canEditBranding,
};
