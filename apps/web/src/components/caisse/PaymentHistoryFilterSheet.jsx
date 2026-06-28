import React from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AppSelect from '@/components/ui/AppSelect';
import DatePicker from '../DatePicker';
import { Input } from '@/components/ui/input';
import MobileFilterSheetShell, {
  MobileFilterField,
  MobileFilterRow,
} from '../mobile/MobileFilterSheetShell';

const METHOD_LABELS = {
  cash: 'Espèces',
  card: 'Carte',
  credit: 'Crédit client',
  debit: 'Débit compte',
};

export default function PaymentHistoryFilterSheet({
  open,
  onOpenChange,
  search,
  onSearchChange,
  dateFrom,
  dateTo,
  onFromChange,
  onToChange,
  method,
  onMethodChange,
  onApply,
  onReset,
  loading,
}) {
  return (
    <MobileFilterSheetShell
      open={open}
      onOpenChange={onOpenChange}
      footer={(
        <>
          <Button variant="outline" onClick={onReset}>
            Réinitialiser
          </Button>
          <Button
            disabled={loading}
            onClick={() => {
              onApply();
              onOpenChange(false);
            }}
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : 'Appliquer'}
          </Button>
        </>
      )}
    >
      <MobileFilterField label="Recherche" htmlFor="payments-filter-search">
        <Input
          id="payments-filter-search"
          placeholder="Ticket, commande, serveur…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </MobileFilterField>
      <MobileFilterRow>
        <MobileFilterField label="Du">
          <DatePicker className="w-full" value={dateFrom} onChange={onFromChange} />
        </MobileFilterField>
        <MobileFilterField label="Au">
          <DatePicker className="w-full" value={dateTo} onChange={onToChange} />
        </MobileFilterField>
      </MobileFilterRow>
      <MobileFilterField label="Mode de paiement">
        <AppSelect
          allowClear
          placeholder="Tous les modes"
          value={method}
          onChange={onMethodChange}
          options={Object.entries(METHOD_LABELS).map(([value, label]) => ({ value, label }))}
        />
      </MobileFilterField>
    </MobileFilterSheetShell>
  );
}
