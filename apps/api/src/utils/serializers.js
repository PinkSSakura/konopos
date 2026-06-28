function toPlain(doc) {
  if (doc == null) return doc;
  if (doc instanceof Date) return doc;
  if (typeof doc.toObject === 'function') return doc.toObject();
  return doc;
}

function toIsoDate(value) {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function pick(obj, keys) {
  const src = toPlain(obj);
  if (!src || typeof src !== 'object' || Array.isArray(src)) return src;
  const out = {};
  for (const key of keys) {
    if (src[key] !== undefined) out[key] = src[key];
  }
  return out;
}

function pickRef(obj, key, fields) {
  const ref = obj?.[key];
  if (!ref) return null;
  if (typeof ref === 'string') return { _id: ref };
  return pick(ref, fields);
}

function mapList(items, mapper) {
  return (items || []).map(mapper);
}

const NAME_PREFIXES = [
  'Voir ',
  'Créer ',
  'Modifier ',
  'Supprimer ',
  'Restaurer ',
  'Encaisser ',
  'Annuler ',
  'Envoyer ',
  'Attribuer ',
  'Exporter ',
  'Importer ',
  'Activer ',
  'Révoquer ',
  'Fusionner ',
  'Séparer ',
  'Marquer ',
];

function stripNamePrefix(name) {
  if (!name) return null;
  for (const prefix of NAME_PREFIXES) {
    if (name.startsWith(prefix)) return name.slice(prefix.length).trim();
  }
  return name;
}

function actionVerbFromName(name) {
  if (!name) return null;
  for (const prefix of NAME_PREFIXES) {
    if (name.startsWith(prefix)) return prefix.trim();
  }
  return name;
}

function moduleLabelFromRows(rows) {
  const viewPerm = rows.find((row) => row.permission?.action === 'view');
  const name = viewPerm?.permission?.name || rows[0]?.permission?.name;
  const stripped = stripNamePrefix(name);
  if (stripped) {
    return stripped.charAt(0).toUpperCase() + stripped.slice(1);
  }
  return rows[0]?.permission?.module || 'autre';
}

function actionLabelFromRows(rows, action) {
  const perm = rows.find((row) => row.permission?.action === action)?.permission;
  if (!perm?.name) return action;
  return actionVerbFromName(perm.name) || perm.name;
}

function resourceLabelFromRows(rows, resource) {
  const perm = rows.find((row) => row.permission?.resource === resource)?.permission;
  if (!perm?.name) return resource;
  const stripped = stripNamePrefix(perm.name);
  if (stripped) {
    return stripped.charAt(0).toUpperCase() + stripped.slice(1);
  }
  return resource;
}

function serializeMatrixPermission(permission) {
  if (!permission) return null;
  const plain = toPlain(permission);
  return pick(plain, ['_id', 'name', 'code_permission', 'slug', 'module', 'resource', 'action']);
}

function serializeMatrixCell(row) {
  return {
    permission: serializeMatrixPermission(row.permission),
    granted: Boolean(row.granted),
    role_permission_id: row.role_permission_id || null,
  };
}

function buildResourceActionGrid(matrixRows, moduleRows) {
  const byResource = new Map();

  matrixRows.forEach((row) => {
    const resource = row.permission.resource;
    const action = row.permission.action;
    if (!resource || !action) return;

    if (!byResource.has(resource)) {
      byResource.set(resource, {
        resource,
        label: resourceLabelFromRows(moduleRows, resource),
        cells: {},
      });
    }
    byResource.get(resource).cells[action] = serializeMatrixCell(row);
  });

  const resources = [...byResource.values()].sort((a, b) =>
    a.label.localeCompare(b.label, 'fr')
  );

  const actionSet = new Set();
  resources.forEach((resourceRow) => {
    Object.keys(resourceRow.cells).forEach((action) => actionSet.add(action));
  });

  const actions = [...actionSet]
    .sort((a, b) => a.localeCompare(b, 'fr'))
    .map((action) => ({
      key: action,
      label: actionLabelFromRows(moduleRows, action),
    }));

  return { resources, actions };
}

function buildPermissionModuleGroups(matrix) {
  const byModule = matrix.reduce((acc, row) => {
    const moduleKey = row.permission?.module || 'other';
    if (!acc[moduleKey]) acc[moduleKey] = [];
    acc[moduleKey].push(row);
    return acc;
  }, {});

  return Object.entries(byModule)
    .sort(([moduleA], [moduleB]) => moduleA.localeCompare(moduleB, 'fr'))
    .map(([moduleKey, rows]) => {
      const gridRows = rows.filter(
        (row) => row.permission?.resource && row.permission?.action
      );
      const standaloneRows = rows.filter(
        (row) => !row.permission?.resource || !row.permission?.action
      );

      return {
        module: moduleKey,
        module_label: moduleLabelFromRows(rows),
        grid: buildResourceActionGrid(gridRows, rows),
        standalone: standaloneRows
          .map(serializeMatrixCell)
          .sort((a, b) =>
            (a.permission?.name || '').localeCompare(b.permission?.name || '', 'fr')
          ),
        granted_count: rows.filter((row) => row.granted).length,
        total_count: rows.length,
      };
    });
}

const SENSITIVE_FIELDS = new Set([
  'password',
  'pin',
  'session_token',
  'license_token',
  'license_key',
  'pin_failed_attempts',
  'pin_lock_tier',
  'pin_locked_until',
  'is_system_pos',
  'device_info',
  'pin_login_counts',
  'parent_systempos_session',
  'source_systempos_session',
  'machine_fingerprint',
]);

const AUDIT_FIELDS = new Set([
  'created_by',
  'modified_by',
  'deleted_by',
  'createdAt',
  'updatedAt',
  'deleted_at',
  'is_deleted',
  'granted_by',
  'revoked_by',
  'revoked_at',
]);

const INTERNAL_FIELDS = new Set([
  'daily_order_counter',
  'daily_order_session',
  'code_establishment',
  'record_id',
  'issued_at',
]);

const PRIVACY_FIELDS = new Set([
  'cin',
  'ip',
  'user_agent',
]);

const STRIP_FIELDS = new Set([
  ...SENSITIVE_FIELDS,
  ...AUDIT_FIELDS,
  ...INTERNAL_FIELDS,
  ...PRIVACY_FIELDS,
]);

function sanitizeForClient(value, seen = new WeakSet()) {
  if (value == null) return value;
  if (typeof value !== 'object') return value;

  const plain = toPlain(value);
  if (plain !== value) {
    return sanitizeForClient(plain, seen);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForClient(item, seen));
  }

  if (seen.has(value)) return undefined;
  seen.add(value);

  const result = {};
  for (const [key, val] of Object.entries(value)) {
    if (key.startsWith('$')) continue;
    if (STRIP_FIELDS.has(key)) continue;
    result[key] = sanitizeForClient(val, seen);
  }
  return result;
}

