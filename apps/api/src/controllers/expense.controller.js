const Expense = require('../models/expense.model');
const { EXPENSE_CATEGORIES, EXPENSE_PAYMENT_METHODS } = require('../models/expense.model');
const { query, serializers } = require('../utils')();
const { getEstablishmentId } = query;
const { mapList, serializeExpenseList, serializeExpenseForm } = serializers;

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function buildListFilter(req) {
  const estId = getEstablishmentId(req);
  const filter = { establishment: estId, is_deleted: false };

  if (req.query.category && EXPENSE_CATEGORIES.includes(req.query.category)) {
    filter.category = req.query.category;
  }

  if (req.query.from || req.query.to) {
    filter.expense_date = {};
    if (req.query.from) filter.expense_date.$gte = new Date(req.query.from);
    if (req.query.to) {
      const to = new Date(req.query.to);
      to.setHours(23, 59, 59, 999);
      filter.expense_date.$lte = to;
    }
  }

  const q = req.query.q?.trim();
  if (q) {
    filter.$or = [
      { title: { $regex: q, $options: 'i' } },
      { supplier: { $regex: q, $options: 'i' } },
      { reference: { $regex: q, $options: 'i' } },
      { description: { $regex: q, $options: 'i' } },
    ];
  }

  return filter;
}

function validateExpenseBody(body, isUpdate = false) {
  const patch = {};

  if (!isUpdate || body.title !== undefined) {
    const title = String(body.title || '').trim();
    if (!title) return { error: 'Le libellé est obligatoire.' };
    patch.title = title;
  }

  if (!isUpdate || body.category !== undefined) {
    const category = body.category;
    if (!EXPENSE_CATEGORIES.includes(category)) {
      return { error: 'Catégorie invalide.' };
    }
    patch.category = category;
  }

  if (!isUpdate || body.amount !== undefined) {
    const amount = round2(Number(body.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      return { error: 'Montant invalide.' };
    }
    patch.amount = amount;
  }

  if (!isUpdate || body.expense_date !== undefined) {
    const expenseDate = body.expense_date ? new Date(body.expense_date) : null;
    if (!expenseDate || Number.isNaN(expenseDate.getTime())) {
      return { error: 'Date de dépense invalide.' };
    }
    patch.expense_date = expenseDate;
  }

  if (body.payment_method !== undefined) {
    if (!EXPENSE_PAYMENT_METHODS.includes(body.payment_method)) {
      return { error: 'Mode de paiement invalide.' };
    }
    patch.payment_method = body.payment_method;
  }

  if (body.description !== undefined) {
    patch.description = body.description?.trim() || undefined;
  }
  if (body.supplier !== undefined) {
    patch.supplier = body.supplier?.trim() || undefined;
  }
  if (body.reference !== undefined) {
    patch.reference = body.reference?.trim() || undefined;
  }

  return { patch };
}

async function list(req, res, next) {
  try {
    const filter = buildListFilter(req);
    const limit = Math.min(Number(req.query.limit) || 300, 500);
    const data = await Expense.find(filter)
      .populate('recorded_by', 'fullname')
      .sort({ expense_date: -1, createdAt: -1 })
      .limit(limit);
    res.json({ success: true, data: mapList(data, serializeExpenseList) });
  } catch (err) {
    next(err);
  }
}

async function summary(req, res, next) {
  try {
    const filter = buildListFilter(req);
    const rows = await Expense.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    const byCategory = {};
    let total = 0;
    let count = 0;
    for (const row of rows) {
      const amt = round2(row.total);
      byCategory[row._id] = { total: amt, count: row.count };
      total += amt;
      count += row.count;
    }

    res.json({
      success: true,
      data: {
        total: round2(total),
        count,
        by_category: byCategory,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const doc = await Expense.findOne({
      _id: req.params.id,
      establishment: estId,
      is_deleted: false,
    }).populate('recorded_by', 'fullname');
    if (!doc) return res.status(404).json({ success: false, message: 'Dépense introuvable.' });
    res.json({ success: true, data: serializeExpenseForm(doc) });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const validated = validateExpenseBody(req.body);
    if (validated.error) {
      return res.status(400).json({ success: false, message: validated.error });
    }

    const estId = getEstablishmentId(req);
    const doc = await Expense.create({
      establishment: estId,
      ...validated.patch,
      expense_date: validated.patch.expense_date || new Date(),
      payment_method: validated.patch.payment_method || req.body.payment_method || 'cash',
      recorded_by: req.user._id,
      created_by: req.user._id,
    });

    await doc.populate('recorded_by', 'fullname');
    res.status(201).json({ success: true, data: serializeExpenseForm(doc) });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const validated = validateExpenseBody(req.body, true);
    if (validated.error) {
      return res.status(400).json({ success: false, message: validated.error });
    }

    const estId = getEstablishmentId(req);
    const doc = await Expense.findOneAndUpdate(
      { _id: req.params.id, establishment: estId, is_deleted: false },
      { $set: { ...validated.patch, modified_by: req.user._id } },
      { new: true }
    ).populate('recorded_by', 'fullname');

    if (!doc) return res.status(404).json({ success: false, message: 'Dépense introuvable.' });
    res.json({ success: true, data: serializeExpenseForm(doc) });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const estId = getEstablishmentId(req);
    const doc = await Expense.findOne({
      _id: req.params.id,
      establishment: estId,
      is_deleted: false,
    });
    if (!doc) return res.status(404).json({ success: false, message: 'Dépense introuvable.' });

    doc.is_deleted = true;
    doc.deleted_at = new Date();
    doc.deleted_by = req.user._id;
    doc.modified_by = req.user._id;
    await doc.save();

    res.json({ success: true, message: 'Dépense supprimée.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, summary, getOne, create, update, remove };
