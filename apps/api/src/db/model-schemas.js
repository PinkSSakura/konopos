const SCHEMA_VERSION = 6;

function col(type, options = {}) {
  return { type, ...options };
}

const text = (options = {}) => col('TEXT', options);
const real = (options = {}) => col('REAL', options);
const integer = (options = {}) => col('INTEGER', options);
const bool = (options = {}) => col('INTEGER', { boolean: true, ...options });
const date = (options = {}) => col('TEXT', { date: true, ...options });
const json = (options = {}) => col('TEXT', { json: true, ...options });
const ref = (options = {}) => col('TEXT', { ref: true, ...options });

const idColumn = { _id: text({ primaryKey: true, notNull: true }) };
const timestamps = {
  createdAt: date(),
  updatedAt: date(),
};
const softDelete = {
  is_active: bool(),
  is_deleted: bool(),
  deleted_at: date(),
};
const auditRefs = {
  created_by: ref(),
  modified_by: ref(),
  deleted_by: ref(),
};
const audited = {
  ...softDelete,
  ...auditRefs,
  ...timestamps,
};

function model(table, columns, indexes = []) {
  return {
    table,
    columns: {
      ...idColumn,
      ...columns,
    },
    indexes,
  };
}

const MODEL_SCHEMAS = {
  Establishment: model('establishments', {
    code_establishment: text(),
    name: text(),
    address: text(),
    phone: text(),
    email: text(),
    website: text(),
    logo: text(),
    patente: text(),
    ice: text(),
    identifiant_fiscal: text(),
    rc: text(),
    maincolor: text(),
    secondarycolor: text(),
    currency: text(),
    tax_rate: real(),
    tax_id_label: text(),
    legal_name: text(),
    status: text(),
    tables_enabled: bool(),
    server_sections_enabled: bool(),
    delivery_enabled: bool(),
    fiscal_morocco_enabled: bool(),
    waiter_shift_manual_start: bool(),
    kitchen_shift_manual_start: bool(),
    auto_print_on_send: bool(),
    printers: json(),
    caisse_printer: json(),
    checkout_ui_mode: text(),
    waiter_can_void_payment: bool(),
    waiter_can_cancel_order: bool(),
    waiter_service_served_only: bool(),
    service_ready_on_send: bool(),
    waiter_quick_pin_mode: bool(),
    cds_pin: text(),
    kds_kitchen_accept_reject: bool(),
    kds_accept_required: bool(),
    soft_delete_visible_to_managers: bool(),
    is_setup_complete: bool(),
    daily_order_counter: real(),
    daily_order_session: real(),
    shift_cash_optional: bool(),
    caisse_close_when_all_shifts_closed: bool(),
    daily_code_calendar_date: text(),
    ...audited,
  }, [
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_establishments_code ON establishments (code_establishment) WHERE code_establishment IS NOT NULL',
    'CREATE INDEX IF NOT EXISTS idx_establishments_setup ON establishments (is_deleted, is_setup_complete)',
  ]),

  Role: model('roles', {
    code_role: text(),
    name: text(),
    display_name: text(),
    abreviation: text(),
    role_key: text(),
    role_type: text(),
    is_hidden: bool(),
    status: text(),
    ...audited,
  }, [
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_role_key ON roles (role_key) WHERE role_key IS NOT NULL',
    'CREATE INDEX IF NOT EXISTS idx_roles_type_name ON roles (role_type, name)',
  ]),

  Permission: model('permissions', {
    code_permission: text(),
    slug: text(),
    name: text(),
    module: text(),
    resource: text(),
    action: text(),
    applicable_role_types: text(),
    ...audited,
  }, [
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_permissions_code ON permissions (code_permission) WHERE code_permission IS NOT NULL',
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_permissions_slug ON permissions (slug) WHERE slug IS NOT NULL',
    'CREATE INDEX IF NOT EXISTS idx_permissions_module_resource ON permissions (module, resource, action)',
  ]),

  RolePermission: model('role_permissions', {
    role: ref(),
    permission: ref(),
    establishment: ref(),
    granted_by: ref(),
    revoked_by: ref(),
    revoked_at: date(),
    ...audited,
  }, [
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_role_permissions_scope ON role_permissions (role, permission, ifnull(establishment, ''))",
    'CREATE INDEX IF NOT EXISTS idx_role_permissions_lookup ON role_permissions (role, permission, is_active, is_deleted)',
  ]),

  User: model('users', {
    establishment: ref(),
    role: ref(),
    code_user: text(),
    matricule: text(),
    fullname: text(),
    username: text(),
    email: text(),
    password: text(),
    phonenumber: text(),
    cin: text(),
    status: text(),
    is_system_pos: bool(),
    pin: text(),
    pin_failed_attempts: integer(),
    pin_lock_tier: integer(),
    pin_locked_until: date(),
    last_login_at: date(),
    ...audited,
  }, [
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users (username) WHERE username IS NOT NULL',
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_matricule ON users (matricule) WHERE matricule IS NOT NULL',
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_establishment_pin ON users (establishment, pin) WHERE pin IS NOT NULL AND is_deleted = 0',
    'CREATE INDEX IF NOT EXISTS idx_users_establishment_role ON users (establishment, role, is_deleted)',
  ]),

  UserSession: model('user_sessions', {
    user: ref(),
    establishment: ref(),
    shift: ref(),
    parent_systempos_session: ref(),
    session_token: text(),
    expiry_time: date(),
    is_active: bool(),
    login_time: date(),
    logout_time: date(),
    logout_reason: text(),
    is_pin_session: bool(),
    is_quick_waiter_session: bool(),
    pin_login_counts: json(),
    device_info: json(),
    ...timestamps,
  }, [
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions (session_token) WHERE session_token IS NOT NULL',
    'CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active ON user_sessions (user, is_active)',
  ]),

  PushSubscription: model('push_subscriptions', {
    user: ref(),
    establishment: ref(),
    endpoint: text(),
    keys: json(),
    user_agent: text(),
    is_deleted: bool(),
    deleted_at: date(),
    ...timestamps,
  }, [
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON push_subscriptions (endpoint)',
    'CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions (user, is_deleted)',
  ]),

  Shift: model('shifts', {
    user: ref(),
    establishment: ref(),
    opened_by: ref(),
    closed_by_user: ref(),
    shift_label: text(),
    source_systempos_session: ref(),
    forced_logout_by: ref(),
    role_key: text(),
    clock_in: date(),
    clock_out: date(),
    opening_amount: real(),
    closing_amount: real(),
    source: text(),
    is_active: bool(),
    notes: text(),
    pin_grace_until: date(),
    auto_closed_reason: text(),
    ...timestamps,
  }, [
    'CREATE INDEX IF NOT EXISTS idx_shifts_user_active ON shifts (user, establishment, is_active)',
    'CREATE INDEX IF NOT EXISTS idx_shifts_clock_in ON shifts (establishment, clock_in)',
  ]),

  AuditLog: model('audit_logs', {
    establishment: ref(),
    user: ref(),
    action: text(),
    module: text(),
    resource: text(),
    resource_id: text(),
    description: text(),
    metadata: json(),
    success: bool(),
    audience: text(),
    ip: text(),
    user_agent: text(),
    ...timestamps,
  }, [
    'CREATE INDEX IF NOT EXISTS idx_audit_logs_est_created ON audit_logs (establishment, createdAt)',
    'CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs (resource, resource_id)',
    'CREATE INDEX IF NOT EXISTS idx_audit_logs_audience ON audit_logs (establishment, audience, createdAt)',
  ]),

  Room: model('rooms', {
    establishment: ref(),
    name: text(),
    sort_order: integer(),
    layout_width: integer(),
    layout_height: integer(),
    ...audited,
  }, [
    'CREATE INDEX IF NOT EXISTS idx_rooms_establishment_sort ON rooms (establishment, is_deleted, sort_order)',
  ]),

  Table: model('tables', {
    establishment: ref(),
    room: ref(),
    current_order: ref(),
    name: text(),
    capacity: integer(),
    status: text(),
    server_section: text(),
    assigned_waiter: ref(),
    position: json(),
    rotation: real(),
    merge_group_id: text(),
    is_merge_primary: bool(),
    ...audited,
  }, [
    'CREATE INDEX IF NOT EXISTS idx_tables_establishment_room ON tables (establishment, room, is_deleted)',
    'CREATE INDEX IF NOT EXISTS idx_tables_current_order ON tables (current_order)',
  ]),

  Category: model('categories', {
    establishment: ref(),
    name: text(),
    image_url: text(),
    color: text(),
    extra_ids: json(),
    ...audited,
  }, [
    'CREATE INDEX IF NOT EXISTS idx_categories_establishment_name ON categories (establishment, is_deleted, name)',
  ]),

  Subcategory: model('subcategories', {
    establishment: ref(),
    category: ref(),
    name: text(),
    sort_order: integer(),
    ...audited,
  }, [
    'CREATE INDEX IF NOT EXISTS idx_subcategories_establishment_category ON subcategories (establishment, category, is_deleted)',
  ]),

  MenuItem: model('menu_items', {
    establishment: ref(),
    category: ref(),
    subcategory: ref(),
    name: text(),
    description: text(),
    price: real(),
    product_type: text(),
    image_url: text(),
    variants: json(),
    modifier_groups: json(),
    extra_ids: json(),
    use_category_extras: bool(),
    ...audited,
  }, [
    'CREATE INDEX IF NOT EXISTS idx_menu_items_establishment_category ON menu_items (establishment, category, is_deleted)',
    'CREATE INDEX IF NOT EXISTS idx_menu_items_product_type ON menu_items (establishment, product_type, is_deleted)',
  ]),

  Extra: model('extras', {
    establishment: ref(),
    name: text(),
    price: real(),
    image_url: text(),
    ...audited,
  }, [
    'CREATE INDEX IF NOT EXISTS idx_extras_establishment_name ON extras (establishment, is_deleted, name)',
  ]),

  Order: model('orders', {
    establishment: ref(),
    table: ref(),
    room: ref(),
    waiter: ref(),
    shift: ref(),
    customer: ref(),
    merged_into: ref(),
    order_number: text(),
    type: text(),
    status: text(),
    subtotal: real(),
    total: real(),
    discount_amount: real(),
    discount_percent: real(),
    service_charge_amount: real(),
    service_charge_percent: real(),
    payment_status: text(),
    amount_paid: real(),
    notes: text(),
    delivery_address: text(),
    sent_to_kitchen_at: date(),
    daily_code: text(),
    daily_code_session: real(),
    paid_at: date(),
    receipt_number: text(),
    delivered_at: date(),
    merged_from_orders: json(),
    ...audited,
  }, [
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_number ON orders (establishment, order_number) WHERE order_number IS NOT NULL',
    'CREATE INDEX IF NOT EXISTS idx_orders_establishment_status ON orders (establishment, is_deleted, status)',
    'CREATE INDEX IF NOT EXISTS idx_orders_created ON orders (establishment, createdAt)',
    'CREATE INDEX IF NOT EXISTS idx_orders_daily_code ON orders (establishment, daily_code_session, daily_code)',
    'CREATE INDEX IF NOT EXISTS idx_orders_shift ON orders (shift, is_deleted)',
  ]),

  OrderItem: model('order_items', {
    order: ref(),
    establishment: ref(),
    menu_item: ref(),
    cancelled_by: ref(),
    replaced_by: ref(),
    replaces: ref(),
    name: text(),
    product_type: text(),
    quantity: real(),
    unit_price: real(),
    line_total: real(),
    variant: json(),
    modifiers: json(),
    notes: text(),
    status: text(),
    sent_to_kitchen_at: date(),
    served_at: date(),
    prepared_at: date(),
    cancellation_reason: text(),
    cancelled_at: date(),
    rejection_reason: text(),
    is_deleted: bool(),
    ...timestamps,
  }, [
    'CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items ("order", createdAt)',
    'CREATE INDEX IF NOT EXISTS idx_order_items_kds ON order_items (establishment, product_type, status, sent_to_kitchen_at)',
  ]),

  Payment: model('payments', {
    establishment: ref(),
    order: ref(),
    shift: ref(),
    customer: ref(),
    processed_by: ref(),
    voided_by: ref(),
    receipt_number: text(),
    kind: text(),
    method: text(),
    amount: real(),
    amount_tendered: real(),
    change_due: real(),
    discount_amount: real(),
    discount_percent: real(),
    service_charge_amount: real(),
    service_charge_percent: real(),
    order_subtotal: real(),
    order_total_before_payment: real(),
    tax_rate: real(),
    total_ht: real(),
    tax_amount: real(),
    total_ttc: real(),
    split_item_ids: json(),
    split_label: text(),
    processed_at: date(),
    is_void: bool(),
    voided_at: date(),
    void_reason: text(),
    ...audited,
  }, [
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_receipt ON payments (establishment, receipt_number) WHERE receipt_number IS NOT NULL',
    'CREATE INDEX IF NOT EXISTS idx_payments_order ON payments ("order", is_void)',
    'CREATE INDEX IF NOT EXISTS idx_payments_processed ON payments (establishment, processed_at, is_void)',
  ]),

  Customer: model('customers', {
    establishment: ref(),
    name: text(),
    phone: text(),
    email: text(),
    notes: text(),
    balance: real(),
    ...audited,
  }, [
    'CREATE INDEX IF NOT EXISTS idx_customers_establishment_name ON customers (establishment, is_deleted, name)',
  ]),

  DailyClosing: model('daily_closings', {
    establishment: ref(),
    closed_by: ref(),
    closing_date: date(),
    closed_at: date(),
    totals: json(),
    shift_ids: json(),
    payment_ids: json(),
    notes: text(),
    ...audited,
  }, [
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_closings_date ON daily_closings (establishment, closing_date)',
  ]),

  Expense: model('expenses', {
    establishment: ref(),
    recorded_by: ref(),
    title: text(),
    category: text(),
    amount: real(),
    expense_date: date(),
    payment_method: text(),
    description: text(),
    supplier: text(),
    reference: text(),
    ...audited,
  }, [
    'CREATE INDEX IF NOT EXISTS idx_expenses_establishment_date ON expenses (establishment, is_deleted, expense_date)',
    'CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses (establishment, category)',
  ]),

  ShiftPlan: model('shift_plans', {
    establishment: ref(),
    user: ref(),
    role_key: text(),
    planned_start: date(),
    planned_end: date(),
    notes: text(),
    status: text(),
    is_deleted: bool(),
    ...timestamps,
  }, [
    'CREATE INDEX IF NOT EXISTS idx_shift_plans_establishment_start ON shift_plans (establishment, planned_start)',
  ]),

  InstallationLicense: model('installation_licenses', {
    machine_fingerprint: text(),
    period_key: text(),
    license_key: text(),
    license_token: text(),
    // Encrypted ISO strings — must not use date() decode (would drop ciphertext).
    issued_at: text(),
    expires_at: text(),
    is_active: bool(),
    ...audited,
  }, [
    'CREATE INDEX IF NOT EXISTS idx_installation_licenses_fingerprint ON installation_licenses (machine_fingerprint, is_active, is_deleted)',
    'CREATE INDEX IF NOT EXISTS idx_installation_licenses_expires ON installation_licenses (expires_at)',
  ]),
};

