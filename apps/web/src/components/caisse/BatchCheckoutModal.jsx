import React, { useEffect, useMemo, useState } from 'react';
import { Banknote, CreditCard, Loader2, User, Wallet } from 'lucide-react';
import { message } from '@/lib/toast';
import client from '../../api/client';
import AppSelect from '@/components/ui/AppSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const METHODS = [
  { value: 'cash', label: 'Espèces', icon: Banknote },
  { value: 'card', label: 'Carte', icon: CreditCard },
  { value: 'credit', label: 'Crédit', icon: User },
  { value: 'debit', label: 'Débit compte', icon: Wallet },
];

const QUICK_CASH = [50, 100, 200, 500];

export default function BatchCheckoutModal({
  open,
  onClose,
  rows,
  onSuccess,
}) {
  const [method, setMethod] = useState('cash');
  const [amountTendered, setAmountTendered] = useState('');
  const [customerId, setCustomerId] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const totalDue = useMemo(
    () => Math.round(rows.reduce((sum, row) => sum + Number(row.amounts?.balance_due || 0), 0) * 100) / 100,
    [rows],
  );

  useEffect(() => {
    if (!open) return;
    setMethod('cash');
    setAmountTendered(String(totalDue));
    setCustomerId(null);
    client.get('/customers').then((res) => setCustomers(res.data.data || [])).catch(() => {});
  }, [open, totalDue]);

  const customerOptions = customers.map((c) => ({
    value: c._id,
    label: c.name,
  }));

  const canSubmit = useMemo(() => {
    if (!rows.length || submitting) return false;
    if (['credit', 'debit'].includes(method) && !customerId) return false;
    if (method === 'cash') {
      const tendered = Number(amountTendered);
      return Number.isFinite(tendered) && tendered >= totalDue - 0.001;
    }
    return true;
  }, [rows.length, submitting, method, customerId, amountTendered, totalDue]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const res = await client.post('/payments/batch-checkout', {
        order_ids: rows.map((row) => row.order._id),
        method,
        amount_tendered: method === 'cash' ? Number(amountTendered) : undefined,
        customer_id: customerId || undefined,
      });
      const { succeeded, failed } = res.data.data || {};
      if (succeeded?.length) {
        message.success(res.data.message || `${succeeded.length} commande(s) encaissée(s).`);
      }
      if (failed?.length) {
        message.warning(`${failed.length} commande(s) ignorée(s).`);
      }
      onSuccess?.(res.data.data);
      onClose?.();
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur encaissement groupé');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose?.(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Encaisser la sélection (
            {rows.length}
            )
          </DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total dû</span>
              <span className="font-semibold tabular-nums">
                {totalDue.toFixed(2)}
                {' '}
                MAD
              </span>
            </div>
            <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs text-muted-foreground">
              {rows.map((row) => (
                <li key={row.order._id}>
                  {row.order.order_number}
                  {' '}
                  —
                  {Number(row.amounts?.balance_due || 0).toFixed(2)}
                  {' '}
                  MAD
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <Label>Mode de paiement</Label>
            <div className="grid grid-cols-2 gap-2">
              {METHODS.map(({ value, label, icon: Icon }) => (
                <Button
                  key={value}
                  type="button"
                  variant={method === value ? 'default' : 'outline'}
                  className="justify-start"
                  onClick={() => setMethod(value)}
                >
                  <Icon className="mr-2 size-4" />
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {method === 'cash' && (
            <div className="space-y-2">
              <Label>Montant reçu</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amountTendered}
                onChange={(e) => setAmountTendered(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                {QUICK_CASH.map((value) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setAmountTendered(String(value))}
                  >
                    {value}
                  </Button>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setAmountTendered(String(totalDue))}
                >
                  Exact
                </Button>
              </div>
            </div>
          )}

          {['credit', 'debit'].includes(method) && (
            <div className="space-y-2">
              <Label>Client régulier</Label>
              <AppSelect
                value={customerId}
                onChange={setCustomerId}
                options={customerOptions}
                placeholder="Choisir un client…"
              />
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Chaque commande sera réglée et imprimée sur son propre ticket (si imprimante caisse active).
          </p>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Encaisser
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
