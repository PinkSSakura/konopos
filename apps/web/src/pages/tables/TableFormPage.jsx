import React, { useState } from 'react';
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import { message } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import client from '../../api/client';
import FormPageShell from '../../components/FormPageShell';
import { useEstablishment } from '../../context/EstablishmentContext';

export default function TableFormPage() {
  const { tablesEnabled } = useEstablishment();
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get('room');
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState(4);
  const [submitting, setSubmitting] = useState(false);

  if (!tablesEnabled) {
    return <Navigate to="/pos" replace />;
  }

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!roomId) {
      message.error('Salle non sélectionnée');
      return;
    }
    if (!name.trim()) {
      message.warning('Nom requis');
      return;
    }
    setSubmitting(true);
    try {
      await client.post('/tables', {
        room: roomId,
        name: name.trim(),
        capacity: Number(capacity) || 4,
        position: { x: 40, y: 40, width: 100, height: 60 },
      });
      message.success('Table créée');
      navigate('/tables');
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormPageShell title="Nouvelle table" backTo="/tables">
      <form onSubmit={onSubmit} className="max-w-[400px] space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nom</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="capacity">Places</Label>
          <Input
            id="capacity"
            type="number"
            min={1}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            required
          />
        </div>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Création…' : 'Créer'}
        </Button>
      </form>
    </FormPageShell>
  );
}
