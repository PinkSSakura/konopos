import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

const SPINNER_SIZES = {
  sm: 'size-4',
  default: 'size-8',
  lg: 'size-10',
};

export function LoadingSpinner({ className, size = 'default', label }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2', className)}>
      <Loader2 className={cn('animate-spin text-muted-foreground', SPINNER_SIZES[size])} />
      {label ? <span className="text-sm text-muted-foreground">{label}</span> : null}
    </div>
  );
}

export function PageLoading({ label = 'Chargement…', className }) {
  return (
    <div className={cn('flex min-h-[240px] items-center justify-center py-16', className)}>
      <LoadingSpinner size="lg" label={label} />
    </div>
  );
}

export function InlineLoading({ label, className }) {
  return (
    <div className={cn('flex items-center justify-center py-12', className)}>
      <LoadingSpinner label={label} />
    </div>
  );
}

export function FormLoading({ fields = 5, className }) {
  return (
    <div className={cn('flex max-w-2xl flex-col gap-4', className)}>
      <Skeleton className="h-8 w-48" />
      {Array.from({ length: fields }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
      <Skeleton className="h-10 w-32" />
    </div>
  );
}

export function TableLoading({ rows = 6, columns = 5, className }) {
  return (
    <div className={cn('space-y-3 rounded-lg border bg-card p-4', className)}>
      <div className="flex gap-3 border-b pb-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`head-${i}`} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="flex gap-3 py-1">
          {Array.from({ length: columns }).map((_, col) => (
            <Skeleton key={`${row}-${col}`} className="h-8 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardLoading({ className }) {
  return (
    <div className={cn('space-y-4 rounded-xl border bg-card p-6 ring-1 ring-foreground/10', className)}>
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

export function DashboardLoading() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-9 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-10">
        <Skeleton className="h-72 rounded-xl lg:col-span-6" />
        <Skeleton className="h-72 rounded-xl lg:col-span-4" />
      </div>
    </div>
  );
}
