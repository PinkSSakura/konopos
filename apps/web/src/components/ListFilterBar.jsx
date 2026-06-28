import React from 'react';
import { Search, RotateCcw } from 'lucide-react';
import { todayDateString } from '../utils/dateFilters';
import DateRangePicker from './DateRangePicker';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function ListFilterBar({
  search,
  onSearchChange,
  searchPlaceholder = 'Rechercher…',
  from,
  to,
  onFromChange,
  onToChange,
  onApply,
  onReset,
  loading,
  extra,
}) {
  const handleReset = () => {
    const t = todayDateString();
    onSearchChange?.('');
    onFromChange?.(t);
    onToChange?.(t);
    onReset?.({ search: '', from: t, to: t });
  };

  return (
    <Card className="mb-4 list-filter-bar-touch">
      <CardContent className="list-filter-bar-fields flex w-full flex-wrap items-center gap-3">
        <div className="list-filter-bar-search-wrap relative min-w-[200px] flex-1 max-w-[280px]">
          <Search className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onApply?.();
            }}
            className="list-filter-bar-search w-full pl-8"
          />
        </div>
        <DateRangePicker
          from={from}
          to={to}
          onChange={({ from: nextFrom, to: nextTo }) => {
            onFromChange?.(nextFrom);
            onToChange?.(nextTo);
          }}
          className="list-filter-bar-date shrink-0"
        />
        {extra ? <div className="list-filter-bar-extra shrink-0">{extra}</div> : null}
        <div className="list-filter-bar-actions ml-auto flex shrink-0 flex-wrap gap-2">
          <Button type="button" onClick={onApply} disabled={loading}>
            Filtrer
          </Button>
          <Button type="button" variant="outline" onClick={handleReset}>
            <RotateCcw data-icon="inline-start" />
            Aujourd&apos;hui
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
