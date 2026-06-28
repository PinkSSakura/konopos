import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function PageShell({
  title,
  subtitle,
  action,
  children,
  className,
}) {
  return (
    <div className={cn('page-shell flex flex-col gap-4', className)}>
      <div className="page-shell__header page-header">
        <div className="page-shell__intro min-w-0">
          <h2 className="page-shell__title text-xl font-semibold tracking-tight sm:text-2xl">
            {title}
          </h2>
          {subtitle ? (
            <p className="page-shell__subtitle mt-1 text-sm text-muted-foreground">
              {subtitle}
            </p>
          ) : null}
        </div>
        {action ? (
          <div className="page-shell__action w-full shrink-0 sm:w-auto">
            {action}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function PageTableCard({ title, children, className, contentClassName }) {
  return (
    <Card className={cn('page-table-card overflow-hidden', className)}>
      {title ? (
        <CardHeader className="border-b border-border/60 pb-3">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
        </CardHeader>
      ) : null}
      <CardContent className={cn(title ? 'pt-4' : 'pt-6', contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}
