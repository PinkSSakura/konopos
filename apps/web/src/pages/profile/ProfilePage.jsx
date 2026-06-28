import React, { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import client from '../../api/client';
import { PageShell } from '../../components/layout/PageShell';
import { useAuth } from '../../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const ROLE_LABELS = {
  superadmin: 'Super Admin',
  owner: 'Propriétaire',
  manager: 'Manager',
  submanager: 'Sous-manager',
  waiter: 'Serveur',
  cook: 'Cuisine',
  barman: 'Bar',
  systempos: 'SystemPOS',
};

function InfoRow({ label, value }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:items-baseline">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium break-words">{value || '—'}</dd>
    </div>
  );
}

export default function ProfilePage() {
  const { user, refreshUser, isPinSession } = useAuth();
  const roleKey = user?.role?.role_key;
  const roleLabel = ROLE_LABELS[roleKey] || user?.role?.name || 'Utilisateur';

  const [profileForm, setProfileForm] = useState({
    fullname: '',
    email: '',
    phonenumber: '',
  });
  const [profileSaving, setProfileSaving] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    refreshUser().catch(() => {
      toast.error('Impossible de charger le profil.');
    });
  }, [refreshUser]);

  useEffect(() => {
    if (!user) return;
    setProfileForm({
      fullname: user.fullname || '',
      email: user.email || '',
      phonenumber: user.phonenumber || '',
    });
  }, [user]);

  const onProfileSubmit = async (event) => {
    event.preventDefault();
    setProfileSaving(true);
    try {
      const res = await client.patch('/auth/profile', profileForm);
      await refreshUser();
      toast.success(res.data.message || 'Profil mis à jour.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Échec de la mise à jour.');
    } finally {
      setProfileSaving(false);
    }
  };

  const onPasswordSubmit = async (event) => {
    event.preventDefault();
    setPasswordSaving(true);
    try {
      const res = await client.post('/auth/change-password', passwordForm);
      toast.success(res.data.message || 'Mot de passe modifié.');
      setPasswordForm({
        current_password: '',
        new_password: '',
        confirm_password: '',
      });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Échec du changement de mot de passe.');
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <PageShell
      title="Mon profil"
      subtitle="Consultez vos informations et mettez à jour votre compte."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Informations du compte</CardTitle>
            <CardDescription>Détails en lecture seule de votre compte.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col gap-3">
              <InfoRow label="Nom complet" value={user?.fullname} />
              <InfoRow label="Identifiant" value={user?.username} />
              <InfoRow label="Matricule" value={user?.matricule} />
              <InfoRow label="Code utilisateur" value={user?.code_user} />
              <InfoRow label="E-mail" value={user?.email} />
              <InfoRow label="Téléphone" value={user?.phonenumber} />
              <InfoRow label="Rôle" value={roleLabel} />
              <InfoRow label="Établissement" value={user?.establishment?.name} />
              <InfoRow label="Statut" value={user?.status} />
            </dl>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Modifier le profil</CardTitle>
              <CardDescription>Mettez à jour vos coordonnées.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="flex flex-col gap-4" onSubmit={onProfileSubmit}>
                <div className="grid gap-2">
                  <Label htmlFor="profile-fullname">Nom complet</Label>
                  <Input
                    id="profile-fullname"
                    value={profileForm.fullname}
                    onChange={(e) => setProfileForm((prev) => ({
                      ...prev,
                      fullname: e.target.value,
                    }))}
                    required
                    autoComplete="name"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="profile-email">E-mail</Label>
                  <Input
                    id="profile-email"
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm((prev) => ({
                      ...prev,
                      email: e.target.value,
                    }))}
                    autoComplete="email"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="profile-phone">Téléphone</Label>
                  <Input
                    id="profile-phone"
                    type="tel"
                    value={profileForm.phonenumber}
                    onChange={(e) => setProfileForm((prev) => ({
                      ...prev,
                      phonenumber: e.target.value,
                    }))}
                    autoComplete="tel"
                  />
                </div>
                <Button type="submit" disabled={profileSaving}>
                  {profileSaving ? 'Enregistrement…' : 'Enregistrer'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {!isPinSession && (
            <Card>
              <CardHeader>
                <CardTitle>Changer le mot de passe</CardTitle>
                <CardDescription>
                  Utilisez un mot de passe d&apos;au moins 8 caractères.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="flex flex-col gap-4" onSubmit={onPasswordSubmit}>
                  <div className="grid gap-2">
                    <Label htmlFor="current-password">Mot de passe actuel</Label>
                    <div className="relative">
                      <Input
                        id="current-password"
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={passwordForm.current_password}
                        onChange={(e) => setPasswordForm((prev) => ({
                          ...prev,
                          current_password: e.target.value,
                        }))}
                        required
                        autoComplete="current-password"
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowCurrentPassword((v) => !v)}
                        aria-label={showCurrentPassword ? 'Masquer' : 'Afficher'}
                      >
                        {showCurrentPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="new-password">Nouveau mot de passe</Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showNewPassword ? 'text' : 'password'}
                        value={passwordForm.new_password}
                        onChange={(e) => setPasswordForm((prev) => ({
                          ...prev,
                          new_password: e.target.value,
                        }))}
                        required
                        minLength={8}
                        autoComplete="new-password"
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowNewPassword((v) => !v)}
                        aria-label={showNewPassword ? 'Masquer' : 'Afficher'}
                      >
                        {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
                    <div className="relative">
                      <Input
                        id="confirm-password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={passwordForm.confirm_password}
                        onChange={(e) => setPasswordForm((prev) => ({
                          ...prev,
                          confirm_password: e.target.value,
                        }))}
                        required
                        minLength={8}
                        autoComplete="new-password"
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowConfirmPassword((v) => !v)}
                        aria-label={showConfirmPassword ? 'Masquer' : 'Afficher'}
                      >
                        {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </Button>
                    </div>
                  </div>
                  <Button type="submit" disabled={passwordSaving}>
                    {passwordSaving ? 'Modification…' : 'Modifier le mot de passe'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </PageShell>
  );
}
