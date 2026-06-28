const { Establishment, User, Role } = require('../models');
const { codes } = require('../utils')();
const { generateEstablishmentCode } = codes;
const { audit } = require('../services')();
const { logAudit } = audit;

async function getSetupStatus(req, res, next) {
  try {
    const establishment = await Establishment.findOne({ is_deleted: false });
    const superadminRole = await Role.findOne({ role_key: 'superadmin' }).select('_id');
    const superadmin = superadminRole
      ? await User.findOne({ role: superadminRole._id, is_deleted: false }).select('_id')
      : null;

    res.json({
      success: true,
      data: {
        needs_setup: !establishment?.is_setup_complete,
        has_complete_establishment: Boolean(establishment?.is_setup_complete),
        has_establishment: Boolean(establishment),
        has_superadmin: Boolean(superadmin),
      },
    });
  } catch (err) {
    next(err);
  }
}

async function completeSetup(req, res, next) {
  try {
    if (req.user?.role?.role_key !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Accès réservé au Super Admin.' });
    }

    const existing = await Establishment.findOne({ is_setup_complete: true, is_deleted: false });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Configuration déjà effectuée.' });
    }

    const {
      establishment_name,
      address,
      phone,
    } = req.body;

    if (!establishment_name) {
      return res.status(400).json({
        success: false,
        message: 'Nom de l\'établissement requis.',
      });
    }

    let establishment = await Establishment.findOne({ is_deleted: false });
    if (!establishment) {
      const code = await generateEstablishmentCode();
      establishment = await Establishment.create({
        code_establishment: code,
        name: establishment_name,
        address,
        phone,
        status: 'actif',
        is_setup_complete: true,
      });
    } else {
      establishment.name = establishment_name;
      establishment.address = address;
      establishment.phone = phone;
      establishment.is_setup_complete = true;
      establishment.status = 'actif';
      await establishment.save();
    }

    await User.updateOne(
      { _id: req.user._id },
      { establishment: establishment._id, modified_by: req.user._id }
    );

    await logAudit({
      establishment: establishment._id,
      user: req.user,
      action: 'setup_complete',
      module: 'setup',
      resource: 'establishment',
      resource_id: establishment._id,
      description: 'Configuration initiale terminée',
      req,
    });

    res.status(201).json({
      success: true,
      message: 'Établissement créé avec succès.',
      data: { establishment_id: establishment._id },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getSetupStatus, completeSetup };
