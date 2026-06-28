import React from 'react';
import { createRoot } from 'react-dom/client';
import { message } from '@/lib/toast';
import client from '../api/client';
import ReceiptTicket from '../components/receipt/ReceiptTicket';
import receiptCss from '../styles/receipt.css?inline';

const RECEIPT_PRINT_CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; background: #fff; }
  ${receiptCss}
  @media print {
    @page { size: 80mm auto; margin: 0; }
    body { padding: 0; }
  }
`;

function buildReceiptHtml(title) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Ticket ${title}</title>
  <style>${RECEIPT_PRINT_CSS}</style>
</head>
<body><div id="receipt-root"></div></body>
</html>`;
}

function cleanupPrintFrame(iframe, root) {
  try {
    root?.unmount();
  } catch {
    /* already unmounted */
  }
  iframe?.remove();
}

/**
 * Render receipt in a hidden iframe and open the browser print dialog (80 mm).
 */
export function printReceipt(receipt, { autoPrint = true } = {}) {
  if (!receipt) {
    message.warning('Aucun ticket à imprimer');
    return null;
  }

  const title = receipt.order?.order_number || receipt.payment?.receipt_number || 'Ticket';
  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', `Ticket ${title}`);
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(iframe);

  const printWindow = iframe.contentWindow;
  const doc = printWindow.document;
  doc.open();
  doc.write(buildReceiptHtml(title));
  doc.close();

  const container = doc.getElementById('receipt-root');
  const root = createRoot(container);
  root.render(<ReceiptTicket receipt={receipt} />);

  const triggerPrint = () => {
    if (!autoPrint) return;
    printWindow.focus();
    printWindow.print();
  };

  const scheduleCleanup = () => {
    printWindow.addEventListener('afterprint', () => cleanupPrintFrame(iframe, root), { once: true });
    window.setTimeout(() => {
      if (iframe.parentNode) cleanupPrintFrame(iframe, root);
    }, 120_000);
  };

  scheduleCleanup();
  window.setTimeout(triggerPrint, 400);

  return iframe;
}

/** Load receipt from API and open the 80 mm print dialog (no in-app preview). */
export async function fetchAndPrintReceipt(orderId, paymentId = null, { thermal = true } = {}) {
  const params = paymentId ? { payment_id: paymentId } : undefined;
  const res = await client.get(`/orders/${orderId}/receipt`, { params });
  const receipt = res.data.data;
  printReceipt(receipt);
  if (thermal) {
    try {
      await client.post(`/orders/${orderId}/print-caisse`, {
        payment_id: receipt?.payment?._id || paymentId,
      });
    } catch {
      /* thermal printer optional */
    }
  }
  return receipt;
}
