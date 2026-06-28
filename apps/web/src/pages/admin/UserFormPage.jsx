import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { FormLoading } from '../../components/loading/LoadingStates';
import client from '../../api/client';
import FormPageShell from '../../components/FormPageShell';
import { PIN_ROLES, PASSWORD_ROLES } from '../../utils/authRoles';
import { message } from '@/lib/toast';
import AppSelect from '@/components/ui/AppSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

const EMPTY_FORM = {
  fullname: '',
  role: '',
  username: '',
  password: '',
  pin: '',
  is_system_pos: false,
  email: '',
  phonenumber: '',
  status: 'actif',
  is_active: true,
};

export default function UserFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [codes, setCodes] = useState({ code_user: null, matricule: null });
  const [form, setForm] = useState(EMPTY_FORM);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const selectedRole = roles.find((r) => r._id === form.role);
  const roleKey = selectedRole?.role_key;
  const showPin = roleKey && PIN_ROLES.includes(roleKey);
  const showPasswordField = roleKey && (PASSWORD_ROLES.includes(roleKey) || roleKey === 'superadmin');
  const showSystemPos = roleKey === 'systempos';

  useEffect(() => {
    client.get('/admin/roles').then((res) => setRoles(res.data.data));

    if (!isEdit) return;

    client
      .get(`/admin/users/${id}`)
      .then((res) => {
        const u = res.data.data;
        setForm({
          fullname: u.fullname || '',
          role: u.role?._id || u.role || '',
          username: u.username || '',
          password: '',
          pin: '',
          is_system_pos: u.is_systempos_terminal ?? false,
          email: u.email || '',
          phonenumber: u.phonenumber || '',
          status: u.status || 'actif',
          is_active: u.is_active !== false,
        });
        setCodes({ code_user: u.code_user, matricule: u.matricule });
      })
      .catch(() => message.error('Utilisateur introuvable'))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();

    if (!form.fullname?.trim()) {
      message.warning('Nom complet obligatoire');
      return;
    }
    if (!form.role) {
      message.warning('Rôle obligatoire');
      return;
    }
    if (showPasswordField && !isEdit && !form.username?.trim()) {
      message.warning('Identifiant obligatoire');
      return;
    }
    if (showPasswordField && !isEdit && (!form.password || form.password.length < 8)) {
      message.warning('Mot de passe requis (8 caractères minimum)');
      return;
    }
    if (showPin && !isEdit && !/^\d{6}$/.test(form.pin || '')) {
      message.warning('PIN requis (6 chiffres)');
      return;
    }

    const body = { ...form };
    if (!body.password) delete body.password;
    if (!body.pin) delete body.pin;

    try {
      if (isEdit) {
        await client.put(`/admin/users/${id}`, body);
        message.success('Utilisateur mis à jour');
      } else {
        const res = await client.post('/admin/users', body);
        const u = res.data.data;
        message.success(`Utilisateur créé — Code: ${u.code_user}, Matricule: ${u.matricule}`);
      }
      navigate('/admin/users');
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur');
    }
  };

  if (loading) return <FormLoading />;

  return (
    <FormPageShell title={isEdit ? 'Modifier utilisateur' : 'Nouvel utilisateur'} backTo="/admin/users">
      {isEdit && (codes.code_user || codes.matricule) && (
        <dl className="mb-6 grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted-foreground">Code utilisateur</dt>
            <dd className="text-sm font-medium">{codes.code_user || '—'}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Matricule</dt>
            <dd className="text-sm font-medium">{codes.matricule || '—'}</dd>
          </div>
        </dl>
      )}

      {!isEdit && (
        <p className="mb-4 text-sm text-muted-foreground">
          Code utilisateur et matricule générés automatiquement :{' '}
          <code>{'{code_établissement}U{YYYYddMMHHmmss}'}</code> et{' '}
          <code>{'AAA123'}</code> (3 lettres + 3 chiffres).
        </p>
      )}

      <form className="grid gap-6" onSubmit={onSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="user-fullname">Nom complet</Label>
              <Input
                id="user-fullname"
                value={form.fullname}
                onChange={(e) => setField('fullname', e.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="user-role">Rôle</Label>
              <AppSelect
                value={form.role}
                onChange={(value) => setField('role', value)}
                options={roles.map((r) => ({
                  value: r._id,
                  label: `${r.name} (${r.role_key})`,
                }))}
                placeholder="Choisir un rôle"
                disabled={isEdit && selectedRole?.role_key === 'superadmin'}
              />
            </div>

            {showPasswordField && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="user-username">Identifiant</Label>
                  <Input
                    id="user-username"
                    value={form.username}
                    onChange={(e) => setField('username', e.target.value)}
                    required={!isEdit}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="user-password">
                    {isEdit ? 'Nouveau mot de passe (vide = inchangé)' : 'Mot de passe'}
                  </Label>
                  <div className="relative">
                    <Input
                      id="user-password"
                      type={passwordVisible ? 'text' : 'password'}
                      value={form.password}
                      onChange={(e) => setField('password', e.target.value)}
                      required={!isEdit}
                      minLength={isEdit ? undefined : 8}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setPasswordVisible((v) => !v)}
                      aria-label={passwordVisible ? 'Masquer' : 'Afficher'}
                    >
                      {passwordVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </Button>
                  </div>
                </div>
              </>
            )}

            {showPin && (
              <div className="grid gap-2">
                <Label htmlFor="user-pin">PIN (6 chiffres, unique dans l&apos;établissement)</Label>
                <Input
                  id="user-pin"
                  value={form.pin}
                  onChange={(e) => setField('pin', e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  inputMode="numeric"
                  required={!isEdit}
                />
              </div>
            )}

            {showSystemPos && (
              <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                <Label htmlFor="user-systempos">Terminal SystemPOS actif</Label>
                <Switch
                  id="user-systempos"
                  checked={form.is_system_pos}
                  onCheckedChange={(checked) => setField('is_system_pos', checked)}
                />
              </div>
            )}
          </div>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="user-email">E-mail</Label>
              <Input
                id="user-email"
                type="email"
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="user-phone">Téléphone</Label>
              <Input
                id="user-phone"
                value={form.phonenumber}
                onChange={(e) => setField('phonenumber', e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="user-status">Statut</Label>
              <AppSelect
                value={form.status}
                onChange={(value) => setField('status', value)}
                options={[
                  { value: 'actif', label: 'Actif' },
                  { value: 'inactif', label: 'Inactif' },
                ]}
              />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
              <Label htmlFor="user-active">Compte activé</Label>
              <Switch
                id="user-active"
                checked={form.is_active}
                onCheckedChange={(checked) => setField('is_active', checked)}
              />
            </div>
          </div>
        </div>

        <Button type="submit">{isEdit ? 'Enregistrer' : 'Créer'}</Button>
      </form>
    </FormPageShell>
  );
}
