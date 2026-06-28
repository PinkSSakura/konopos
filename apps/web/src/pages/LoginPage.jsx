import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getHomeRoute } from '../utils/homeRoute';
import AppLogo from '../components/AppLogo';
import AppWordmark from '../components/AppWordmark';
import TouchModeToggle from '../components/touch/TouchModeToggle';
import PinKeypad from '../components/auth/PinKeypad';
import client from '../api/client';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pin, setPin] = useState('');
  const [loginOptions, setLoginOptions] = useState({
    pin_login_available: false,
    waiter_quick_pin_mode: false,
    has_systempos: false,
  });
  const [mode, setMode] = useState(searchParams.get('mode') === 'pin' ? 'pin' : 'password');
  const [formData, setFormData] = useState({
    identifier: '',
    password: '',
  });

  useEffect(() => {
    client.get('/auth/login-options')
      .then((res) => {
        const data = res.data?.data || {};
        setLoginOptions(data);
        if (searchParams.get('mode') === 'pin' && data.pin_login_available) {
          setMode('pin');
        }
      })
      .catch(() => {});
  }, [searchParams]);

  const onSubmitPassword = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const data = await login(formData, 'password');
      toast.success('Connexion réussie');
      if (data.requires_shift_start) {
        navigate('/shift');
        return;
      }
      navigate(getHomeRoute(data.user?.role?.role_key));
    } catch (err) {
      const message = err.code === 'LOGIN_CHALLENGE_DENIED'
        ? 'Connexion refusée par l\'autre appareil.'
        : (err.response?.data?.message || err.message || 'Échec de connexion');
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const submitPin = async (value) => {
    if (value.length !== 6 || pinLoading) return;
    setPinLoading(true);
    try {
      const data = await login({ pin: value }, 'pin-direct');
      toast.success('Session serveur ouverte');
      setPin('');
      if (data.requires_shift_start) {
        navigate('/shift');
        return;
      }
      navigate(getHomeRoute(data.user?.role?.role_key));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Échec connexion PIN');
      setPin('');
    } finally {
      setPinLoading(false);
    }
  };

  const showPinTab = loginOptions.pin_login_available;

  return (
    <div className="login-split">
      <aside className="login-split__brand" aria-hidden="true">
        <div className="login-split__brand-logo">
          <AppLogo variant="mark" className="login-split__brand-image" />
        </div>
      </aside>

      <section className="login-split__auth">
        <div className="login-split__card">
          <div className="login-split__mobile-brand">
            <AppWordmark className="app-wordmark--login" />
          </div>

          <div className="login-split__card-top">
            <TouchModeToggle showLabel />
          </div>

          {showPinTab && (
            <div className="login-split__tabs" role="tablist" aria-label="Mode de connexion">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'password'}
                className={`login-split__tab${mode === 'password' ? ' login-split__tab--active' : ''}`}
                onClick={() => setMode('password')}
              >
                Identifiant
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'pin'}
                className={`login-split__tab${mode === 'pin' ? ' login-split__tab--active' : ''}`}
                onClick={() => setMode('pin')}
              >
                PIN
              </button>
            </div>
          )}

          {mode === 'password' || !showPinTab ? (
            <form onSubmit={onSubmitPassword}>
              <h1 className="login-split__title">Connexion</h1>

              <div className="login-input-group">
                <input
                  id="identifier"
                  type="text"
                  autoFocus
                  required
                  autoComplete="username"
                  value={formData.identifier}
                  onChange={(event) => setFormData((prev) => ({
                    ...prev,
                    identifier: event.target.value,
                  }))}
                />
                <label htmlFor="identifier">Identifiant, matricule ou e-mail</label>
              </div>

              <div className="login-input-group">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={formData.password}
                  onChange={(event) => setFormData((prev) => ({
                    ...prev,
                    password: event.target.value,
                  }))}
                />
                <label htmlFor="password">Mot de passe</label>
                <button
                  type="button"
                  className="login-input-toggle"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>

              <Button
                type="submit"
                className="login-split__submit"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                ) : (
                  'Se connecter'
                )}
              </Button>
            </form>
          ) : (
            <div>
              <h1 className="login-split__title">Connexion PIN</h1>
              <p className="text-sm text-muted-foreground mb-4">
                6 chiffres — session courte réservée au service en salle.
              </p>
              <PinKeypad
                pin={pin}
                onPinChange={setPin}
                onSubmit={submitPin}
                loading={pinLoading}
              />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
