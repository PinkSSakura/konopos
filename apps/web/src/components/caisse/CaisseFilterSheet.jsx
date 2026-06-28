import React from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AppSelect from '@/components/ui/AppSelect';
import { Input } from '@/components/ui/input';
import MobileFilterSheetShell, { MobileFilterField } from '../mobile/MobileFilterSheetShell';

const TYPE_LABELS = { dine_in: 'Sur place', takeaway: 'À emporter', delivery: 'Livraison' };

export default function CaisseFilterSheet({
  open,
  onOpenChange,
  search,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  tab,
  onTabChange,
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
      <MobileFilterField label="Recherche" htmlFor="caisse-filter-search">
        <Input
          id="caisse-filter-search"
          placeholder="N° commande, code jour, table, serveur…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </MobileFilterField>
      <MobileFilterField label="Type de commande">
        <AppSelect
          allowClear
          placeholder="Tous les types"
          value={typeFilter || (tab === 'all' ? null : tab)}
          onChange={(v) => {
            onTypeFilterChange(v);
            onTabChange(v || 'all');
          }}
          options={Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }))}
        />
      </MobileFilterField>
    </MobileFilterSheetShell>
  );
}