function serializeUserAdmin(user) {
  const o = toPlain(user);
  const hasPin = Boolean(o.pin);
  const isSystemposTerminal = Boolean(o.is_system_pos);
  delete o.password;
  delete o.pin;
  delete o.pin_failed_attempts;
  delete o.pin_lock_tier;
  delete o.pin_locked_until;
  delete o.is_system_pos;
  delete o.cin;
  delete o.created_by;
  delete o.modified_by;
  delete o.deleted_by;
  delete o.deleted_at;
  delete o.is_deleted;
  delete o.createdAt;
  delete o.updatedAt;

  if (o.role && typeof o.role === 'object') {
    const role = toPlain(o.role);
    delete role.created_by;
    delete role.modified_by;
    delete role.deleted_by;
    delete role.deleted_at;
    delete role.is_deleted;
    delete role.createdAt;
    delete role.updatedAt;
    o.role = role;
  }

  return {
    ...o,
    has_pin: hasPin,
    is_systempos_terminal: isSystemposTerminal,
  };
}

function serializeUserListItem(user) {
  const o = serializeUserAdmin(user);
  return pick(o, [
    '_id',
    'code_user',
    'matricule',
    'fullname',
    'username',
    'role',
    'has_pin',
    'status',
    'is_active',
  ]);
}

function serializeUserList(users) {
  return (users || []).map(serializeUserListItem);
}

