import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Banknote, CreditCard, User, Wallet,
} from 'lucide-react';
import { InlineLoading } from '../loading/LoadingStates';
import client from '../../api/client';
import ReceiptTicket from './ReceiptTicket';
import TouchNumPad from './TouchNumPad';
import { fetchAndPrintReceipt } from '../../utils/printReceipt';
import { useEstablishment } from '../../context/EstablishmentContext';
import { useAuth } from '../../context/AuthContext';
import { handleDirectPinSessionEnd } from '../../utils/pinSession';
import { hasEstablishmentCapability, ESTABLISHMENT_CAP } from '../../utils/establishmentCapabilities';
import { message } from '@/lib/toast';
import AppSelect from '@/components/ui/AppSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import '../../styles/receipt.css';
import '../../styles/checkout-touch.css';

const METHODS = [
  { value: 'cash', label: 'Espèces', icon: <Banknote className="size-5" /> },
  { value: 'card', label: 'Carte', icon: <CreditCard className="size-5" /> },
  { value: 'credit', label: 'Crédit', icon: <User className="size-5" /> },
  { value: 'debit', label: 'Débit compte', icon: <Wallet className="size-5" /> },
];

const QUICK_CASH = [50, 100, 200, 500];

export default function CheckoutForm({
  orderId,
  active = true,
  onClose,
  onSuccess,
  layout = 'modal',
}) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [servicePercent, setServicePercent] = useState(0);
  const [serviceAmount, setServiceAmount] = useState(0);
  const [customerId, setCustomerId] = useState(null);
  const [method, setMethod] = useState('cash');
  const [amount, setAmount] = useState(null);
  const [amountTendered, setAmountTendered] = useState('');
  const [partialAmountActive, setPartialAmountActive] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState('');
  const { capabilities, logoutPinSession, user } = useAuth();
  const { establishment } = useEstablishment();
  const autoPrintOnPayment = hasEstablishmentCapability(
    capabilities,
    ESTABLISHMENT_CAP.CAISSE_AUTO_PRINT_PAYMENT,
  );

  const loadReceipt = useCallback(() => {
    if (!orderId) return;
    setLoading(true);
    client
      .get(`/orders/${orderId}/receipt`)
      .then((res) => {
        const data = res.data.data;
        setReceipt(data);
        setCustomerId(data.customer?._id || null);
        const due = data.amounts?.balance_due ?? data.tax?.total_ttc ?? 0;
        setAmount(due);
        setAmountTendered(String(due));
        setPartialAmountActive(false);
        setDiscountPercent(data.amounts?.discount_percent || 0);
        setDiscountAmount(data.amounts?.discount || 0);
        setServicePercent(data.amounts?.service_charge_percent || 0);
        setServiceAmount(data.amounts?.service_charge || 0);
        setMethod('cash');
      })
      .catch((err) => {
        message.error(err.response?.data?.message || 'Impossible de charger');
        onClose?.();
      })
      .finally(() => setLoading(false));
  }, [orderId, onClose]);

  useEffect(() => {
    if (!active || !orderId) {
      setReceipt(null);
      return;
    }
    loadReceipt();
    client.get('/customers').then((res) => setCustomers(res.data.data)).catch(() => {});
  }, [active, orderId, loadReceipt]);

  const previewTotals = useCallback(() => {
    if (!receipt?.amounts) return { balance_due: 0, total_due: 0 };
    const sub = receipt.amounts.subtotal;
    let disc = discountAmount;
    if (discountPercent > 0) disc = Math.round(sub * (discountPercent / 100) * 100) / 100;
    const after = sub - disc;
    let svc = serviceAmount;
    if (servicePercent > 0) svc = Math.round(after * (servicePercent / 100) * 100) / 100;
    const total = Math.round((after + svc) * 100) / 100;
    const paid = receipt.amounts.amount_paid || 0;
    return { total_due: total, balance_due: Math.max(0, total - paid), subtotal: sub };
  }, [receipt, discountPercent, discountAmount, servicePercent, serviceAmount]);

  const totals = useMemo(() => previewTotals(), [previewTotals]);
  const isComplimentary = totals.balance_due <= 0.001;
  const payAmount = partialAmountActive
    ? (Number(amount) || totals.balance_due)
    : totals.balance_due;
  const tendered = parseFloat(amountTendered) || 0;
  const changeDue = method === 'cash' ? Math.max(0, Math.round((tendered - payAmount) * 100) / 100) : 0;

  useEffect(() => {
    if (!receipt || partialAmountActive) return;
    setAmount(totals.balance_due);
    if (method === 'cash') {
      setAmountTendered(String(totals.balance_due));
    }
  }, [totals.balance_due, receipt, partialAmountActive, method]);

  const setMethodAndDefaults = (m) => {
    setMethod(m);
    setPartialAmountActive(false);
    setAmount(totals.balance_due);
    if (m === 'cash') {
      setAmountTendered(String(totals.balance_due));
    }
  };

  const applyQuickCash = (value) => {
    setPartialAmountActive(false);
    const v = typeof value === 'number' ? value : totals.balance_due;
    setAmount(v);
    setAmountTendered(String(v));
  };

  const resetAdjustmentsForSync = () => {
    setPartialAmountActive(false);
  };

  const handleCheckout = async () => {
    if (!orderId || submitting) return;

    const pay = isComplimentary ? 0 : payAmount;
    const payments = [{
      method,
      amount: pay,
      amount_tendered: method === 'cash' ? (isComplimentary ? 0 : tendered) : undefined,
    }];

    const needsCustomer = !isComplimentary && (
      ['credit', 'debit'].includes(method) || pay < totals.balance_due - 0.01
    );
    if (needsCustomer && !customerId) {
      message.error('Sélectionnez un client régulier.');
      return;
    }

    if (!isComplimentary && method === 'cash' && tendered < pay - 0.001) {
      message.error('Montant reçu insuffisant.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await client.post(`/orders/${orderId}/checkout`, {
        customer_id: customerId,
        discount_percent: discountPercent,
        discount_amount: discountAmount,
        service_charge_percent: servicePercent,
        service_charge_amount: serviceAmount,
        payments,
      });
      setReceipt(res.data.data.receipt);
      message.success(
        isComplimentary
          ? 'Commande clôturée (offert)'
          : res.data.data.fully_paid
            ? 'Commande encaissée'
            : 'Paiement enregistré',
      );
      onSuccess?.(res.data.data);
      if (res.data.data.fully_paid) {
        if (await handleDirectPinSessionEnd(
          { logoutPinSession, user },
          { toastMessage: 'Paiement enregistré — session terminée' },
        )) {
          return;
        }
        if (autoPrintOnPayment) {
          const paymentId = res.data.data.receipt?.payment?._id;
          const serverPrintsThermal = Boolean(
            establishment?.caisse_printer?.enabled
            && establishment?.caisse_printer?.auto_print_on_payment !== false,
          );
          if (!serverPrintsThermal) {
            await fetchAndPrintReceipt(orderId, paymentId, { thermal: false });
          }
        }
        onClose?.();
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Erreur encaissement');
    } finally {
      setSubmitting(false);
    }
  };

  const canCheckout = receipt && !receipt.is_paid;
  const canPay = canCheckout && (
    isComplimentary || method !== 'cash' || tendered >= payAmount - 0.001
  );

  const customerOptions = customers.map((c) => {
    const phonePart = c.phone ? ` (${c.phone})` : '';
    const balance = (c.balance ?? 0).toFixed(2);
    return {
      value: c._id,
      label: `${c.name}${phonePart} — ${balance} MAD`,
    };
  });

  const partialCustomerOptions = customers.map((c) => ({
    value: c._id,
    label: c.name,
  }));

  if (loading) {
    return <InlineLoading />;
  }

  const footer = (
    <div className={layout === 'page' ? 'checkout-page-footer' : 'checkout-touch-footer sm:justify-end flex flex-wrap gap-2 justify-end'}>
      <Button type="button" size="lg" variant="outline" onClick={onClose}>
        Fermer
      </Button>
      {canCheckout && (
        <Button
          type="button"
          size="lg"
          disabled={!canPay || submitting}
          onClick={handleCheckout}
        >
          {submitting
            ? (isComplimentary ? 'Clôture…' : 'Encaissement…')
            : isComplimentary
              ? 'Clôturer (offert)'
              : payAmount < totals.balance_due - 0.01
                ? 'Paiement partiel'
                : 'Encaisser'}
        </Button>
      )}
    </div>
  );

  return (
    <>
      {canCheckout && (
        <div className="checkout-touch-layout">
          <div className="checkout-touch-main">
            <div className="checkout-touch-hero">
              <div className="checkout-touch-hero__label">À payer</div>
              <div className="checkout-touch-hero__amount">
                {totals.balance_due.toFixed(2)} <span style={{ fontSize: 22 }}>MAD</span>
              </div>
              {isComplimentary && (
                <div className="checkout-touch-hero__change">
                  Commande offerte — aucun encaissement requis
                </div>
              )}
              {!isComplimentary && method === 'cash' && tendered >= payAmount && (
                <div className="checkout-touch-hero__change">
                  Monnaie : {changeDue.toFixed(2)} MAD
                </div>
              )}
            </div>

            <p className="mb-2.5 block text-base font-medium">
              Mode de paiement
            </p>
            <div className="checkout-touch-methods">
              {METHODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  className={`checkout-touch-method${method === m.value ? ' checkout-touch-method--active' : ''}`}
                  onClick={() => setMethodAndDefaults(m.value)}
                >
                  <span className="checkout-touch-method__icon">{m.icon}</span>
                  {m.label}
                </button>
              ))}
            </div>

            {method === 'cash' && !isComplimentary && (
              <>
                <p className="mb-2 block text-[15px] font-medium">
                  Montant reçu
                </p>
                <div
                  className="checkout-touch-hero"
                  style={{ marginBottom: 12, padding: '12px 16px' }}
                >
                  <div className="checkout-touch-hero__amount" style={{ fontSize: 32 }}>
                    {amountTendered || '0'} <span style={{ fontSize: 18 }}>MAD</span>
                  </div>
                </div>
                <div className="checkout-touch-quick">
                  <Button type="button" onClick={() => applyQuickCash(totals.balance_due)}>
                    Exact
                  </Button>
                  {QUICK_CASH.map((bill) => (
                    <Button key={bill} type="button" variant="outline" onClick={() => applyQuickCash(bill)}>
                      {bill}
                    </Button>
                  ))}
                </div>
                <TouchNumPad
                  value={amountTendered}
                  onChange={setAmountTendered}
                />
              </>
            )}

            {['credit', 'debit'].includes(method) && (
              <div className="checkout-touch-field">
                <p className="text-[15px] font-medium">Client régulier (obligatoire)</p>
                <AppSelect
                  allowClear
                  className="mt-2"
                  placeholder="Choisir un client"
                  value={customerId}
                  onChange={setCustomerId}
                  options={customerOptions}
                />
              </div>
            )}

            <Accordion
              type="single"
              collapsible
              className="checkout-touch-collapse mt-4"
              value={showAdvanced}
              onValueChange={setShowAdvanced}
            >
              <AccordionItem value="adv">
                <AccordionTrigger>Remise, service, client, partiel</AccordionTrigger>
                <AccordionContent>
                  <div className="flex w-full flex-col gap-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-2">
                        <Label htmlFor="checkout-discount-percent">Remise %</Label>
                        <Input
                          id="checkout-discount-percent"
                          type="number"
                          min="0"
                          max="100"
                          value={discountPercent}
                          onChange={(e) => {
                            resetAdjustmentsForSync();
                            setDiscountPercent(Number(e.target.value) || 0);
                          }}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="checkout-discount-amount">Remise MAD</Label>
                        <Input
                          id="checkout-discount-amount"
                          type="number"
                          min="0"
                          step="0.01"
                          value={discountAmount}
                          onChange={(e) => {
                            resetAdjustmentsForSync();
                            setDiscountAmount(Number(e.target.value) || 0);
                          }}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="checkout-service-percent">Service %</Label>
                        <Input
                          id="checkout-service-percent"
                          type="number"
                          min="0"
                          value={servicePercent}
                          onChange={(e) => {
                            resetAdjustmentsForSync();
                            setServicePercent(Number(e.target.value) || 0);
                          }}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="checkout-service-amount">Service MAD</Label>
                        <Input
                          id="checkout-service-amount"
                          type="number"
                          min="0"
                          step="0.01"
                          value={serviceAmount}
                          onChange={(e) => {
                            resetAdjustmentsForSync();
                            setServiceAmount(Number(e.target.value) || 0);
                          }}
                        />
                      </div>
                    </div>

                    {!['credit', 'debit'].includes(method) && (
                      <div className="checkout-touch-field">
                        <Label htmlFor="checkout-customer">Client (paiement partiel)</Label>
                        <AppSelect
                          allowClear
                          className="mt-2"
                          value={customerId}
                          onChange={setCustomerId}
                          options={partialCustomerOptions}
                        />
                      </div>
                    )}

                    <div className="grid gap-2">
                      <Label htmlFor="checkout-amount">Montant à encaisser (partiel)</Label>
                      <Input
                        id="checkout-amount"
                        type="number"
                        min="0"
                        max={totals.balance_due}
                        step="0.01"
                        value={amount ?? ''}
                        onChange={(e) => {
                          setPartialAmountActive(true);
                          setAmount(e.target.value === '' ? null : Number(e.target.value));
                        }}
                      />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          <div className="checkout-touch-receipt-wrap">
            <p className="mb-2 block font-medium">Aperçu ticket</p>
            <div className="checkout-touch-receipt">
              <ReceiptTicket receipt={receipt} />
            </div>
          </div>
        </div>
      )}

      {footer}
    </>
  );
}
