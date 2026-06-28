const { buildCdsBoard, getSingleEstablishment, isCdsUnlocked } = require('../services/cds');

async function getInfo(req, res, next) {
  try {
    const establishment = await getSingleEstablishment();
    if (!establishment) {
      return res.status(503).json({ success: false, message: 'Établissement indisponible.' });
    }
    const unlocked = await isCdsUnlocked(establishment._id);
    res.json({
      success: true,
      data: {
        name: establishment.name,
        logo: establishment.logo,
        maincolor: establishment.maincolor,
        secondarycolor: establishment.secondarycolor,
        unlocked,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getBoard(req, res, next) {
  try {
    const establishment = await getSingleEstablishment();
    if (!establishment) {
      return res.status(503).json({ success: false, message: 'Établissement indisponible.' });
    }
    const unlocked = await isCdsUnlocked(establishment._id);
    if (!unlocked) {
      return res.status(403).json({
        success: false,
        code: 'CDS_LOCKED',
        message: 'Écran client en attente — connectez-vous au POS pour l\'activer.',
      });
    }
    const board = await buildCdsBoard(establishment._id);
    res.json({ success: true, data: board });
  } catch (err) {
    next(err);
  }
}

module.exports = { getInfo, getBoard };
