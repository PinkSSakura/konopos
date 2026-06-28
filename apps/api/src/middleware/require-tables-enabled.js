const { Establishment } = require('../models');
const { query } = require('../utils')();
const { getEstablishmentId } = query;

async function requireTablesEnabled(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const establishment = await Establishment.findById(estId).select('tables_enabled');
    if (establishment?.tables_enabled === false) {
      return res.status(403).json({
        success: false,
        message: 'Le module tables est désactivé pour cet établissement.',
      });
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { requireTablesEnabled };