function quoteIdent(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function columnSql(name, spec) {
  const parts = [quoteIdent(name), spec.type];
  if (spec.primaryKey) parts.push('PRIMARY KEY');
  if (spec.notNull) parts.push('NOT NULL');
  return parts.join(' ');
}

function createTableSql(schema) {
  const columns = Object.entries(schema.columns).map(([name, spec]) => columnSql(name, spec));
  return `CREATE TABLE IF NOT EXISTS ${quoteIdent(schema.table)} (${columns.join(', ')})`;
}

function tableExists(db, tableName) {
  return Boolean(db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?"
  ).get(tableName));
}

function existingColumns(db, tableName) {
  return new Set(db.prepare(`PRAGMA table_info(${quoteIdent(tableName)})`).all().map((row) => row.name));
}

function getUserVersion(db) {
  const row = db.prepare('PRAGMA user_version').get();
  return Number(row?.user_version ?? 0);
}

function listPendingSchemaMigrations(db) {
  const pending = [];

  for (const schema of Object.values(MODEL_SCHEMAS)) {
    if (!tableExists(db, schema.table)) {
      pending.push({ type: 'create_table', table: schema.table });
      continue;
    }
    const columns = existingColumns(db, schema.table);
    for (const name of Object.keys(schema.columns)) {
      if (!columns.has(name)) {
        pending.push({ type: 'add_column', table: schema.table, column: name });
      }
    }
  }

  const userVersion = getUserVersion(db);
  if (userVersion < SCHEMA_VERSION) {
    pending.push({ type: 'version_bump', from: userVersion, to: SCHEMA_VERSION });
  }

  return pending;
}

