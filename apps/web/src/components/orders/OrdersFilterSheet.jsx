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
import { ORDER_STATUS_LABELS, orderStatusLabel } from '../../utils/orderStatusLabels';

const typeLabels = {
  dine_in: 'Sur place',
  takeaway: 'À emporter',
  delivery: 'Livraison',
};

export default function OrdersFilterSheet({
  open,
  onOpenChange,
  search,
  onSearchChange,
  dateFrom,
  dateTo,
  onFromChange,
  onToChange,
  statusFilter,
  onStatusFilterChange,
  typeFilter,
  onTypeFilterChange,
  onApply,
  onReset,
  loading,
  statusOptions,
}) {
  const statuses = statusOptions || Object.keys(ORDER_STATUS_LABELS);

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
      <MobileFilterField label="Recherche" htmlFor="orders-filter-search">
        <Input
          id="orders-filter-search"
          placeholder="N°, code jour, table, serveur…"
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
      <MobileFilterField label="Statut">
        <AppSelect
          allowClear
          placeholder="Tous les statuts"
          value={statusFilter}
          onChange={onStatusFilterChange}
          options={statuses.map((s) => ({
            value: s,
            label: orderStatusLabel(s),
          }))}
        />
      </MobileFilterField>
      <MobileFilterField label="Type">
        <AppSelect
          allowClear
          placeholder="Tous les types"
          value={typeFilter}
          onChange={onTypeFilterChange}
          options={Object.entries(typeLabels).map(([v, l]) => ({ value: v, label: l }))}
        />
      </MobileFilterField>
    </MobileFilterSheetShell>
  );
}
