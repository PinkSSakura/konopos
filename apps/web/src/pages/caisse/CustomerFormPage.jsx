import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { message } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { FormLoading } from '../../components/loading/LoadingStates';
import client from '../../api/client';
import FormPageShell from '../../components/FormPageShell';

const EMPTY_FORM = {
  name: '',
  phone: '',
  email: '',
  notes: '',
  is_active: true,
};

export default function CustomerFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(isEdit);
  const [balance, setBalance] = useState(0);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!isEdit) return;
    client
      .get(`/customers/${id}`)
      .then((res) => {
        const c = res.data.data;
        setForm({
          name: c.name || '',
          phone: c.phone || '',
          email: c.email || '',
          notes: c.notes || '',
          is_active: c.is_active !== false,
        });
        setBalance(c.balance || 0);
      })
      .catch(() => message.error('Client introuvable'))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const updateField = (key) => (event) => {
    const value = event?.target ? event.target.value : event;
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const validate = () => {
    const next = {};
    if (!form.name?.trim()) next.name = 'Nom obligatoire';
    const email = form.email?.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = 'E-mail invalide';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    const body = {
      name: form.name.trim(),
      phone: form.phone?.trim() || undefined,
      email: form.email?.trim() || undefined,
      notes: form.notes?.trim() || undefined,
      is_active: form.is_active,
    };

    try {
      if (isEdit) {
        await client.put(`/customers/${id}`, body);
        message.success('Client mis à jour');
      } else {
        await client.post('/customers', body);
        message.success('Client créé');
      }
      navigate('/admin/clients');
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur');
    }
  };

  if (loading) return <FormLoading />;

  return (
    <FormPageShell
      title={isEdit ? 'Modifier le client' : 'Nouveau client'}
      backTo="/admin/clients"
    >
      {isEdit && (
        <dl className="mb-6 grid gap-3 rounded-lg border p-4">
          <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:items-baseline">
            <dt className="text-sm text-muted-foreground">Solde dû</dt>
            <dd className="text-sm">
              {(Number(balance) || 0).toFixed(2)} MAD
              {Math.abs(balance) > 0.01 && (
                <span className="ml-2 text-muted-foreground">
                  (mis à jour lors des encaissements crédit / débit)
                </span>
              )}
            </dd>
          </div>
        </dl>
      )}

      <form onSubmit={onSubmit} className="max-w-[480px]">
        <FieldGroup>
          <Field data-invalid={Boolean(errors.name)}>
            <FieldLabel htmlFor="customer-name">Nom</FieldLabel>
            <Input
              id="customer-name"
              value={form.name}
              onChange={updateField('name')}
              placeholder="Ex. Société Atlas, M. Benali…"
            />
            {errors.name ? <FieldError>{errors.name}</FieldError> : null}
          </Field>

          <Field>
            <FieldLabel htmlFor="customer-phone">Téléphone</FieldLabel>
            <Input
              id="customer-phone"
              value={form.phone}
              onChange={updateField('phone')}
              placeholder="06…"
            />
          </Field>

          <Field data-invalid={Boolean(errors.email)}>
            <FieldLabel htmlFor="customer-email">E-mail</FieldLabel>
            <Input
              id="customer-email"
              type="email"
              value={form.email}
              onChange={updateField('email')}
              placeholder="client@exemple.ma"
            />
            {errors.email ? <FieldError>{errors.email}</FieldError> : null}
          </Field>

          <Field>
            <FieldLabel htmlFor="customer-notes">Notes</FieldLabel>
            <Textarea
              id="customer-notes"
              rows={3}
              value={form.notes}
              onChange={updateField('notes')}
              placeholder="Infos utiles pour la caisse…"
            />
          </Field>

          {isEdit && (
            <Field orientation="horizontal">
              <FieldLabel htmlFor="customer-active">Actif</FieldLabel>
              <div className="flex items-center gap-2">
                <Switch
                  id="customer-active"
                  checked={form.is_active}
                  onCheckedChange={(checked) => updateField('is_active')(checked)}
                />
                <span className="text-sm text-muted-foreground">
                  {form.is_active ? 'Oui' : 'Non'}
                </span>
              </div>
            </Field>
          )}

          <Field>
            <Button type="submit">
              {isEdit ? 'Enregistrer' : 'Créer le client'}
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </FormPageShell>
  );
}
