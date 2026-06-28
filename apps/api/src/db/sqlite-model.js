const crypto = require('crypto');
const { getDb } = require('./sqlite');
const {
  allModelData,
  deleteModelData,
  getModelSchema,
  saveModelData,
} = require('./model-schemas');

const registry = new Map();

function clone(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value instanceof Date) return new Date(value.getTime());
  if (Array.isArray(value)) return value.map((item) => clone(item));
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
  }
  return value;
}

function nowIso() {
  return new Date().toISOString();
}

function objectId() {
  return crypto.randomBytes(12).toString('hex');
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date) && !(value instanceof RegExp);
}

function normalizeScalar(value) {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object' && typeof value.toString === 'function' && value.constructor?.name === 'ObjectId') {
    return value.toString();
  }
  return value;
}

function getByPath(obj, path) {
  return String(path).split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function setByPath(obj, path, value) {
  const parts = String(path).split('.');
  let target = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    if (!isPlainObject(target[key])) target[key] = {};
    target = target[key];
  }
  target[parts[parts.length - 1]] = value;
}

function unsetByPath(obj, path) {
  const parts = String(path).split('.');
  let target = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    target = target?.[parts[i]];
    if (!target) return;
  }
  delete target[parts[parts.length - 1]];
}

function dateTime(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const t = Date.parse(value);
    if (!Number.isNaN(t) && /^\d{4}-\d{2}-\d{2}T/.test(value)) return t;
  }
  return undefined;
}

function valuesEqual(left, right) {
  const l = normalizeScalar(left);
  const r = normalizeScalar(right);
  if (l == null || r == null) return l == r;
  const lt = dateTime(l);
  const rt = dateTime(r);
  if (lt !== undefined && rt !== undefined) return lt === rt;
  return String(l) === String(r);
}

function attachArrayHelpers(value) {
  if (Array.isArray(value)) {
    if (typeof value.id !== 'function') {
      Object.defineProperty(value, 'id', {
        enumerable: false,
        value(id) {
          return this.find((item) => item && valuesEqual(item._id, id));
        },
      });
    }
    for (const item of value) attachArrayHelpers(item);
    return value;
  }
  if (isPlainObject(value) || value instanceof SQLiteDocument) {
    for (const item of Object.values(value)) attachArrayHelpers(item);
  }
  return value;
}

function compareValues(left, right) {
  const l = normalizeScalar(left);
  const r = normalizeScalar(right);
  const lt = dateTime(l);
  const rt = dateTime(r);
  if (lt !== undefined && rt !== undefined) return lt - rt;
  if (typeof l === 'number' && typeof r === 'number') return l - r;
  return String(l ?? '').localeCompare(String(r ?? ''));
}

function matchesOperator(actual, operator, expected) {
  if (operator === '$ne') return !valuesEqual(actual, expected);
  if (operator === '$in') return Array.isArray(expected) && expected.some((v) => valuesEqual(actual, v));
  if (operator === '$nin') return Array.isArray(expected) && !expected.some((v) => valuesEqual(actual, v));
  if (operator === '$gte') return compareValues(actual, expected) >= 0;
  if (operator === '$lte') return compareValues(actual, expected) <= 0;
  if (operator === '$gt') return compareValues(actual, expected) > 0;
  if (operator === '$lt') return compareValues(actual, expected) < 0;
  if (operator === '$exists') return expected ? actual !== undefined : actual === undefined;
  if (operator === '$regex') return true;
  if (operator === '$options') return true;
  return false;
}

function matchesValue(actual, expected) {
  if (expected instanceof RegExp) return expected.test(String(actual ?? ''));
  if (isPlainObject(expected)) {
    if ('$regex' in expected) {
      const flags = expected.$options || '';
      const rx = expected.$regex instanceof RegExp ? expected.$regex : new RegExp(expected.$regex, flags);
      return rx.test(String(actual ?? ''));
    }
    return Object.entries(expected).every(([op, value]) => matchesOperator(actual, op, value));
  }
  return valuesEqual(actual, expected);
}

