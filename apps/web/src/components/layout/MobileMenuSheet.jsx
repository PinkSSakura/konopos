import React from 'react';
import { ChevronRight } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { isPathActive } from '../../utils/mobileNav';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

export default function MobileMenuSheet({ open, onOpenChange, cards, onNavigate }) {
  const { pathname } = useLocation();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mobile-menu-sheet max-h-[85vh] overflow-y-auto rounded-t-2xl p-0">
        <SheetHeader className="border-b px-4 py-4 text-left">
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <div className="grid grid-cols-1 gap-3 p-4 pb-8">
          {cards.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune autre page disponible.</p>
          ) : (
            cards.map((item) => {
              const Icon = item.icon;
              const active = isPathActive(pathname, item.path);
              return (
                <button
                  key={item.key || item.path}
                  type="button"
                  className="group block w-full text-left"
                  onClick={() => onNavigate(item.path)}
                >
                  <Card
                    className={cn(
                      'transition-colors hover:border-[var(--brand-primary)]/50 hover:bg-muted/30',
                      active && 'border-[var(--brand-primary)]/60 bg-muted/20',
                    )}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start gap-3">
                        {Icon && (
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-charcoal)] text-[var(--brand-charcoal-foreground)]">
                            <Icon className="size-5" aria-hidden />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <CardTitle className="flex items-center justify-between gap-2 text-base">
                            <span>{item.title}</span>
                            <ChevronRight
                              className="size-4 shrink-0 text-muted-foreground"
                              aria-hidden
                            />
                          </CardTitle>
                          {item.description ? (
                            <CardDescription className="mt-1">{item.description}</CardDescription>
                          ) : null}
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                </button>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
