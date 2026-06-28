import React from 'react';
import { Search, RotateCcw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function TableListFilterBar({
  search = '',
  onSearchChange,
  searchPlaceholder = 'Rechercher…',
  onApply,
  onReset,
  loading = false,
  extra,
}) {
  const handleReset = () => {
    onSearchChange?.('');
    onReset?.();
  };

  return (
    <Card className="mb-4 list-filter-bar-touch">
      <CardContent className="list-filter-bar-fields flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="list-filter-bar-search-wrap relative max-w-full">
          <Search className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => onSearchChange?.(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onApply?.();
            }}
            className="list-filter-bar-search w-full pl-8"
          />
        </div>
        {extra ? <div className="list-filter-bar-extra">{extra}</div> : null}
        <div className="list-filter-bar-actions flex w-full flex-wrap gap-2 sm:w-auto">
          <Button type="button" className="flex-1 sm:flex-none" onClick={onApply} disabled={loading}>
            Filtrer
          </Button>
          <Button type="button" variant="outline" className="flex-1 sm:flex-none" onClick={handleReset}>
            <RotateCcw data-icon="inline-start" />
            Réinitialiser
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
