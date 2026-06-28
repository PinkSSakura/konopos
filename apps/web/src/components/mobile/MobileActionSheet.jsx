import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const ACTION_VARIANT = {
  checkout: 'default',
  served: 'default',
  ready: 'default',
  accept: 'default',
  delivered: 'default',
  edit: 'outline',
  reprint: 'outline',
  cancel: 'destructive',
  reject: 'destructive',
  'refund-cancel': 'destructive',
};

function ActionButton({ action, onClose }) {
  const variant = ACTION_VARIANT[action.key] || (action.danger ? 'destructive' : 'outline');

  if (action.link) {
    return (
      <Button variant={variant} className="order-detail-sheet__action" asChild>
        <Link to={action.link} onClick={onClose}>
          {action.label}
        </Link>
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      className={cn(
        'order-detail-sheet__action',
        ['checkout', 'served', 'ready', 'accept', 'delivered'].includes(action.key)
          && 'bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white',
        action.key === 'edit' && 'border-blue-200 text-blue-900 hover:bg-blue-50',
      )}
      disabled={action.disabled}
      onClick={() => {
        action.onClick?.();
        if (!action.keepOpen) onClose?.();
      }}
    >
      {action.label}
    </Button>
  );
}

export default function MobileActionSheet({
  open,
  onOpenChange,
  title,
  subtitle,
  children,
  actions = [],
}) {
  const actionItems = actions.filter((a) => a.key !== 'view');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="order-detail-sheet max-h-[90vh] overflow-y-auto rounded-t-2xl p-0"
      >
        <SheetHeader className="border-b px-4 py-4 pr-12 text-left">
          <SheetTitle className="text-lg">{title}</SheetTitle>
          {subtitle ? (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
        </SheetHeader>
        <div className="px-4 py-4">
          {children}
          {actionItems.length > 0 && (
            <>
              <Separator className="my-4" />
              <div className="order-detail-sheet__actions">
                {actionItems.map((action) => (
                  <ActionButton
                    key={action.key}
                    action={action}
                    onClose={() => onOpenChange(false)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
