const crypto = require('crypto');
const config = require('../config');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey() {
  const secret = config.licenseEncryptionSecret
    || config.licenseSigningSecret
    || config.jwtSecret;
  return crypto.createHash('sha256').update(String(secret)).digest();
}

function looksEncrypted(value) {
  if (typeof value !== 'string' || !value) return false;
  try {
    const buf = Buffer.from(value, 'base64');
    return buf.length >= IV_LENGTH + AUTH_TAG_LENGTH + 1;
  } catch {
    return false;
  }
}

function encryptField(plaintext, { deterministic = false } = {}) {
  if (plaintext == null || plaintext === '') return plaintext;

  const key = getEncryptionKey();
  const iv = deterministic
    ? crypto.createHmac('sha256', key).update(String(plaintext)).digest().subarray(0, IV_LENGTH)
    : crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(String(plaintext), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function decryptField(ciphertext, { deterministic = false } = {}) {
  if (ciphertext == null || ciphertext === '') return ciphertext;
  if (!looksEncrypted(ciphertext)) return ciphertext;

  const key = getEncryptionKey();
  const buf = Buffer.from(ciphertext, 'base64');
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

module.exports = {
  encryptField,
  decryptField,
  looksEncrypted,
};
