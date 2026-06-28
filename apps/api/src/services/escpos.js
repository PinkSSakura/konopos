const { sendToTcpPrinter } = require('./printer-transport');

const ESC = 0x1b;
const GS = 0x1d;

function cmd(...bytes) {
  return Buffer.from(bytes);
}

function init() {
  return cmd(ESC, 0x40);
}

function align(mode) {
  return cmd(ESC, 0x61, mode === 'center' ? 1 : mode === 'right' ? 2 : 0);
}

function bold(on) {
  return cmd(ESC, 0x45, on ? 1 : 0);
}

function size(double) {
  if (double) return cmd(GS, 0x21, 0x11);
  return cmd(GS, 0x21, 0x00);
}

function cut() {
  return cmd(GS, 0x56, 0x00);
}

function lineFeed(n = 1) {
  return cmd(...Array(n).fill(0x0a));
}

function encodeText(text) {
  return Buffer.from(String(text || ''), 'latin1');
}

function textLine(text) {
  return Buffer.concat([encodeText(text), lineFeed()]);
}

function separator(char = '-', width = 48) {
  return textLine(char.repeat(width));
}

function truncate(text, max) {
  const s = String(text ?? '');
  if (s.length <= max) return s;
  return max <= 1 ? s.slice(0, max) : `${s.slice(0, max - 1)}.`;
}

function padColumns(cols, widths) {
  return cols
    .map((col, index) => {
      const width = widths[index];
      const value = truncate(col, width);
      return index === 0 ? value.padEnd(width, ' ') : value.padStart(width, ' ');
    })
    .join('');
}

function formatMoney(amount, currency) {
  if (amount == null) return '-';
  return `${Number(amount).toFixed(2)} ${currency}`;
}

function formatSummaryLine(label, value, width = 48) {
  const val = String(value);
  const space = Math.max(1, width - label.length - val.length);
  return `${label}${' '.repeat(space)}${val}`;
}

function formatPaymentPair(leftLabel, leftValue, rightLabel, rightValue, width = 48) {
  const half = Math.floor(width / 2);
  const left = truncate(`${leftLabel} ${leftValue}`, half).padEnd(half, ' ');
  const right = truncate(`${rightLabel} ${rightValue}`, width - half).padEnd(width - half, ' ');
  return left + right;
}

const CAISSE_COL_WIDTHS = [20, 4, 10, 14];
const CAISSE_WIDTH = CAISSE_COL_WIDTHS.reduce((sum, w) => sum + w, 0);

function buildTicketBuffer(lines) {
  const parts = [init(), align('center'), bold(true), size(true)];
  parts.push(textLine(lines.title || 'COMMANDE'));
  parts.push(size(false));
  parts.push(bold(false));
  parts.push(lineFeed());

  parts.push(align('left'));
  lines.meta.forEach((line) => parts.push(textLine(line)));
  parts.push(separator());

  lines.items.forEach((item) => {
    parts.push(bold(true));
    parts.push(textLine(`${item.quantity}x ${item.name}`));
    parts.push(bold(false));
    item.extras.forEach((extra) => parts.push(textLine(`  + ${extra}`)));
    if (item.notes) parts.push(textLine(`  >> ${item.notes}`));
    parts.push(lineFeed());
  });

  parts.push(separator());
  if (lines.footer) {
    parts.push(align('center'));
    parts.push(textLine(lines.footer));
  }
  parts.push(lineFeed(8));
  parts.push(cut());
  return Buffer.concat(parts);
}

