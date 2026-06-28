import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

/** Simplified antd-like Select wrapper. */
export default function AppSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Sélectionner…',
  allowClear,
  className,
  disabled,
  style,
}) {
  const stringValue = value == null || value === '' ? undefined : String(value);

  return (
    <Select
      value={stringValue}
      onValueChange={(next) => onChange?.(allowClear && next === '__clear__' ? undefined : next)}
      disabled={disabled}
    >
      <SelectTrigger className={cn('w-full', className)} style={style}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowClear ? <SelectItem value="__clear__">—</SelectItem> : null}
        {options.map((option) => (
          <SelectItem key={String(option.value)} value={String(option.value)}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export { AppSelect as Select };
