import React from 'react';
import { Button } from '@/components/ui/button';
import AppSelect from '@/components/ui/AppSelect';
import { Input } from '@/components/ui/input';
import MobileFilterSheetShell, { MobileFilterField } from '../mobile/MobileFilterSheetShell';

const SECTION_OPTIONS = [
  { value: 'ready', label: 'Prêt à servir' },
  { value: 'pending', label: 'En attente' },
  { value: 'preparing', label: 'En préparation' },
];

export default function ServiceFilterSheet({
  open,
  onOpenChange,
  search,
  onSearchChange,
  sectionFilter,
  onSectionFilterChange,
  showSectionFilter,
  onReset,
}) {
  return (
    <MobileFilterSheetShell
      open={open}
      onOpenChange={onOpenChange}
      maxHeight="70vh"
      footer={(
        <>
          <Button variant="outline" onClick={onReset}>
            Réinitialiser
          </Button>
          <Button onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </>
      )}
    >
      <MobileFilterField label="Recherche" htmlFor="service-filter-search">
        <Input
          id="service-filter-search"
          placeholder="Article, table, n° commande…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </MobileFilterField>
      {showSectionFilter && (
        <MobileFilterField label="Section">
          <AppSelect
            allowClear
            placeholder="Toutes les sections"
            value={sectionFilter}
            onChange={onSectionFilterChange}
            options={SECTION_OPTIONS}
          />
        </MobileFilterField>
      )}
    </MobileFilterSheetShell>
  );
}