function serializeEstablishmentCurrent(establishment) {
  if (!establishment) return null;
  const est = toPlain(establishment);
  return {
    _id: est._id,
    code_establishment: est.code_establishment,
    name: est.name,
    maincolor: est.maincolor,
    secondarycolor: est.secondarycolor,
    currency: est.currency,
    address: est.address,
    phone: est.phone,
    email: est.email,
    website: est.website,
    logo: est.logo,
    patente: est.patente,
    ice: est.ice,
    identifiant_fiscal: est.identifiant_fiscal,
    rc: est.rc,
    tables_enabled: est.tables_enabled !== false,
    kds_kitchen_accept_reject: Boolean(est.kds_kitchen_accept_reject ?? est.kds_accept_required),
    waiter_service_served_only: Boolean(est.waiter_service_served_only),
    service_ready_on_send: Boolean(est.service_ready_on_send),
    waiter_shift_manual_start: est.waiter_shift_manual_start !== false,
    kitchen_shift_manual_start: Boolean(est.kitchen_shift_manual_start),
    checkout_ui_mode: est.checkout_ui_mode === 'page' ? 'page' : 'modal',
  };
}

function buildEstablishmentCapabilities(establishment) {
  if (!establishment) return [];
  const est = toPlain(establishment);
  const caps = [];
  if (est.is_setup_complete) caps.push('setup_complete');
  if (est.tables_enabled !== false) caps.push('tables');
  if (est.waiter_shift_manual_start !== false) caps.push('waiter_shift_manual');
  if (est.kitchen_shift_manual_start) caps.push('kitchen_shift_manual');
  if (est.kds_kitchen_accept_reject || est.kds_accept_required) caps.push('kitchen_dispatch');
  if (est.waiter_can_void_payment) caps.push('waiter_void_payment');
  if (est.waiter_can_cancel_order) caps.push('waiter_cancel_order');
  if (est.waiter_service_served_only) caps.push('waiter_service_served_only');
  if (est.caisse_printer?.auto_print_on_payment !== false) caps.push('caisse_auto_print_payment');
  if (est.server_sections_enabled) caps.push('server_sections');
  if (est.delivery_enabled) caps.push('delivery');
  return caps;
}

function serializeEstablishmentSettings(establishment) {
  if (!establishment) return null;
  const est = toPlain(establishment);
  return {
    _id: est._id,
    name: est.name,
    phone: est.phone,
    email: est.email,
    website: est.website,
    address: est.address,
    logo: est.logo,
    maincolor: est.maincolor,
    secondarycolor: est.secondarycolor,
    currency: est.currency,
    kds_kitchen_accept_reject: est.kds_kitchen_accept_reject,
    kds_accept_required: est.kds_accept_required,
    tables_enabled: est.tables_enabled,
    auto_print_on_send: est.auto_print_on_send,
    waiter_can_void_payment: est.waiter_can_void_payment,
    waiter_can_cancel_order: est.waiter_can_cancel_order,
    waiter_service_served_only: est.waiter_service_served_only,
    service_ready_on_send: est.service_ready_on_send,
    waiter_quick_pin_mode: Boolean(est.waiter_quick_pin_mode),
    cds_pin: est.cds_pin || '',
    waiter_shift_manual_start: est.waiter_shift_manual_start,
    kitchen_shift_manual_start: est.kitchen_shift_manual_start,
    printers: est.printers,
    caisse_printer: est.caisse_printer,
    checkout_ui_mode: est.checkout_ui_mode === 'page' ? 'page' : 'modal',
    patente: est.patente,
    ice: est.ice,
    identifiant_fiscal: est.identifiant_fiscal,
    rc: est.rc,
    is_setup_complete: est.is_setup_complete,
  };
}

function serializeLicenseStatusPublic(status) {
  if (!status) return null;
  const out = {
    valid: Boolean(status.valid),
    fingerprint: status.fingerprint,
    expires_at: status.expires_at ?? null,
    days_remaining: status.days_remaining ?? null,
    lifetime: Boolean(status.lifetime),
    code: status.code,
  };
  if (status.period) out.period = status.period;
  if (status.period_label) out.period_label = status.period_label;
  return out;
}

function serializeOrderList(order) {
  const o = toPlain(order);
  return {
    _id: o._id,
    order_number: o.order_number,
    created_at: toIsoDate(o.createdAt),
    type: o.type,
    status: o.status,
    payment_status: o.payment_status,
    total: o.total,
    daily_code: o.daily_code,
    table: pickRef(o, 'table', ['_id', 'name']),
    waiter: pickRef(o, 'waiter', ['_id', 'fullname']),
  };
}

function serializeOrderDetail(order) {
  const o = toPlain(order);
  return {
    _id: o._id,
    order_number: o.order_number,
    status: o.status,
    type: o.type,
    payment_status: o.payment_status,
    daily_code: o.daily_code,
    total: o.total,
    notes: o.notes,
    sent_to_kitchen_at: toIsoDate(o.sent_to_kitchen_at),
    table: pickRef(o, 'table', ['_id', 'name', 'room']),
    waiter: pickRef(o, 'waiter', ['_id', 'fullname']),
  };
}