function shouldBackupBeforeMigration(db, pending) {
  if (!pending.length) return false;
  if (tableExists(db, 'schema_migrations')) {
    const row = db.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get();
    if ((row?.count ?? 0) > 0) return true;
  }
  return Object.values(MODEL_SCHEMAS).some((schema) => tableExists(db, schema.table));
}

function ensureSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  for (const schema of Object.values(MODEL_SCHEMAS)) {
    db.exec(createTableSql(schema));
    const columns = existingColumns(db, schema.table);
    for (const [name, spec] of Object.entries(schema.columns)) {
      if (!columns.has(name)) {
        db.exec(`ALTER TABLE ${quoteIdent(schema.table)} ADD COLUMN ${columnSql(name, spec)}`);
      }
    }
    for (const indexSql of schema.indexes || []) db.exec(indexSql);
  }

  db.prepare(
    'INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)'
  ).run(SCHEMA_VERSION, new Date().toISOString());
  db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

function getModelSchema(modelName) {
  const schema = MODEL_SCHEMAS[modelName];
  if (!schema) throw new Error(`No SQLite schema registered for model ${modelName}.`);
  return schema;
}

function normalizeRefValue(value) {
  if (value == null) return null;
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
}

function encodeColumnValue(value, spec) {
  if (value === undefined) return null;
  if (value === null) return null;
  if (spec.json) return JSON.stringify(value);
  if (spec.boolean) return value ? 1 : 0;
  if (spec.ref) return normalizeRefValue(value);
  if (spec.date) {
    if (value instanceof Date) return value.toISOString();
    return String(value);
  }
  if (spec.type === 'REAL') return Number(value);
  if (spec.type === 'INTEGER') return Number.parseInt(value, 10);
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
}

