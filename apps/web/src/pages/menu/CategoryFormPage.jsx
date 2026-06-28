import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { message } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormLoading } from '../../components/loading/LoadingStates';
import ExtrasPicker from '../../components/menu/ExtrasPicker';
import client from '../../api/client';
import FormPageShell from '../../components/FormPageShell';

const DEFAULT_COLOR = '#ceb38f';

export default function CategoryFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [imageUrl, setImageUrl] = useState(null);
  const [extras, setExtras] = useState([]);
  const [extraIds, setExtraIds] = useState([]);

  useEffect(() => {
    const loads = [client.get('/menu/extras')];
    if (isEdit) loads.push(client.get('/menu/categories'));

    Promise.all(loads)
      .then(([extrasRes, categoriesRes]) => {
        setExtras((extrasRes.data.data || []).filter((e) => e.is_active !== false));
        if (categoriesRes) {
          const cat = categoriesRes.data.data.find((c) => c._id === id);
          if (cat) {
            setName(cat.name || '');
            setColor(cat.color || DEFAULT_COLOR);
            setImageUrl(cat.image_url || null);
            setExtraIds(cat.extra_ids || []);
          } else {
            message.error('Catégorie introuvable');
          }
        }
      })
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const toggleExtra = (extraId, checked) => {
    setExtraIds((prev) => (
      checked ? [...prev, extraId] : prev.filter((x) => x !== extraId)
    ));
  };

  const uploadImage = async (file) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await client.post('/menu/categories/upload', fd, {
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
    if (!name.trim()) {
      message.warning('Nom requis');
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        name: name.trim(),
        image_url: imageUrl || null,
        color,
        extra_ids: extraIds,
      };
      if (isEdit) await client.put(`/menu/categories/${id}`, body);
      else await client.post('/menu/categories', body);
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
    <FormPageShell title={isEdit ? 'Modifier catégorie' : 'Nouvelle catégorie'} backTo="/menu">
      <form onSubmit={onSubmit} className="max-w-[480px] space-y-4">
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
          <Label htmlFor="color">Couleur (affichée sans image)</Label>
          <div className="flex items-center gap-3">
            <input
              id="color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="size-10 cursor-pointer rounded border p-0.5"
            />
            <span className="text-sm text-muted-foreground">{color}</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Extras par défaut (POS)</Label>
          <p className="text-sm text-muted-foreground">
            Articles de cette catégorie héritent de ces extras, sauf personnalisation par article.
          </p>
          {extras.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun extra actif — créez-en dans Menu → Extras.</p>
          ) : (
            <ExtrasPicker
              extras={extras}
              selectedIds={extraIds}
              onToggle={toggleExtra}
              maxHeightClass="max-h-64"
            />
          )}
        </div>

        <Button type="submit" disabled={uploading || submitting}>
          {submitting ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer'}
        </Button>
      </form>
    </FormPageShell>
  );
}
