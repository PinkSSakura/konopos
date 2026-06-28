import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Info, TriangleAlert } from 'lucide-react';
import client from '../../api/client';
import { useEstablishment } from '../../context/EstablishmentContext';
import { useAuth } from '../../context/AuthContext';
import { CardLoading } from '../../components/loading/LoadingStates';
import { message } from '@/lib/toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

const EMPTY_FORM = {
  name: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  patente: '',
  ice: '',
  identifiant_fiscal: '',
  rc: '',
};

export default function EstablishmentAdminPage() {
  const {
    establishment, refresh, hasEstablishment, hasEstablishmentRecord, loading,
  } = useEstablishment();
  const { user, refreshUser } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const isSuperAdmin = user?.role?.role_key === 'superadmin';

  useEffect(() => {
    if (!establishment) {
      setForm(EMPTY_FORM);
      return;
    }
    setForm({
      name: establishment.name || '',
      address: establishment.address || '',
      phone: establishment.phone || '',
      email: establishment.email || '',
      website: establishment.website || '',
      patente: establishment.patente || '',
      ice: establishment.ice || '',
      identifiant_fiscal: establishment.identifiant_fiscal || '',
      rc: establishment.rc || '',
    });
  }, [establishment]);

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!form.name?.trim()) {
      message.warning('Nom de l\'établissement obligatoire');
      return;
    }

    setSaving(true);
    try {
      if (!hasEstablishment) {
        await client.post('/establishment/current', form);
        message.success(hasEstablishmentRecord ? 'Configuration finalisée' : 'Établissement créé');
      } else {
        await client.patch('/establishment/current', form);
        message.success('Établissement mis à jour');
      }
      await Promise.all([refresh(), refreshUser()]);
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur enregistrement');
    } finally {
      setSaving(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="establishment-admin-page">
        <Card>
          <CardHeader>
            <CardTitle>Établissement</CardTitle>
            <CardDescription>
              Seul le Super Admin peut créer l&apos;établissement initial.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="establishment-admin-page">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Établissement</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasEstablishment
              ? 'Informations principales de votre établissement.'
              : hasEstablishmentRecord
                ? 'Finalisez la configuration de l\'établissement existant.'
                : 'Étape 1 : créez votre établissement. Ensuite, ajoutez les utilisateurs et configurez le menu.'}
          </p>
        </div>

        {!loading && !hasEstablishmentRecord && (
          <Alert className="border-sky-200 bg-sky-50 text-sky-950">
            <Info className="size-4" />
            <AlertTitle>Première configuration</AlertTitle>
            <AlertDescription>
              Après la création, vous pourrez ajouter des utilisateurs (propriétaire, managers, serveurs…) depuis Administration → Utilisateurs.
            </AlertDescription>
          </Alert>
        )}

        {!loading && hasEstablishmentRecord && !hasEstablishment && (
          <Alert className="border-amber-200 bg-amber-50 text-amber-950">
            <TriangleAlert className="size-4" />
            <AlertTitle>Configuration incomplète</AlertTitle>
            <AlertDescription>
              Un établissement existe déjà en base. Complétez les informations ci-dessous puis enregistrez pour activer le POS et la gestion des utilisateurs.
            </AlertDescription>
          </Alert>
        )}

        {loading ? (
          <CardLoading />
        ) : (
          <Card>
            <CardContent className="pt-6">
              <form className="grid gap-4" onSubmit={onSubmit}>
                <div className="grid gap-2">
                  <Label htmlFor="establishment-name">Nom de l&apos;établissement</Label>
                  <Input
                    id="establishment-name"
                    value={form.name}
                    onChange={(e) => setField('name', e.target.value)}
                    placeholder="Mon restaurant"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="establishment-address">Adresse</Label>
                  <Input
                    id="establishment-address"
                    value={form.address}
                    onChange={(e) => setField('address', e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="establishment-phone">Téléphone</Label>
                  <Input
                    id="establishment-phone"
                    value={form.phone}
                    onChange={(e) => setField('phone', e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="establishment-email">E-mail</Label>
                  <Input
                    id="establishment-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setField('email', e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="establishment-website">Site web</Label>
                  <Input
                    id="establishment-website"
                    value={form.website}
                    onChange={(e) => setField('website', e.target.value)}
                    placeholder="https://"
                  />
                </div>

                <Separator className="my-2" />
                <p className="text-sm font-medium">Identifiants légaux</p>

                <div className="establishment-admin-fiscal-grid">
                  <div className="grid gap-2">
                    <Label htmlFor="establishment-patente">Patente</Label>
                    <Input
                      id="establishment-patente"
                      value={form.patente}
                      onChange={(e) => setField('patente', e.target.value)}
                      placeholder="N° patente"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="establishment-ice">ICE</Label>
                    <Input
                      id="establishment-ice"
                      value={form.ice}
                      onChange={(e) => setField('ice', e.target.value)}
                      placeholder="Identifiant Commun de l'Entreprise"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="establishment-if">IF</Label>
                    <Input
                      id="establishment-if"
                      value={form.identifiant_fiscal}
                      onChange={(e) => setField('identifiant_fiscal', e.target.value)}
                      placeholder="Identifiant fiscal"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="establishment-rc">RC</Label>
                    <Input
                      id="establishment-rc"
                      value={form.rc}
                      onChange={(e) => setField('rc', e.target.value)}
                      placeholder="Registre de commerce"
                    />
                  </div>
                </div>

                <Button type="submit" disabled={saving}>
                  {saving
                    ? 'Enregistrement…'
                    : hasEstablishment
                      ? 'Enregistrer'
                      : hasEstablishmentRecord
                        ? 'Finaliser la configuration'
                        : 'Créer l\'établissement'}
                </Button>
              </form>

              {hasEstablishment && (
                <>
                  <Separator className="my-6" />
                  <p className="text-sm text-muted-foreground">
                    Imprimantes, shifts, TVA et autres options :{' '}
                    <Link to="/admin/settings" className="underline underline-offset-2">
                      Paramètres établissement
                    </Link>
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
