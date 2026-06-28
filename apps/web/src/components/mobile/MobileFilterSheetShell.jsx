import React from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

export function MobileFilterField({ label, htmlFor, children, className }) {
  return (
    <div className={cn('mobile-filter-sheet__field', className)}>
      {label ? <Label htmlFor={htmlFor}>{label}</Label> : null}
      {children}
    </div>
  );
}

export function MobileFilterRow({ children, className }) {
  return <div className={cn('mobile-filter-sheet__row', className)}>{children}</div>;
}

export function MobileFilterActions({ children, className }) {
  return <div className={cn('mobile-filter-sheet__actions', className)}>{children}</div>;
}

export default function MobileFilterSheetShell({
  open,
  onOpenChange,
  title = 'Filtres',
  maxHeight = '85vh',
  children,
  footer,
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          'mobile-filter-sheet overflow-y-auto rounded-t-2xl p-0',
          maxHeight === '70vh' ? 'max-h-[70vh]' : 'max-h-[85vh]',
        )}
      >
        <SheetHeader className="border-b px-4 py-4 pr-12 text-left">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="mobile-filter-sheet__body">
          {children}
          {footer ? <MobileFilterActions>{footer}</MobileFilterActions> : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