function buildCaisseTicketBuffer(lines) {
  const currency = lines.currency || 'MAD';
  const statusLabel = lines.status_label || 'A regler';
  const payment = lines.payment;
  const paymentLabel = payment
    ? (payment.method_label || payment.method || '-')
    : '-';
  const receivedLabel = payment?.amount_tendered != null
    ? formatMoney(payment.amount_tendered, currency)
    : '-';
  const changeLabel = payment?.change_due != null
    ? formatMoney(payment.change_due, currency)
    : '-';

  const parts = [init(), align('center'), bold(true), size(true)];
  parts.push(textLine(lines.title || 'TICKET'));
  parts.push(size(false), bold(false), lineFeed());
  parts.push(textLine('TICKET DE CAISSE'));
  parts.push(lineFeed());

  if (lines.is_void) {
    parts.push(align('center'), bold(true), size(true));
    parts.push(textLine('*** X VOID ***'));
    parts.push(textLine('COMMANDE ANNULEE'));
    parts.push(textLine('IMPAYEE'));
    if (lines.void_reason) parts.push(textLine(lines.void_reason));
    parts.push(size(false), bold(false), lineFeed());
  }

  parts.push(align('left'));
  lines.meta.forEach((line) => parts.push(textLine(line)));
  parts.push(lineFeed());

  if (lines.daily_code) {
    parts.push(align('center'), bold(true), textLine('CODE DU JOUR'));
    parts.push(size(true), textLine(lines.daily_code));
    parts.push(size(false), bold(false), lineFeed());
  }

  parts.push(separator('-', CAISSE_WIDTH));
  parts.push(
    bold(true),
    textLine(padColumns(['Article', 'Qte', 'Prix', 'Total'], CAISSE_COL_WIDTHS)),
    bold(false)
  );
  parts.push(separator('-', CAISSE_WIDTH));

  lines.items.forEach((item) => {
    const unitPrice = item.unit_price != null ? Number(item.unit_price).toFixed(2) : '-';
    const lineTotal = item.line_total != null ? Number(item.line_total).toFixed(2) : '-';
    parts.push(
      textLine(
        padColumns(
          [item.name, String(item.quantity), unitPrice, lineTotal],
          CAISSE_COL_WIDTHS
        )
      )
    );
    (item.extras || []).forEach((extra) => parts.push(textLine(`  + ${extra}`)));
    if (item.notes) parts.push(textLine(`  >> ${item.notes}`));
  });

  parts.push(separator('-', CAISSE_WIDTH));
  if (lines.tax) {
    parts.push(textLine(formatSummaryLine('Total HT', formatMoney(lines.tax.total_ht, currency), CAISSE_WIDTH)));
    parts.push(
      textLine(
        formatSummaryLine(
          `TVA (${lines.tax.tax_rate}%)`,
          formatMoney(lines.tax.tax_amount, currency),
          CAISSE_WIDTH
        )
      )
    );
    parts.push(bold(true));
    parts.push(textLine(formatSummaryLine('TOTAL TTC', formatMoney(lines.tax.total_ttc, currency), CAISSE_WIDTH)));
    parts.push(bold(false));
  }

  parts.push(separator('=', CAISSE_WIDTH));
  parts.push(textLine(formatPaymentPair('Statut', statusLabel, 'Paiement', paymentLabel, CAISSE_WIDTH)));
  parts.push(textLine(formatPaymentPair('Recu', receivedLabel, 'Monnaie', changeLabel, CAISSE_WIDTH)));

  if (lines.footer) {
    parts.push(separator('-', CAISSE_WIDTH));
    parts.push(align('center'));
    String(lines.footer)
      .split('\n')
      .forEach((line) => parts.push(textLine(line)));
  }
  parts.push(lineFeed(8), cut());
  return Buffer.concat(parts);
}

function buildDailyCodeSlipBuffer(lines) {
  const parts = [init(), align('center'), bold(true)];
  parts.push(textLine(lines.title || 'TouDev'));
  parts.push(size(false), bold(false));
  parts.push(lineFeed(0.5));
  parts.push(bold(true), textLine(lines.subtitle || 'CODE DU JOUR'));
  parts.push(bold(false), lineFeed(0.5));
  parts.push(size(true), bold(true));
  parts.push(textLine(lines.code || '000000'));
  parts.push(size(false), bold(false), lineFeed());
  parts.push(separator());
  parts.push(align('left'));
  (lines.meta || []).forEach((line) => parts.push(textLine(line)));
  parts.push(separator());
  if (lines.footer) {
    parts.push(align('center'), textLine(lines.footer));
  }
  parts.push(lineFeed(8), cut());
  return Buffer.concat(parts);
}

const THERMAL_80MM_WIDTH = 48;
const WAITER_CLOSE_COL_WIDTHS = [14, 7, 7, 7, 7];

