const { defineModel } = require('../db/sqlite-model');
const auditDefaults = require('./auditfields');
const { encryptField, decryptField } = require('../utils/fieldencryption');


const ENCRYPTED_FIELDS = {
  machine_fingerprint: { deterministic: true },
  period_key: { deterministic: true },
  license_key: {},
  license_token: {},
  issued_at: {},
  expires_at: {},
};

const BaseModel = defineModel('InstallationLicense', {
  refs: {
    created_by: 'User',
    modified_by: 'User',
    deleted_by: 'User',
  },
  defaults: {
    machine_fingerprint: '',
    period_key: '',
    license_key: '',
    license_token: '',
    issued_at: null,
    expires_at: null,
    is_active: true,
    ...auditDefaults,
  },
});

function encryptRecord(data = {}) {
  const out = { ...data };
  for (const [key, opts] of Object.entries(ENCRYPTED_FIELDS)) {
    if (out[key] != null && out[key] !== '') {
      out[key] = encryptField(out[key], opts);
    }
  }
  return out;
}

function encryptFilter(filter = {}) {
  const out = { ...filter };
  for (const [key, opts] of Object.entries(ENCRYPTED_FIELDS)) {
    if (!opts.deterministic || out[key] === undefined) continue;
    out[key] = encryptField(out[key], opts);
  }
  return out;
}

function decryptRecord(doc) {
  if (!doc) return doc;

  const apply = (target) => {
    for (const [key, opts] of Object.entries(ENCRYPTED_FIELDS)) {
      if (target[key] != null && target[key] !== '') {
        target[key] = decryptField(target[key], opts);
      }
    }
    return target;
  };

  if (typeof doc.toObject === 'function') {
    Object.assign(doc, apply(doc.toObject()));
    return doc;
  }

  return apply({ ...doc });
}

function wrapQuery(query, filter) {
  query.payload.filter = encryptFilter(filter);
  const originalExec = query.exec.bind(query);
  query.exec = async function exec() {
    const rows = await originalExec();
    if (Array.isArray(rows)) return rows.map(decryptRecord);
    return decryptRecord(rows);
  };
  return query;
}

const InstallationLicense = {
  ...BaseModel,
  find(filter = {}) {
    return wrapQuery(BaseModel.find(filter), filter);
  },
  findOne(filter = {}) {
    return wrapQuery(BaseModel.findOne(filter), filter);
  },
  findById(id) {
    return wrapQuery(BaseModel.findById(id), { _id: id });
  },
  async create(data) {
    const record = await BaseModel.create(encryptRecord(data));
    return decryptRecord(record);
  },
  async updateMany(filter, update) {
    return BaseModel.updateMany(encryptFilter(filter), update);
  },
};

module.exports = InstallationLicense;
