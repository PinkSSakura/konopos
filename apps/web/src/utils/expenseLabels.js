export const EXPENSE_CATEGORY_LABELS = {
  bills: 'Factures & charges',
  merchandise: 'Marchandise & approvisionnement',
  salary: 'Salaires & personnel',
  maintenance: 'Entretien & réparations',
  marketing: 'Marketing & publicité',
  tax: 'Impôts & taxes',
  other: 'Autre',
};

export const EXPENSE_CATEGORY_OPTIONS = Object.entries(EXPENSE_CATEGORY_LABELS).map(
  ([value, label]) => ({ value, label })
);

export const EXPENSE_PAYMENT_METHOD_LABELS = {
  cash: 'Espèces',
  card: 'Carte',
  transfer: 'Virement',
  check: 'Chèque',
  other: 'Autre',
};

export const EXPENSE_PAYMENT_METHOD_OPTIONS = Object.entries(EXPENSE_PAYMENT_METHOD_LABELS).map(
  ([value, label]) => ({ value, label })
);
