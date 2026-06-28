import React, { useCallback, useEffect, useRef } from 'react';
import { Delete } from 'lucide-react';
import { Button } from '@/components/ui/button';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

export default function PinKeypad({
  pin,
  onPinChange,
  onSubmit,
  loading = false,
  autoSubmit = true,
  className = '',
}) {
  const inputRef = useRef(null);

  const append = useCallback((key) => {
    if (key === 'del') {
      onPinChange(pin.slice(0, -1));
      return;
    }
    if (!key) return;
    onPinChange(pin.length >= 6 ? pin : pin + key);
  }, [onPinChange, pin]);

  useEffect(() => {
    if (!autoSubmit || pin.length !== 6 || loading) return;
    onSubmit?.(pin);
  }, [autoSubmit, pin, loading, onSubmit]);

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
    onPinChange(e.target.value.replace(/\D/g, '').slice(0, 6));
  };

  return (
    <div className={className}>
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
              type="button"
              size="lg"
              onClick={() => append(k)}
              disabled={loading}
            >
              {k === 'del' ? <Delete className="size-5" /> : k}
            </Button>
          ))}
      </div>
    </div>
  );
}
