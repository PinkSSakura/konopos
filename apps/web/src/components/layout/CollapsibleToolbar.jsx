import React, { useState } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import '../../styles/collapsible-toolbar.css';

export default function CollapsibleToolbar({
  title,
  summary,
  defaultOpen = false,
  className,
  children,
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cn('collapsible-toolbar rounded-lg border bg-muted/25', className)}>
      <button
        type="button"
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left sm:px-4"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <SlidersHorizontal className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          {title ? <p className="text-sm font-medium leading-tight">{title}</p> : null}
          {summary ? (
            <p className="truncate text-xs text-muted-foreground">{summary}</p>
          ) : null}
        </div>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="collapsible-toolbar__panel border-t border-border/60 px-3 py-3 sm:px-4">
          {children}
        </div>
      ) : null}
    </div>
  );
}
