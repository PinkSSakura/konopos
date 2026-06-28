import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FormLoading } from '../../components/loading/LoadingStates';
import client from '../../api/client';
import FormPageShell from '../../components/FormPageShell';
import { message } from '@/lib/toast';
import AppSelect from '@/components/ui/AppSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  EXPENSE_CATEGORY_OPTIONS,
  EXPENSE_PAYMENT_METHOD_OPTIONS,
} from '../../utils/expenseLabels';

const EMPTY_FORM = {
  title: '',
  description: '',
  category: 'merchandise',
  amount: '',
  expense_date: new Date().toISOString().slice(0, 10),
  payment_method: 'cash',
  supplier: '',
  reference: '',
};

export default function ExpenseFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(isEdit);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (!isEdit) return;

    client
      .get(`/expenses/${id}`)
      .then((res) => {
        const e = res.data.data;
        setForm({
          title: e.title || '',
          description: e.description || '',
          category: e.category || 'merchandise',
          amount: e.amount ?? '',
          expense_date: e.expense_date ? e.expense_date.slice(0, 10) : '',
          payment_method: e.payment_method || 'cash',
          supplier: e.supplier || '',
          reference: e.reference || '',
        });
      })
      .catch(() => message.error('Dépense introuvable'))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!form.title?.trim()) {
      message.warning('Libellé obligatoire');
      return;
    }
    if (!form.category) {
      message.warning('Catégorie obligatoire');
      return;
    }
    if (!form.amount || Number(form.amount) <= 0) {
      message.warning('Montant obligatoire');
      return;
    }
    if (!form.expense_date) {
      message.warning('Date obligatoire');
      return;
    }

    const body = {
      title: form.title.trim(),
      description: form.description?.trim() || undefined,
      category: form.category,
      amount: Number(form.amount),
      expense_date: new Date(`${form.expense_date}T12:00:00`).toISOString(),
      payment_method: form.payment_method,
      supplier: form.supplier?.trim() || undefined,
      reference: form.reference?.trim() || undefined,
    };

    try {
      if (isEdit) {
        await client.put(`/expenses/${id}`, body);
        message.success('Dépense mise à jour');
      } else {
        await client.post('/expenses', body);
        message.success('Dépense enregistrée');
      }
      navigate('/admin/expenses');
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur');
    }
  };

  if (loading) return <FormLoading />;

  return (
    <FormPageShell
      title={isEdit ? 'Modifier la dépense' : 'Nouvelle dépense'}
      backTo="/admin/expenses"
    >
      <form className="grid max-w-[520px] gap-4" onSubmit={onSubmit}>
        <div className="grid gap-2">
          <Label htmlFor="expense-title">Libellé</Label>
          <Input
            id="expense-title"
            value={form.title}
            onChange={(e) => setField('title', e.target.value)}
            placeholder="Ex. Facture électricité, Achat viande…"
            required
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="expense-category">Catégorie</Label>
          <AppSelect
            value={form.category}
            onChange={(value) => setField('category', value)}
            options={EXPENSE_CATEGORY_OPTIONS}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="expense-amount">Montant (MAD)</Label>
          <Input
            id="expense-amount"
            type="number"
            min="0.01"
            step="0.01"
            value={form.amount}
            onChange={(e) => setField('amount', e.target.value)}
            required
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="expense-date">Date de dépense</Label>
          <Input
            id="expense-date"
            type="date"
            value={form.expense_date}
            onChange={(e) => setField('expense_date', e.target.value)}
            required
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="expense-payment">Mode de paiement</Label>
          <AppSelect
            value={form.payment_method}
            onChange={(value) => setField('payment_method', value)}
            options={EXPENSE_PAYMENT_METHOD_OPTIONS}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="expense-supplier">Fournisseur</Label>
          <Input
            id="expense-supplier"
            value={form.supplier}
            onChange={(e) => setField('supplier', e.target.value)}
            placeholder="Nom du fournisseur"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="expense-reference">Référence / N° facture</Label>
          <Input
            id="expense-reference"
            value={form.reference}
            onChange={(e) => setField('reference', e.target.value)}
            placeholder="N° facture, bon de commande…"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="expense-description">Notes</Label>
          <Textarea
            id="expense-description"
            rows={3}
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
            placeholder="Détails complémentaires…"
          />
        </div>

        <Button type="submit">{isEdit ? 'Enregistrer' : 'Créer la dépense'}</Button>
      </form>
    </FormPageShell>
  );
}
