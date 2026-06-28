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

export default function SubcategoryFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    category: '',
    name: '',
    sort_order: '',
  });

  useEffect(() => {
    Promise.all([
      client.get('/menu/categories'),
      isEdit ? client.get('/menu/subcategories') : Promise.resolve({ data: { data: [] } }),
    ])
      .then(([c, s]) => {
        setCategories(c.data.data);
        if (isEdit) {
          const sub = s.data.data.find((x) => x._id === id);
          if (sub) {
            setForm({
              category: sub.category?._id || sub.category || '',
              name: sub.name || '',
              sort_order: sub.sort_order ?? '',
            });
          }
        }
      })
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!form.category || !form.name?.trim()) return;

    const values = {
      category: form.category,
      name: form.name.trim(),
      sort_order: form.sort_order === '' ? undefined : Number(form.sort_order),
    };

    try {
      if (isEdit) await client.put(`/menu/subcategories/${id}`, values);
      else await client.post('/menu/subcategories', values);
      message.success('Enregistré');
      navigate('/menu');
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur');
    }
  };

  if (loading) return <FormLoading />;

  return (
    <FormPageShell title={isEdit ? 'Modifier sous-catégorie' : 'Nouvelle sous-catégorie'} backTo="/menu">
      <form className="grid max-w-[480px] gap-4" onSubmit={onSubmit}>
        <div className="grid gap-2">
          <Label htmlFor="subcategory-category">Catégorie</Label>
          <AppSelect
            value={form.category}
            onChange={(value) => setField('category', value)}
            options={categories.map((c) => ({ value: c._id, label: c.name }))}
            placeholder="Choisir une catégorie"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="subcategory-name">Nom</Label>
          <Input
            id="subcategory-name"
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="subcategory-sort">Ordre</Label>
          <Input
            id="subcategory-sort"
            type="number"
            value={form.sort_order}
            onChange={(e) => setField('sort_order', e.target.value)}
          />
        </div>
        <Button type="submit">{isEdit ? 'Enregistrer' : 'Créer'}</Button>
      </form>
    </FormPageShell>
  );
}