function serializeOrderItem(item) {
  const i = toPlain(item);
  return {
    _id: i._id,
    menu_item: i.menu_item,
    name: i.name,
    quantity: i.quantity,
    unit_price: i.unit_price,
    line_total: i.line_total,
    product_type: i.product_type,
    status: i.status,
    variant: i.variant,
    modifiers: i.modifiers,
    notes: i.notes,
    sent_to_kitchen_at: toIsoDate(i.sent_to_kitchen_at),
    served_at: toIsoDate(i.served_at),
    rejection_reason: i.rejection_reason,
    cancellation_reason: i.cancellation_reason,
  };
}

function serializeOrderDetailPayload(order, items, extra = {}) {
  return {
    order: serializeOrderDetail(order),
    items: mapList(items, serializeOrderItem),
    ...extra,
  };
}

function serializeCaisseReadyRow(row) {
  return {
    can_pay: row.can_pay,
    pay_block_reason: row.pay_block_reason,
    amounts: row.amounts ? pick(row.amounts, ['balance_due', 'total_due', 'amount_paid']) : undefined,
    order: serializeOrderDetail(row.order),
  };
}

function serializePaymentHistoryRow(row) {
  const r = pick(row, [
    '_id',
    'order_id',
    'receipt_number',
    'processed_at',
    'order_number',
    'waiter',
    'method',
    'amount',
    'processed_by',
    'is_void',
  ]);
  return { ...r, processed_at: toIsoDate(r.processed_at) };
}

function serializeCategory(doc) {
  const c = toPlain(doc);
  return {
    _id: c._id,
    name: c.name,
    image_url: c.image_url,
    color: c.color,
    extra_ids: Array.isArray(c.extra_ids) ? c.extra_ids : [],
  };
}

function serializeSubcategory(doc) {
  const s = toPlain(doc);
  return {
    _id: s._id,
    name: s.name,
    sort_order: s.sort_order,
    category: pickRef(s, 'category', ['_id', 'name']),
  };
}

function serializeModifier(mod) {
  return pick(mod, ['_id', 'name', 'price_adjustment']);
}

function serializeModifierGroup(group) {
  const g = toPlain(group);
  return {
    _id: g._id,
    name: g.name,
    modifiers: mapList(g.modifiers, serializeModifier),
  };
}

function serializeMenuItemList(doc) {
  const i = toPlain(doc);
  return {
    _id: i._id,
    name: i.name,
    image_url: i.image_url,
    price: i.price,
    product_type: i.product_type,
    is_active: i.is_active,
    category: pickRef(i, 'category', ['_id', 'name']),
  };
}

function serializeMenuItemPos(doc) {
  const { resolveMenuItemExtraIds } = require('./menu-extras');
  const i = toPlain(doc);
  return {
    ...serializeMenuItemList(i),
    description: i.description,
    subcategory: pickRef(i, 'subcategory', ['_id', 'name']),
    variants: i.variants,
    modifier_groups: mapList(i.modifier_groups, serializeModifierGroup),
    assigned_extra_ids: resolveMenuItemExtraIds(i),
  };
}

function serializeMenuItemForm(doc) {
  const i = toPlain(doc);
  return {
    _id: i._id,
    name: i.name,
    description: i.description,
    price: i.price,
    product_type: i.product_type,
    image_url: i.image_url,
    is_active: i.is_active,
    category: i.category,
    subcategory: i.subcategory,
    variants: i.variants,
    modifier_groups: i.modifier_groups,
    extra_ids: Array.isArray(i.extra_ids) ? i.extra_ids : [],
    use_category_extras: i.use_category_extras !== false && i.use_category_extras !== 0,
  };
}

function serializeExtra(doc) {
  return pick(doc, ['_id', 'name', 'image_url', 'price', 'is_active']);
}

function serializeCustomerList(doc) {
  return pick(doc, ['_id', 'name', 'phone', 'email', 'balance', 'is_active']);
}

function serializeCustomerForm(doc) {
  return pick(doc, ['_id', 'name', 'phone', 'email', 'notes', 'is_active', 'balance']);
}

