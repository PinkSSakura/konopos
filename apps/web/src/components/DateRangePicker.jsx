import React, { useState } from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import useIsMobile from '../hooks/useIsMobile';

function toDate(value) {
  if (!value) return undefined;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : undefined;
}

function toValue(date) {
  if (!date) return '';
  return format(date, 'yyyy-MM-dd');
}

function formatRangeLabel(from, to) {
  const fromDate = toDate(from);
  const toDateValue = toDate(to);
  if (fromDate && toDateValue) {
    return `${format(fromDate, 'dd MMM yyyy', { locale: fr })} – ${format(toDateValue, 'dd MMM yyyy', { locale: fr })}`;
  }
  if (fromDate) {
    return format(fromDate, 'dd MMM yyyy', { locale: fr });
  }
  return null;
}

export default function DateRangePicker({
  from,
  to,
  onChange,
  placeholder = 'Choisir une période',
  className,
  disabled,
}) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const selected = {
    from: toDate(from),
    to: toDate(to),
  };
  const label = formatRangeLabel(from, to);

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn('justify-start font-normal', !label && 'text-muted-foreground', className)}
        >
          <CalendarIcon className="size-4 shrink-0" data-icon="inline-start" />
          <span className="truncate">{label || placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="z-[1300] w-auto max-w-[calc(100vw-1rem)] p-0" align="start" collisionPadding={12}>
        <Calendar
          mode="range"
          locale={fr}
          numberOfMonths={isMobile ? 1 : 2}
          defaultMonth={selected.from || selected.to}
          selected={selected}
          onSelect={(range) => {
            onChange?.({
              from: toValue(range?.from),
              to: toValue(range?.to),
            });
            if (range?.from && range?.to) {
              setOpen(false);
            }
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
