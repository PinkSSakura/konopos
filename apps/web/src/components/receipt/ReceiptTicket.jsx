import React from 'react';
import '../../styles/receipt.css';
import { formatDateTime } from '../../utils/dateFilters';

function fmt(amount, currency = 'MAD') {
  if (amount == null) return '—';
  return `${Number(amount).toFixed(2)} ${currency}`;
}

const METHOD_LABELS = {
  cash: 'Espèces',
  card: 'Carte',
  credit: 'Crédit client',
  debit: 'Débit compte',
};

const STATUS_LABELS = {
  paid: 'Payé',
  partial: 'Partiel',
  unpaid: 'À régler',
};

export default function ReceiptTicket({ receipt }) {
  if (!receipt) return null;

  const { establishment, order, items, tax, payment } = receipt;
  const currency = establishment?.currency || 'MAD';
  const date = payment?.processed_at || order?.paid_at || order?.created_at;
  const statusKey = receipt.is_paid ? 'paid' : order.payment_status || 'unpaid';
  const statusLabel = STATUS_LABELS[statusKey] || statusKey;
  const paymentLabel = payment ? (METHOD_LABELS[payment.method] || payment.method) : '—';

  return (
    <div className="receipt-ticket">
      <header className="receipt-ticket__header">
        {establishment?.logo && (
          <img src={establishment.logo} alt="" className="receipt-ticket__logo" />
        )}
        {establishment?.name && <p className="receipt-ticket__name">{establishment.name}</p>}
        {establishment?.address && <p className="receipt-ticket__address">{establishment.address}</p>}
      </header>

      <p className="receipt-ticket__doc-title">TICKET DE CAISSE</p>

      <div className="receipt-ticket__info">
        <p>Ticket n° {order.receipt_number || order.order_number}</p>
        <p>Date : {formatDateTime(date)}</p>
        <p>Statut : {statusLabel}</p>
        {order.daily_code && <p className="receipt-ticket__daily-code">Code du jour : {order.daily_code}</p>}
        {order.type_label && <p>Type : {order.type_label}</p>}
        {order.table && <p>Table : {order.table}</p>}
        {order.waiter && <p>Serveur : {order.waiter}</p>}
      </div>

      <table className="receipt-ticket__table">
        <thead>
          <tr>
            <th>Article</th>
            <th>Qté</th>
            <th>Prix</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <React.Fragment key={item._id}>
              <tr>
                <td className="receipt-ticket__col-article">{item.name}</td>
                <td>{item.quantity}</td>
                <td>{fmt(item.unit_price, currency)}</td>
                <td>{fmt(item.line_total, currency)}</td>
              </tr>
              {item.extras?.length > 0 && (
                <tr className="receipt-ticket__sub-row">
                  <td colSpan={4}>+ {item.extras.join(', ')}</td>
                </tr>
              )}
              {item.notes && (
                <tr className="receipt-ticket__sub-row">
                  <td colSpan={4}>Note : {item.notes}</td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>

      {receipt.amounts && (receipt.amounts.discount > 0 || receipt.amounts.service_charge > 0) && (
        <div className="receipt-ticket__adjustments">
          {receipt.amounts.discount > 0 && (
            <div className="receipt-ticket__summary-row">
              <span>Remise</span>
              <span>-{fmt(receipt.amounts.discount, currency)}</span>
            </div>
          )}
          {receipt.amounts.service_charge > 0 && (
            <div className="receipt-ticket__summary-row">
              <span>Frais de service</span>
              <span>+{fmt(receipt.amounts.service_charge, currency)}</span>
            </div>
          )}
        </div>
      )}

      <hr className="receipt-ticket__rule" />

      <div className="receipt-ticket__summary">
        <div className="receipt-ticket__summary-row">
          <span>Total HT</span>
          <span>{fmt(tax.total_ht, currency)}</span>
        </div>
        <div className="receipt-ticket__summary-row">
          <span>TVA ({tax.tax_rate}%)</span>
          <span>{fmt(tax.tax_amount, currency)}</span>
        </div>
        <div className="receipt-ticket__summary-row receipt-ticket__summary-row--grand">
          <span>TOTAL TTC</span>
          <span>{fmt(tax.total_ttc, currency)}</span>
        </div>
      </div>

      <div className="receipt-ticket__payment-grid">
        <div className="receipt-ticket__pay-cell">
          <span className="receipt-ticket__pay-label">Statut</span>
          <span className="receipt-ticket__pay-value">{statusLabel}</span>
        </div>
        <div className="receipt-ticket__pay-cell">
          <span className="receipt-ticket__pay-label">Paiement</span>
          <span className="receipt-ticket__pay-value">{paymentLabel}</span>
        </div>
        <div className="receipt-ticket__pay-cell">
          <span className="receipt-ticket__pay-label">Reçu</span>
          <span className="receipt-ticket__pay-value">
            {payment?.amount_tendered != null ? fmt(payment.amount_tendered, currency) : '—'}
          </span>
        </div>
        <div className="receipt-ticket__pay-cell">
          <span className="receipt-ticket__pay-label">Monnaie</span>
          <span className="receipt-ticket__pay-value">
            {payment?.change_due != null ? fmt(payment.change_due, currency) : '—'}
          </span>
        </div>
      </div>

      {receipt.payments_summary?.length > 1 && (
        <div className="receipt-ticket__split-payments">
          <p className="receipt-ticket__split-title">Paiements multiples</p>
          {receipt.payments_summary.map((p, i) => (
            <div key={i} className="receipt-ticket__summary-row">
              <span>{METHOD_LABELS[p.method] || p.method}</span>
              <span>{fmt(p.amount, currency)}</span>
            </div>
          ))}
        </div>
      )}

      {payment?.processed_by?.fullname && (
        <p className="receipt-ticket__cashier">Caissier : {payment.processed_by.fullname}</p>
      )}

      <footer className="receipt-ticket__footer">
        <p>Merci de votre visite !</p>
        <p className="receipt-ticket__footer-ref">{order.order_number}</p>
        {(establishment?.website || establishment?.phone || establishment?.email) && (
          <div className="receipt-ticket__contact">
            {establishment.website && <p>{establishment.website}</p>}
            {establishment.phone && <p>{establishment.phone}</p>}
            {establishment.email && <p>{establishment.email}</p>}
          </div>
        )}
      </footer>

      {(establishment?.ice || establishment?.patente || establishment?.identifiant_fiscal || establishment?.rc) && (
        <div className="receipt-ticket__legal">
          {establishment.patente && <div>Patente : {establishment.patente}</div>}
          {establishment.ice && <div>ICE : {establishment.ice}</div>}
          {establishment.identifiant_fiscal && <div>IF : {establishment.identifiant_fiscal}</div>}
          {establishment.rc && <div>RC : {establishment.rc}</div>}
        </div>
      )}

      <div className="receipt-ticket__spacer" aria-hidden="true" />
    </div>
  );
}