function decodeColumnValue(value, spec) {
  if (value === null || value === undefined) return undefined;
  if (spec.json) {
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  if (spec.boolean) return Boolean(value);
  if (spec.date) {
    if (value === '' || value == null) return undefined;
    const dateValue = new Date(value);
    return Number.isNaN(dateValue.getTime()) ? undefined : dateValue;
  }
  return value;
}

function assertKnownFields(schema, data) {
  const unknown = Object.keys(data).filter((key) => !schema.columns[key]);
  if (unknown.length) {
    throw new Error(
      `SQLite schema for ${schema.table} is missing field(s): ${unknown.join(', ')}`
    );
  }
}

function saveModelData(db, modelName, data) {
  const schema = getModelSchema(modelName);
  assertKnownFields(schema, data);

  const columns = Object.keys(schema.columns);
  const sql = `
    INSERT INTO ${quoteIdent(schema.table)} (${columns.map(quoteIdent).join(', ')})
    VALUES (${columns.map(() => '?').join(', ')})
    ON CONFLICT(${quoteIdent('_id')}) DO UPDATE SET
      ${columns
        .filter((name) => name !== '_id')
        .map((name) => `${quoteIdent(name)} = excluded.${quoteIdent(name)}`)
        .join(', ')}
  `;
  const values = columns.map((name) => encodeColumnValue(data[name], schema.columns[name]));
  try {
    db.prepare(sql).run(...values);
  } catch (err) {
    if (err.errcode === 1555 || err.errcode === 2067) {
      err.code = 11000;
    }
    throw err;
  }
}

function rowToModelData(modelName, row) {
  const schema = getModelSchema(modelName);
  const data = {};
  for (const [name, spec] of Object.entries(schema.columns)) {
    const value = decodeColumnValue(row[name], spec);
    if (value !== undefined) data[name] = value;
  }
  return data;
}

function allModelData(db, modelName) {
  const schema = getModelSchema(modelName);
  return db
    .prepare(`SELECT * FROM ${quoteIdent(schema.table)}`)
    .all()
    .map((row) => rowToModelData(modelName, row));
}

function deleteModelData(db, modelName, id) {
  const schema = getModelSchema(modelName);
  return db
    .prepare(`DELETE FROM ${quoteIdent(schema.table)} WHERE ${quoteIdent('_id')} = ?`)
    .run(String(id));
}

function migrateLegacyDocuments(db) {
  if (!tableExists(db, 'documents')) return;

  const rows = db.prepare('SELECT model, id, data FROM documents ORDER BY model, id').all();
  if (!rows.length) {
    db.exec('DROP TABLE documents');
    return;
  }

  db.exec('BEGIN IMMEDIATE');
  try {
    for (const row of rows) {
      const parsed = JSON.parse(row.data);
      if (!parsed._id) parsed._id = row.id;
      saveModelData(db, row.model, parsed);
    }
    db.exec('DROP TABLE documents');
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

module.exports = {
  MODEL_SCHEMAS,
  SCHEMA_VERSION,
  allModelData,
  deleteModelData,
  ensureSchema,
  getModelSchema,
  getUserVersion,
  listPendingSchemaMigrations,
  migrateLegacyDocuments,
  saveModelData,
  shouldBackupBeforeMigration,
};
