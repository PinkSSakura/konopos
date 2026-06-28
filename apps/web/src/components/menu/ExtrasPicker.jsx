import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

export default function ExtrasPicker({
  extras = [],
  selectedIds = [],
  onToggle,
  emptyLabel = 'Aucun extra actif.',
  className,
  maxHeightClass = 'max-h-56',
}) {
  if (!extras.length) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-1 overflow-y-auto overscroll-contain rounded-md border bg-muted/20 p-2',
        maxHeightClass,
        className,
      )}
    >
      {extras.map((extra) => (
        <label
          key={extra._id}
          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted/50"
        >
          <Checkbox
            checked={selectedIds.includes(extra._id)}
            onCheckedChange={(checked) => onToggle(extra._id, Boolean(checked))}
          />
          <span className="min-w-0 flex-1">{extra.name}</span>
          {extra.price ? (
            <span className="shrink-0 text-muted-foreground">+{Number(extra.price).toFixed(2)} MAD</span>
          ) : null}
        </label>
      ))}
    </div>
  );
}
