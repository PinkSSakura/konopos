import React, { useEffect, useState } from 'react';
import client from '../../api/client';
import { useEstablishment } from '../../context/EstablishmentContext';
import { ESTABLISHMENT_CAP } from '../../utils/establishmentCapabilities';
import { message } from '@/lib/toast';
import AppModal from '@/components/ui/AppModal';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const PIN_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

export default function PosReplaceReasonModal({
  open,
  order,
  replaceItem,
  replacementLine,
  roleKey,
  onClose,
  onSuccess,
}) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [needsPin, setNeedsPin] = useState(false);
  const [pin, setPin] = useState('');
  const { hasCapability } = useEstablishment();

  useEffect(() => {
    if (!open) return;
    setReason('');
    setPin('');
    setSubmitting(false);

    if (roleKey === 'waiter') {
      setNeedsPin(!hasCapability(ESTABLISHMENT_CAP.WAITER_CANCEL_ORDER));
    } else {
      setNeedsPin(false);
    }
  }, [open, roleKey, hasCapability]);

  const submit = async () => {
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      message.warning('Indiquez le motif');
      return;
    }
    if (needsPin && pin.length !== 6) {
      message.warning('PIN manager requis (6 chiffres)');
      return;
    }

    setSubmitting(true);
    try {
      const productModifiers = (replacementLine.modifiers || []).filter((m) => m.group_name !== 'Extra');
      const extras = (replacementLine.modifiers || []).filter((m) => m.group_name === 'Extra');

      await client.post(`/orders/${order._id}/items/${replaceItem._id}/replace`, {
        reason: trimmedReason,
        menu_item_id: replacementLine.menuItemId,
        quantity: replacementLine.quantity,
        variant_id: replacementLine.variant?.variant_id,
        modifiers: productModifiers.map((m) => ({ modifier_id: m.modifier_id })),
        extras: extras.map((m) => ({ extra_id: m.modifier_id })),
        notes: replacementLine.notes,
        send_to_kitchen: false,
        ...(needsPin ? { approver_pin: pin } : {}),
      });

      message.success('Article remplacé — validez pour envoyer en cuisine / bar');
      onSuccess?.();
      onClose();
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppModal
      open={open}
      title={`Confirmer le remplacement de ${replaceItem?.name}`}
      onCancel={onClose}
      onOk={submit}
      okText="Remplacer"
      confirmLoading={submitting}
    >
      {replacementLine && (
        <p style={{ marginBottom: 16 }}>
          Nouvel article : <strong>{replacementLine.name}</strong>
          {replacementLine.variant?.name ? ` (${replacementLine.variant.name})` : ''}
        </p>
      )}
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="replace-reason">Motif</Label>
          <Textarea
            id="replace-reason"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex. mauvais plat servi, client a changé d'avis…"
          />
        </div>

        {needsPin && (
          <div className="grid gap-2">
            <Label>PIN manager (validation)</Label>
            <div style={{ letterSpacing: 12, fontSize: 22, textAlign: 'center', marginBottom: 8 }}>
              {'•'.repeat(pin.length).padEnd(6, '○').slice(0, 6)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {PIN_KEYS.map((key) => (
                <button
                  key={key || 'empty'}
                  type="button"
                  disabled={!key}
                  onClick={() => {
                    if (key === 'del') setPin((p) => p.slice(0, -1));
                    else if (key && pin.length < 6) setPin((p) => p + key);
                  }}
                  style={{ height: 44, fontSize: 18 }}
                >
                  {key === 'del' ? '⌫' : key}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppModal>
  );
}
