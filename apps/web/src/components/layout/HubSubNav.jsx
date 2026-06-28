import React from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { isHubItemActive } from '../../utils/hubSections';

export default function HubSubNav({ hubTitle, items, activePath }) {
  if (!items?.length) return null;

  return (
    <nav className="hub-sub-nav w-full min-w-0" aria-label={hubTitle ? `Navigation ${hubTitle}` : 'Navigation section'}>
      <div className="page-tabs-list hub-sub-nav__list gap-1.5 rounded-lg bg-muted/60 p-1.5">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isHubItemActive(activePath, item.path);

          return (
            <NavLink
              key={item.key}
              to={item.path}
              isActive={() => active}
              className={cn(
                'hub-sub-nav__link inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-transparent px-2.5 py-2 text-sm font-medium transition-all',
                'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring',
                active
                  ? 'hub-sub-nav__link--active bg-card text-card-foreground shadow-sm ring-1 ring-border/70'
                  : 'text-muted-foreground hover:bg-background hover:text-foreground',
              )}
            >
              {Icon ? <Icon className="size-4 shrink-0" aria-hidden /> : null}
              <span className="text-center leading-tight">{item.title}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
