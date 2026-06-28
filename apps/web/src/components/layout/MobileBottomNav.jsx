import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { buildMobileNav, isPathActive, MENU_TAB } from '../../utils/mobileNav';
import MobileMenuSheet from './MobileMenuSheet';

export default function MobileBottomNav({ navItems, user, roleKey, tryNavigate }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = location.pathname;

  const { fixedTabs, menuCards } = useMemo(
    () => buildMobileNav(navItems, user, roleKey),
    [navItems, user, roleKey],
  );

  if (!fixedTabs.length && !menuCards.length) return null;

  const navigateTo = (key) => {
    if (key === '/caisse/encaisser') {
      navigate('/caisse/encaisser');
      return;
    }
    tryNavigate(key);
  };

  const menuActive = menuOpen || menuCards.some((c) => isPathActive(pathname, c.path));

  return (
    <>
      <nav className="mobile-bottom-nav" aria-label="Navigation principale">
        {fixedTabs.map((tab) => {
          const Icon = tab.icon;
          const active = isPathActive(pathname, tab.key);
          return (
            <button
              key={tab.key}
              type="button"
              className={cn('mobile-bottom-nav__item', active && 'mobile-bottom-nav__item--active')}
              onClick={() => navigateTo(tab.key)}
              aria-current={active ? 'page' : undefined}
            >
              {Icon && <Icon className="mobile-bottom-nav__icon" aria-hidden />}
              <span className="mobile-bottom-nav__label">{tab.shortLabel || tab.label}</span>
            </button>
          );
        })}
        {menuCards.length > 0 && (
          <button
            type="button"
            className={cn(
              'mobile-bottom-nav__item',
              menuActive && 'mobile-bottom-nav__item--active',
            )}
            onClick={() => setMenuOpen(true)}
            aria-expanded={menuOpen}
          >
            <MENU_TAB.icon className="mobile-bottom-nav__icon" aria-hidden />
            <span className="mobile-bottom-nav__label">{MENU_TAB.shortLabel}</span>
          </button>
        )}
      </nav>

      <MobileMenuSheet
        open={menuOpen}
        onOpenChange={setMenuOpen}
        cards={menuCards}
        onNavigate={(path) => {
          setMenuOpen(false);
          if (path.startsWith('/caisse/encaisser')) {
            navigate(path);
          } else {
            tryNavigate(path);
          }
        }}
      />
    </>
  );
}