function matchesFilter(doc, filter = {}) {
  return Object.entries(filter || {}).every(([key, expected]) => {
    if (key === '$or') return Array.isArray(expected) && expected.some((item) => matchesFilter(doc, item));
    if (key === '$and') return Array.isArray(expected) && expected.every((item) => matchesFilter(doc, item));
    return matchesValue(getByPath(doc, key), expected);
  });
}

function applyProjection(data, select) {
  if (!select) return data;
  const fields = String(select).split(/\s+/).filter(Boolean);
  if (!fields.length) return data;

  const includes = fields.filter((f) => !f.startsWith('-') && !f.startsWith('+'));
  const excludes = fields.filter((f) => f.startsWith('-')).map((f) => f.slice(1));
  const source = clone(data);

  if (includes.length) {
    const projected = { _id: source._id };
    for (const field of includes) {
      const value = getByPath(source, field);
      if (value !== undefined) setByPath(projected, field, value);
    }
    return projected;
  }

  for (const field of excludes) unsetByPath(source, field);
  return source;
}

function applyDefaults(data, defaults = {}) {
  const out = { ...clone(data) };
  for (const [key, value] of Object.entries(defaults)) {
    if (getByPath(out, key) === undefined) {
      setByPath(out, key, typeof value === 'function' ? value() : clone(value));
    }
  }
  return out;
}

function addEmbeddedIds(value) {
  if (Array.isArray(value)) {
    for (const item of value) {
      if (isPlainObject(item) && item._id === undefined) item._id = objectId();
      addEmbeddedIds(item);
    }
  } else if (isPlainObject(value)) {
    for (const item of Object.values(value)) addEmbeddedIds(item);
  }
}

function applyUpdate(doc, update = {}) {
  const hasOperator = Object.keys(update).some((key) => key.startsWith('$'));
  const patch = hasOperator ? update.$set || {} : update;

  for (const [key, value] of Object.entries(patch)) {
    setByPath(doc, key, value);
  }
  if (update.$unset) {
    for (const key of Object.keys(update.$unset)) unsetByPath(doc, key);
  }
  if (update.$inc) {
    for (const [key, value] of Object.entries(update.$inc)) {
      setByPath(doc, key, (Number(getByPath(doc, key)) || 0) + Number(value || 0));
    }
  }
  return doc;
}

function equalityFields(filter = {}) {
  const out = {};
  for (const [key, value] of Object.entries(filter)) {
    if (key.startsWith('$')) continue;
    if (!isPlainObject(value) && value !== undefined) setByPath(out, key, value);
  }
  return out;
}

function sortDocs(docs, spec) {
  if (!spec) return docs;
  const entries = Object.entries(spec);
  return docs.sort((a, b) => {
    for (const [field, direction] of entries) {
      const result = compareValues(getByPath(a, field), getByPath(b, field));
      if (result !== 0) return direction < 0 ? -result : result;
    }
    return 0;
  });
}

class SQLiteDocument {
  constructor(model, data, persisted = false) {
    getModelSchema(model.name);
    Object.defineProperty(this, '$model', { value: model, enumerable: false });
    Object.defineProperty(this, '$persisted', { value: persisted, writable: true, enumerable: false });
    Object.assign(this, applyDefaults(data || {}, model.defaults));
    if (!this._id) this._id = objectId();
    attachArrayHelpers(this);
  }

  toObject() {
    const data = {};
    for (const [key, value] of Object.entries(this)) data[key] = value;
    return clone(data);
  }

  toJSON() {
    return this.toObject();
  }

  async save() {
    const model = this.$model;
    const db = getDb();
    const data = this.toObject();
    const now = nowIso();
    if (!data.createdAt) data.createdAt = now;
    data.updatedAt = now;
    addEmbeddedIds(data);
    Object.assign(this, data);

    saveModelData(db, model.name, data);
    this.$persisted = true;
    attachArrayHelpers(this);
    return this;
  }

  async populate(pathOrSpec, select) {
    await populateDocument(this, pathOrSpec, select);
    return this;
  }
}

function hydrate(model, data, projection, lean = false) {
  const projected = applyProjection(data, projection);
  return lean ? projected : model.factory(projected, true);
}

function allRaw(model) {
  return allModelData(getDb(), model.name);
}