function serializeExpenseList(doc) {
  const e = toPlain(doc);
  return {
    _id: e._id,
    expense_date: e.expense_date,
    title: e.title,
    category: e.category,
    supplier: e.supplier,
    reference: e.reference,
    payment_method: e.payment_method,
    amount: e.amount,
    recorded_by: pickRef(e, 'recorded_by', ['fullname']),
  };
}

function serializeExpenseForm(doc) {
  return pick(doc, [
    '_id',
    'title',
    'description',
    'category',
    'amount',
    'expense_date',
    'payment_method',
    'supplier',
    'reference',
  ]);
}

function serializeRoom(doc) {
  return pick(doc, ['_id', 'name', 'sort_order', 'layout_width', 'layout_height']);
}

function serializeTableList(doc) {
  const t = toPlain(doc);
  const currentOrder = t.current_order?._id || t.current_order;
  return {
    _id: t._id,
    name: t.name,
    status: t.status,
    room: t.room,
    capacity: t.capacity,
    position: t.position,
    merge_group_id: t.merge_group_id || null,
    is_merge_primary: Boolean(t.is_merge_primary),
    current_order: currentOrder ? String(currentOrder) : null,
  };
}

function serializeTablePos(doc) {
  return pick(doc, ['_id', 'name']);
}

function serializeShiftCurrent(shift) {
  if (!shift) return null;
  const data = pick(shift, ['_id', 'source', 'clock_in', 'opening_amount', 'role_key']);
  data.clock_in = toIsoDate(data.clock_in);
  return data;
}

function serializeShiftHistory(shift) {
  const data = pick(shift, [
    '_id',
    'clock_in',
    'clock_out',
    'source',
    'auto_closed_reason',
    'opening_amount',
    'closing_amount',
    'is_active',
  ]);
  data.clock_in = toIsoDate(data.clock_in);
  data.clock_out = toIsoDate(data.clock_out);
  return data;
}

function serializeShiftAdmin(shift) {
  const s = toPlain(shift);
  return {
    _id: s._id,
    clock_in: toIsoDate(s.clock_in),
    clock_out: toIsoDate(s.clock_out),
    is_active: s.is_active,
    source: s.source,
    user: s.user
      ? {
          fullname: s.user.fullname,
          role: pickRef(s.user, 'role', ['role_key', 'name']),
        }
      : null,
  };
}

function serializeShiftPlan(plan) {
  const p = toPlain(plan);
  return {
    _id: p._id,
    planned_start: p.planned_start,
    planned_end: p.planned_end,
    role_key: p.role_key,
    notes: p.notes,
    user: pickRef(p, 'user', ['_id', 'fullname']),
  };
}

function serializeRoleList(role) {
  return pick(role, ['_id', 'name', 'display_name', 'role_key', 'role_type', 'is_hidden', 'status', 'is_active']);
}

function serializePermission(p) {
  return pick(p, ['_id', 'name', 'code_permission', 'slug', 'module', 'resource', 'action']);
}

function serializeRolePermissionsPayload(data) {
  const d = toPlain(data);
  const matrix = mapList(d.matrix, (row) => ({
    granted: row.granted,
    role_permission_id: row.role_permission_id,
    permission: serializePermission(row.permission),
  }));

  return {
    role: serializeRoleList(d.role),
    is_superadmin: d.is_superadmin,
    matrix,
    module_groups: buildPermissionModuleGroups(d.matrix),
  };
}

module.exports = {
  mapList,
  pick,
  pickRef,
  toPlain,
  sanitizeForClient,
  STRIP_FIELDS,
  buildPermissionModuleGroups,
  serializeUserAdmin,
  serializeUserList,
  serializeEstablishmentCurrent,
  serializeEstablishmentSettings,
  buildEstablishmentCapabilities,
  serializeLicenseStatusPublic,
  serializeOrderList,
  serializeOrderDetail,
  serializeOrderItem,
  serializeOrderDetailPayload,
  serializeCaisseReadyRow,
  serializePaymentHistoryRow,
  serializeCategory,
  serializeSubcategory,
  serializeMenuItemList,
  serializeMenuItemPos,
  serializeMenuItemForm,
  serializeExtra,
  serializeCustomerList,
  serializeCustomerForm,
  serializeExpenseList,
  serializeExpenseForm,
  serializeRoom,
  serializeTableList,
  serializeTablePos,
  serializeShiftCurrent,
  serializeShiftHistory,
  serializeShiftAdmin,
  serializeShiftPlan,
  serializeRoleList,
  serializePermission,
  serializeRolePermissionsPayload,
};
