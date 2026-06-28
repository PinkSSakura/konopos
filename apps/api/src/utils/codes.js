const { Establishment } = require('../models');

/**
 * Horodatage : YYYY + dd + MM + HH + mm + ss
 * (année, jour, mois, heure, minute, seconde)
 */
function buildTimestampSuffix(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const YYYY = date.getFullYear();
  const dd = pad(date.getDate());
  const MM = pad(date.getMonth() + 1);
  const HH = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${YYYY}${dd}${MM}${HH}${mm}${ss}`;
}

async function getEstablishmentCode(establishmentId) {
  const est = await Establishment.findById(establishmentId).select('code_establishment');
  if (!est?.code_establishment) {
    const err = new Error('Code établissement manquant. Complétez la configuration.');
    err.status = 500;
    throw err;
  }
  return est.code_establishment;
}

/**
 * Référence : {code_établissement}{YYYYddMMHHmmss}[suffixe]
 * suffixe = millisecondes si collision (ex. 045)
 */
async function generateEstablishmentReference(establishmentId, options = {}) {
  const { Model, field, inlinePrefix = '' } = options;
  if (!establishmentId) {
    const err = new Error('Établissement requis pour générer la référence.');
    err.status = 500;
    throw err;
  }
  const estCode = await getEstablishmentCode(establishmentId);

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const now = new Date();
    const ts = buildTimestampSuffix(now);
    const ms = attempt > 0 ? String(now.getMilliseconds()).padStart(3, '0') : '';
    const code = `${estCode}${inlinePrefix}${ts}${ms}`;

    if (!Model || !field) return code;

    // eslint-disable-next-line no-await-in-loop
    const exists = await Model.exists({ [field]: code });
    if (!exists) return code;
  }

  const err = new Error('Impossible de générer une référence unique.');
  err.status = 500;
  throw err;
}

/** Code établissement initial (setup) : EST + YYYYddMMHHmmss */
async function generateEstablishmentCode() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const now = new Date();
    const ts = buildTimestampSuffix(now);
    const ms = attempt > 0 ? String(now.getMilliseconds()).padStart(3, '0') : '';
    const code = `EST${ts}${ms}`;
    // eslint-disable-next-line no-await-in-loop
    const exists = await Establishment.exists({ code_establishment: code });
    if (!exists) return code;
  }
  const err = new Error('Impossible de générer le code établissement.');
  err.status = 500;
  throw err;
}

/** Numéro de ticket : {code_establishment}R{YYYYddMMHHmmss} */
async function generateReceiptNumber(establishmentId) {
  const { Payment } = require('../models');
  return generateEstablishmentReference(establishmentId, {
    Model: Payment,
    field: 'receipt_number',
    inlinePrefix: 'R',
  });
}

/** Numéro de commande : {code_establishment}{YYYYddMMHHmmss} */
async function generateOrderNumber(establishmentId) {
  const { Order } = require('../models');
  return generateEstablishmentReference(establishmentId, {
    Model: Order,
    field: 'order_number',
  });
}

/** code_user : {code_establishment}U{YYYYddMMHHmmss} */
async function generateCodeUser(establishmentId) {
  const { User } = require('../models');
  return generateEstablishmentReference(establishmentId, {
    Model: User,
    field: 'code_user',
    inlinePrefix: 'U',
  });
}

/** matricule : 3 lettres aléatoires + 3 chiffres (ex. ABC123) */
function randomMatricule() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';
  let code = '';
  for (let i = 0; i < 3; i += 1) {
    code += letters[Math.floor(Math.random() * letters.length)];
  }
  for (let i = 0; i < 3; i += 1) {
    code += digits[Math.floor(Math.random() * digits.length)];
  }
  return code;
}

async function generateMatricule() {
  const { User } = require('../models');

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const code = randomMatricule();
    // eslint-disable-next-line no-await-in-loop
    const exists = await User.exists({ matricule: code });
    if (!exists) return code;
  }

  const err = new Error('Impossible de générer un matricule unique.');
  err.status = 500;
  throw err;
}

async function generateUserCodes(establishmentId) {
  const [code_user, matricule] = await Promise.all([
    generateCodeUser(establishmentId),
    generateMatricule(establishmentId),
  ]);
  return { code_user, matricule };
}

module.exports = {
  buildTimestampSuffix,
  getEstablishmentCode,
  generateEstablishmentReference,
  generateEstablishmentCode,
  generateOrderNumber,
  generateReceiptNumber,
  generateCodeUser,
  generateMatricule,
  generateUserCodes,
};
