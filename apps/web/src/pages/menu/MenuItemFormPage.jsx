import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { message } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import AppSelect from '@/components/ui/AppSelect';
import { FormLoading } from '../../components/loading/LoadingStates';
import ExtrasPicker from '../../components/menu/ExtrasPicker';
import client from '../../api/client';
import FormPageShell from '../../components/FormPageShell';

export default function MenuItemFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [productType, setProductType] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [imageUrl, setImageUrl] = useState(null);
  const [extras, setExtras] = useState([]);
  const [useCategoryExtras, setUseCategoryExtras] = useState(true);
  const [extraIds, setExtraIds] = useState([]);

  useEffect(() => {
    const loads = [
      client.get('/menu/categories'),
      client.get('/menu/subcategories'),
      client.get('/menu/extras'),
    ];
    if (isEdit) loads.push(client.get(`/menu/items/${id}`));

    Promise.all(loads)
      .then(([c, s, extrasRes, itemRes]) => {
        setCategories(c.data.data);
        setSubcategories(s.data.data);
        setExtras((extrasRes.data.data || []).filter((e) => e.is_active !== false));
        if (itemRes) {
          const item = itemRes.data.data;
          setName(item.name || '');
          setDescription(item.description || '');
          setPrice(item.price ?? '');
          setProductType(item.product_type || '');
          setCategory(item.category?._id || item.category || '');
          setSubcategory(item.subcategory?._id || item.subcategory || '');
          setImageUrl(item.image_url || null);
          setUseCategoryExtras(item.use_category_extras !== false);
          setExtraIds(item.extra_ids || []);
        }
      })
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const toggleExtra = (extraId, checked) => {
    setExtraIds((prev) => (
      checked ? [...prev, extraId] : prev.filter((x) => x !== extraId)
    ));
  };

  const selectedCategory = categories.find((c) => c._id === category);
  const inheritedExtraCount = selectedCategory?.extra_ids?.length ?? 0;

  const uploadImage = async (file) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await client.post('/menu/items/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = res.data.data.url;
      setImageUrl(url);
      message.success('Image téléversée');
    } catch (err) {
      message.error(err.response?.data?.message || 'Échec du téléversement');
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!name.trim() || !productType || !category) {
      message.warning('Remplissez les champs obligatoires');
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        name: name.trim(),
        description,
        price: Number(price),
        product_type: productType,
        category,
        subcategory: subcategory || undefined,
        image_url: imageUrl || null,
        variants: [],
        modifier_groups: [],
        use_category_extras: useCategoryExtras,
        extra_ids: extraIds,
      };
      if (isEdit) await client.put(`/menu/items/${id}`, body);
      else await client.post('/menu/items', body);
      message.success('Enregistré');
      navigate('/menu');
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <FormLoading />;

  return (
    <FormPageShell title={isEdit ? 'Modifier article' : 'Nouvel article'} backTo="/menu">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Image</Label>
              <label className="flex size-28 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed bg-muted/30 hover:bg-muted/50">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadImage(file);
                    e.target.value = '';
                  }}
                />
                {imageUrl ? (
                  <img src={imageUrl} alt="" className="size-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground">
                    {uploading ? <Loader2 className="size-5 animate-spin" /> : <Plus className="size-5" />}
                    <span className="text-xs">{uploading ? 'Envoi…' : 'Image'}</span>
                  </div>
                )}
              </label>
              {imageUrl && (
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-destructive"
                  onClick={() => setImageUrl(null)}
                >
                  <Trash2 className="mr-1 size-4" />
                  Supprimer l&apos;image
                </Button>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="price">Prix (TTC MAD)</Label>
              <Input
                id="price"
                type="number"
                min={0}
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <AppSelect
                value={productType}
                onChange={setProductType}
                placeholder="Type"
                options={[
                  { value: 'FOOD', label: 'Cuisine (FOOD)' },
                  { value: 'DRINK', label: 'Bar (DRINK)' },
                ]}
              />
            </div>
            <div className="space-y-2">
              <Label>Catégorie</Label>
              <AppSelect
                value={category}
                onChange={setCategory}
                placeholder="Catégorie"
                options={categories.map((c) => ({ value: c._id, label: c.name }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Sous-catégorie</Label>
              <AppSelect
                allowClear
                value={subcategory}
                onChange={setSubcategory}
                placeholder="Sous-catégorie"
                options={subcategories.map((s) => ({ value: s._id, label: s.name }))}
              />
            </div>
            <div className="space-y-3 rounded-lg border p-4">
              <Label>Extras au POS</Label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={useCategoryExtras}
                  onCheckedChange={(checked) => setUseCategoryExtras(Boolean(checked))}
                />
                Inclure les extras de la catégorie
                {useCategoryExtras && selectedCategory ? (
                  <span className="text-muted-foreground">
                    ({inheritedExtraCount} extra{inheritedExtraCount !== 1 ? 's' : ''})
                  </span>
                ) : null}
              </label>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {useCategoryExtras
                    ? 'Extras propres à cet article (ajoutés à ceux de la catégorie) :'
                    : 'Extras disponibles pour cet article :'}
                </p>
                <ExtrasPicker
                  extras={extras}
                  selectedIds={extraIds}
                  onToggle={toggleExtra}
                  maxHeightClass="max-h-64"
                />
              </div>
            </div>
          </div>
        </div>
        <Button type="submit" disabled={uploading || submitting}>
          {submitting ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer'}
        </Button>
      </form>
    </FormPageShell>
  );
}
