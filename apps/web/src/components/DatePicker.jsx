import React, { useState } from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

function toDate(value) {
  if (!value) return undefined;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : undefined;
}

function toValue(date) {
  if (!date) return '';
  return format(date, 'yyyy-MM-dd');
}

export default function DatePicker({
  value,
  onChange,
  placeholder = 'Choisir une date',
  className,
  disabled,
}) {
  const [open, setOpen] = useState(false);
  const selected = toDate(value);

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn('justify-start font-normal', !value && 'text-muted-foreground', className)}
        >
          <CalendarIcon className="size-4" data-icon="inline-start" />
          {selected ? format(selected, 'PPP', { locale: fr }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="z-[1300] w-auto p-0" align="start" collisionPadding={12}>
        <Calendar
          mode="single"
          locale={fr}
          selected={selected}
          onSelect={(date) => {
            onChange?.(toValue(date));
            setOpen(false);
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