async function populateDocument(doc, pathOrSpec, select) {
  if (!doc) return doc;
  if (Array.isArray(doc)) {
    await Promise.all(doc.map((item) => populateDocument(item, pathOrSpec, select)));
    return doc;
  }

  const specs = Array.isArray(pathOrSpec)
    ? pathOrSpec
    : [typeof pathOrSpec === 'string' ? { path: pathOrSpec, select } : pathOrSpec];

  for (const spec of specs) {
    if (!spec?.path) continue;
    const model = doc.$model || registry.get(doc.__modelName);
    const refName = spec.model || model?.refs?.[spec.path];
    const refModel = registry.get(refName);
    if (!refModel) continue;

    const value = getByPath(doc, spec.path);
    if (value == null) continue;
    if (isPlainObject(value) && value._id) {
      if (spec.populate) await populateDocument(value, spec.populate);
      continue;
    }

    if (Array.isArray(value)) {
      const populated = [];
      for (const id of value) {
        const found = await refModel.findById(id).select(spec.select).exec();
        if (found) populated.push(found);
      }
      setByPath(doc, spec.path, populated);
      if (spec.populate) await Promise.all(populated.map((item) => populateDocument(item, spec.populate)));
      continue;
    }

    const found = await refModel.findById(value).select(spec.select).exec();
    if (found) {
      setByPath(doc, spec.path, found);
      if (spec.populate) await populateDocument(found, spec.populate);
    }
  }
  return doc;
}

class Query {
  constructor(model, op, payload = {}) {
    this.model = model;
    this.op = op;
    this.payload = payload;
    this.populates = [];
    this.sortSpec = null;
    this.limitCount = null;
    this.selectSpec = null;
    this.leanMode = false;
  }

  sort(spec) {
    this.sortSpec = spec;
    return this;
  }

  limit(n) {
    this.limitCount = Number(n);
    return this;
  }

  select(spec) {
    this.selectSpec = spec;
    return this;
  }

  populate(pathOrSpec, select) {
    this.populates.push(typeof pathOrSpec === 'string' ? { path: pathOrSpec, select } : pathOrSpec);
    return this;
  }

  lean() {
    this.leanMode = true;
    return this;
  }

  async exec() {
    let result;
    if (this.op === 'find') result = this.execFind(false);
    if (this.op === 'findOne') result = this.execFind(true);
    if (this.op === 'findOneAndUpdate') result = await this.execFindOneAndUpdate();
    if (this.op === 'findOneAndDelete') result = await this.execFindOneAndDelete();

    if (this.populates.length) {
      await populateDocument(result, this.populates);
    }

    if (this.leanMode) return Array.isArray(result) ? result.map((item) => item.toObject ? item.toObject() : item) : result?.toObject?.() || result;
    return result;
  }

  execFind(single) {
    let docs = allRaw(this.model).filter((doc) => matchesFilter(doc, this.payload.filter || {}));
    if (this.sortSpec) docs = sortDocs(docs, this.sortSpec);
    if (this.limitCount && this.limitCount > 0) docs = docs.slice(0, this.limitCount);
    if (single) {
      const doc = docs[0];
      return doc ? hydrate(this.model, doc, this.selectSpec, false) : null;
    }
    return docs.map((doc) => hydrate(this.model, doc, this.selectSpec, false));
  }

  async execFindOneAndUpdate() {
    const { filter, update, options = {} } = this.payload;
    let doc = allRaw(this.model).find((item) => matchesFilter(item, filter || {}));
    if (!doc && options.upsert) {
      doc = equalityFields(filter);
    }
    if (!doc) return null;

    applyUpdate(doc, update);
    const saved = this.model.factory(doc, Boolean(doc._id));
    await saved.save();
    return hydrate(this.model, saved.toObject(), this.selectSpec, false);
  }

  async execFindOneAndDelete() {
    const { filter } = this.payload;
    const doc = allRaw(this.model).find((item) => matchesFilter(item, filter || {}));
    if (!doc) return null;
    deleteModelData(getDb(), this.model.name, doc._id);
    return hydrate(this.model, doc, this.selectSpec, false);
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }

  catch(reject) {
    return this.exec().catch(reject);
  }

  finally(onFinally) {
    return this.exec().finally(onFinally);
  }
}

function defineModel(name, options = {}) {
  const model = {
    name,
    refs: options.refs || {},
    defaults: options.defaults || {},
    methods: options.methods || {},
  };

  class ModelDocument extends SQLiteDocument {}
  for (const [method, fn] of Object.entries(model.methods)) {
    ModelDocument.prototype[method] = fn;
  }

  function makeDoc(data, persisted = false) {
    return new ModelDocument(model, data, persisted);
  }

  function Model(data) {
    return makeDoc(data);
  }

  Object.assign(Model, {
    modelName: name,
    refs: model.refs,
    defaults: model.defaults,
    find(filter = {}) {
      return new Query(model, 'find', { filter });
    },
    findOne(filter = {}) {
      return new Query(model, 'findOne', { filter });
    },
    findById(id) {
      return new Query(model, 'findOne', { filter: { _id: id } });
    },
    findOneAndUpdate(filter, update, options) {
      return new Query(model, 'findOneAndUpdate', { filter, update, options });
    },
    findOneAndDelete(filter) {
      return new Query(model, 'findOneAndDelete', { filter });
    },
    async create(data) {
      if (Array.isArray(data)) return Promise.all(data.map((item) => Model.create(item)));
      const doc = makeDoc(data);
      await doc.save();
      return doc;
    },
    async updateOne(filter, update) {
      const doc = await Model.findOne(filter).exec();
      if (!doc) return { matchedCount: 0, modifiedCount: 0 };
      applyUpdate(doc, update);
      await doc.save();
      return { matchedCount: 1, modifiedCount: 1 };
    },
    async updateMany(filter, update) {
      const docs = await Model.find(filter).exec();
      for (const doc of docs) {
        applyUpdate(doc, update);
        await doc.save();
      }
      return { matchedCount: docs.length, modifiedCount: docs.length };
    },
    async countDocuments(filter = {}) {
      return allRaw(model).filter((doc) => matchesFilter(doc, filter)).length;
    },
    async exists(filter = {}) {
      const doc = allRaw(model).find((item) => matchesFilter(item, filter));
      return doc ? { _id: doc._id } : null;
    },
    async distinct(field, filter = {}) {
      const values = allRaw(model)
        .filter((doc) => matchesFilter(doc, filter))
        .map((doc) => getByPath(doc, field))
        .flat()
        .filter((value) => value !== undefined);
      return [...new Set(values.map((value) => String(value)))];
    },
    async aggregate(pipeline = []) {
      let rows = allRaw(model);
      for (const stage of pipeline) {
        if (stage.$match) rows = rows.filter((doc) => matchesFilter(doc, stage.$match));
        if (stage.$group) rows = groupRows(rows, stage.$group);
        if (stage.$sort) rows = sortDocs(rows, stage.$sort);
        if (stage.$limit) rows = rows.slice(0, Number(stage.$limit));
      }
      return rows;
    },
    async syncIndexes() {},
    collection: {
      async indexes() {
        return [];
      },
      async dropIndex() {},
    },
  });

  model.factory = makeDoc;
  model.publicModel = Model;
  registry.set(name, Model);
  registry.set(Model.modelName, Model);
  return Model;
}

function groupRows(rows, spec) {
  const groups = new Map();
  const idExpr = spec._id;
  for (const row of rows) {
    const id = typeof idExpr === 'string' && idExpr.startsWith('$') ? getByPath(row, idExpr.slice(1)) : idExpr;
    const key = JSON.stringify(id);
    if (!groups.has(key)) groups.set(key, { _id: id });
    const acc = groups.get(key);
    for (const [field, rule] of Object.entries(spec)) {
      if (field === '_id') continue;
      if (rule.$sum !== undefined) {
        acc[field] = (acc[field] || 0) + (rule.$sum === 1 ? 1 : Number(getByPath(row, String(rule.$sum).slice(1)) || 0));
      }
    }
  }
  return [...groups.values()];
}

module.exports = {
  defineModel,
  objectId,
};
