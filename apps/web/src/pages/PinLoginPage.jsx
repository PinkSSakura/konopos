import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Delete } from 'lucide-react';
import { message } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '../context/AuthContext';
import TouchModeToggle from '../components/touch/TouchModeToggle';
import { restoreSystemposShell } from '../utils/restoreSystemposShell';
import { isSystemTerminalContext } from '../utils/terminalContext';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

export default function PinLoginPage() {
  const { login, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const submittingRef = useRef(false);

  const append = useCallback((key) => {
    if (key === 'del') {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (!key) return;
    setPin((p) => (p.length >= 6 ? p : p + key));
  }, []);

  const submitPin = useCallback(async (value) => {
    if (value.length !== 6 || submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    try {
      await restoreSystemposShell();
      const data = await login({ pin: value }, 'pin');
      message.success('Session serveur ouverte');
      if (data?.requires_shift_start) {
        navigate('/shift');
        return;
      }
      navigate('/');
    } catch (err) {
      message.error(err.response?.data?.message || 'Échec connexion PIN');
      setPin('');
      inputRef.current?.focus();
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  }, [login, navigate]);

  useEffect(() => {
    if (pin.length === 6) submitPin(pin);
  }, [pin, submitPin]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isSystemTerminalContext()) return undefined;

    let cancelled = false;
    (async () => {
      await restoreSystemposShell();
      if (!cancelled) {
        try {
          await refreshUser();
        } catch {
          /* shell may still be restored for PIN submit */
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshUser]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (loading) return;

      if (/^\d$/.test(e.key)) {
        e.preventDefault();
        append(e.key);
        return;
      }

      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        append('del');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [append, loading]);

  const handlePinInput = (e) => {
    const next = e.target.value.replace(/\D/g, '').slice(0, 6);
    setPin(next);
  };

  const handleLogoutSystem = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="auth-layout">
      <Card className="auth-card">
        <CardContent className="pt-6">
          <div className="auth-card__touch-row">
            <TouchModeToggle showLabel />
          </div>

          <h3 className="text-xl font-semibold">Entrez votre PIN</h3>
          <p className="text-sm text-muted-foreground">
            6 chiffres — pavé tactile ou clavier. Déconnectez-vous pour changer de serveur.
          </p>

          <div
            className="pin-display-wrap"
            data-touch-kb-skip="true"
            onClick={() => inputRef.current?.focus()}
            role="presentation"
          >
            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              autoFocus
              value={pin}
              onChange={handlePinInput}
              disabled={loading}
              className="pin-keyboard-input"
              aria-label="PIN à 6 chiffres"
              maxLength={6}
            />
            <div className="pin-dots" aria-hidden="true">
              {'•'.repeat(pin.length).padEnd(6, '○').slice(0, 6)}
            </div>
          </div>

          <div className="pin-pad">
            {KEYS.map((k, i) =>
              k === '' ? (
                <span key={i} />
              ) : (
                <Button
                  key={k}
                  size="lg"
                  onClick={() => append(k)}
                  disabled={loading}
                >
                  {k === 'del' ? <Delete className="size-5" /> : k}
                </Button>
              )
            )}
          </div>

          <Button
            type="button"
            variant="link"
            className="mt-4 w-full"
            onClick={handleLogoutSystem}
          >
            Quitter le terminal SystemPOS
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
