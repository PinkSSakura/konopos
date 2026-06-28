import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { message } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { FormLoading } from '../../components/loading/LoadingStates';
import client from '../../api/client';
import FormPageShell from '../../components/FormPageShell';

export default function ExtraFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(isEdit);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [imageUrl, setImageUrl] = useState(null);

  useEffect(() => {
    if (!isEdit) return;
    client
      .get(`/menu/extras/${id}`)
      .then((res) => {
        const e = res.data.data;
        setName(e.name || '');
        setPrice(e.price ?? 0);
        setIsActive(e.is_active !== false);
        setImageUrl(e.image_url || null);
      })
      .catch(() => message.error('Extra introuvable'))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const uploadImage = async (file) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await client.post('/menu/extras/upload', fd, {
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
        price: Number(price) || 0,
        is_active: isActive,
        image_url: imageUrl || null,
      };
      if (isEdit) await client.put(`/menu/extras/${id}`, body);
      else await client.post('/menu/extras', body);
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
    <FormPageShell title={isEdit ? 'Modifier extra' : 'Nouvel extra'} backTo="/menu">
      <form onSubmit={onSubmit} className="max-w-[480px] space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nom</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Ketchup, Frites, Salade"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="price">Prix (MAD)</Label>
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
        <div className="flex items-center gap-3">
          <Switch id="is_active" checked={isActive} onCheckedChange={setIsActive} />
          <Label htmlFor="is_active">Actif</Label>
        </div>
        <Button type="submit" disabled={uploading || submitting}>
          {submitting ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer'}
        </Button>
      </form>
    </FormPageShell>
  );
}