function buildWaiterDailyCloseBuffer(report, establishmentName) {
  const width = THERMAL_80MM_WIDTH;
  const dateLabel = report.date
    ? new Date(report.date).toLocaleDateString('fr-FR')
    : new Date().toLocaleDateString('fr-FR');
  const waiterName = report.waiter?.fullname || 'Serveur';
  const orders = report.orders || {};
  const items = report.items || {};
  const currency = report.currency || 'MAD';

  const parts = [init(), align('center'), bold(true), size(true)];
  parts.push(textLine('CLOTURE DU JOUR'));
  parts.push(size(false), bold(false));
  parts.push(textLine(establishmentName || 'TouDev'));
  parts.push(lineFeed());

  parts.push(align('left'));
  parts.push(textLine(`Serveur : ${waiterName}`));
  parts.push(textLine(`Date : ${dateLabel}`));
  parts.push(textLine(`Imprime : ${new Date().toLocaleString('fr-FR')}`));
  parts.push(separator('=', width));

  parts.push(bold(true), textLine('SYNTHESE FINANCIERE'), bold(false));
  parts.push(textLine(formatSummaryLine(
    'Encaisse (paye)',
    formatMoney(items.earned_amount, currency),
    width,
  )));
  parts.push(textLine(formatSummaryLine(
    'Impaye',
    formatMoney(items.unpaid_amount, currency),
    width,
  )));
  parts.push(textLine(formatSummaryLine(
    'Retours articles',
    formatMoney(items.returned_amount, currency),
    width,
  )));
  parts.push(textLine(formatSummaryLine(
    'Cmd annulees',
    formatMoney(orders.canceled_amount, currency),
    width,
  )));
  parts.push(textLine(formatSummaryLine(
    'Total perdu',
    formatMoney(items.lost_amount, currency),
    width,
  )));
  parts.push(textLine(formatSummaryLine(
    'CA commandes',
    formatMoney(orders.total_amount, currency),
    width,
  )));
  parts.push(separator('-', width));

  parts.push(bold(true), textLine('COMMANDES'), bold(false));
  parts.push(textLine(formatSummaryLine('Total envoyees', String(orders.sent ?? 0), width)));
  parts.push(textLine(formatSummaryLine('Annulees', String(orders.canceled ?? 0), width)));
  parts.push(textLine(formatSummaryLine('Impayees', String(orders.unpaid ?? 0), width)));
  parts.push(textLine(formatSummaryLine('Payees', String(orders.paid ?? 0), width)));
  parts.push(textLine(formatSummaryLine(
    'Montant total',
    formatMoney(orders.total_amount, currency),
    width,
  )));
  parts.push(separator('-', width));

  parts.push(bold(true), textLine('ARTICLES'), bold(false));
  parts.push(textLine(formatSummaryLine('Envoyes', String(items.sent_total ?? 0), width)));
  parts.push(textLine(formatSummaryLine('Payes', String(items.paid_total ?? 0), width)));
  parts.push(textLine(formatSummaryLine('Impayes', String(items.unpaid_total ?? 0), width)));
  parts.push(textLine(formatSummaryLine('Retournes', String(items.returned_total ?? 0), width)));
  parts.push(textLine(formatSummaryLine(
    'Montant articles',
    formatMoney(items.ordered_amount, currency),
    width,
  )));
  parts.push(textLine(formatSummaryLine(
    'Montant paye',
    formatMoney(items.paid_amount, currency),
    width,
  )));
  parts.push(textLine(formatSummaryLine(
    'Montant impaye',
    formatMoney(items.unpaid_amount, currency),
    width,
  )));
  parts.push(separator('-', width));

  const shiftRows = report.shifts || [];
  if (shiftRows.length) {
    parts.push(bold(true), textLine('SHIFTS / CAISSES'), bold(false));
    shiftRows.forEach((shift, index) => {
      const inLabel = shift.clock_in
        ? new Date(shift.clock_in).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        : '—';
      const outLabel = shift.clock_out
        ? new Date(shift.clock_out).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        : 'En cours';
      parts.push(textLine(`Shift ${index + 1} : ${inLabel} → ${outLabel}`));
      parts.push(textLine(formatSummaryLine(
        'Depart caisse',
        formatMoney(shift.opening_amount, currency),
        width,
      )));
      parts.push(textLine(formatSummaryLine(
        'Cloture caisse',
        formatMoney(shift.closing_amount, currency),
        width,
      )));
    });
    parts.push(separator('-', width));
  }

  parts.push(bold(true), textLine('DETAIL PAR ARTICLE'), bold(false));
  parts.push(textLine(padColumns(['Article', 'Cmd', 'Ret', 'Paye', 'Imp'], WAITER_CLOSE_COL_WIDTHS)));
  parts.push(separator('-', width));
  const detailRows = items.detail_by_name?.length
    ? items.detail_by_name
    : (items.sent_by_name || []).map((row) => ({
      name: row.name,
      ordered_qty: row.quantity,
      ordered_amount: row.amount,
      returned_qty: 0,
      returned_amount: 0,
      paid_qty: 0,
      paid_amount: 0,
      unpaid_qty: 0,
      unpaid_amount: 0,
    }));
  if (detailRows.length) {
    detailRows.forEach((row) => {
      const fmtCell = (qty, amount) => (
        qty ? `${qty}/${formatMoney(amount, currency)}` : '-'
      );
      parts.push(textLine(padColumns(
        [
          row.name,
          fmtCell(row.ordered_qty, row.ordered_amount),
          fmtCell(row.returned_qty, row.returned_amount),
          fmtCell(row.paid_qty, row.paid_amount),
          fmtCell(row.unpaid_qty, row.unpaid_amount),
        ],
        WAITER_CLOSE_COL_WIDTHS,
      )));
    });
  } else {
    parts.push(textLine('Aucun article'));
  }

  parts.push(separator('=', width));
  parts.push(align('center'), textLine('— Fin du rapport —'));
  parts.push(lineFeed(8), cut());
  return Buffer.concat(parts);
}

function sendToPrinter(host, port, data, timeoutMs = 8000) {
  return sendToTcpPrinter(host, port, data, timeoutMs);
}

module.exports = {
  buildTicketBuffer,
  buildCaisseTicketBuffer,
  buildDailyCodeSlipBuffer,
  buildWaiterDailyCloseBuffer,
  sendToPrinter,
  textLine,
  separator,
  init,
  align,
  bold,
  size,
  cut,
  lineFeed,
  THERMAL_80MM_WIDTH,
};
