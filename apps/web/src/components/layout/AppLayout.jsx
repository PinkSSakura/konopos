import React, { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Menu,
  MenuSquare,
  ChartBar,
  ShoppingCart,
  Bell,
  Grid3X3,
  Armchair,
  Flame,
  CupSoda,
  Settings,
  Wallet,
  Clock3,
  BookUser,
  ClipboardCheck,
} from 'lucide-react';
import useIsMobile from '../../hooks/useIsMobile';
import EstablishmentRequiredGate, { EstablishmentSetupBanner } from '../EstablishmentRequiredGate';
import { useAuth } from '../../context/AuthContext';
import { useShift } from '../../context/ShiftContext';
import { filterNavForShiftGate } from '../../utils/shiftGate';
import AppWordmark from '../AppWordmark';
import AppLogo from '../AppLogo';
import { usePosCart } from '../../context/PosCartContext';
import { useEstablishment } from '../../context/EstablishmentContext';
import { useTouchMode } from '../../context/TouchModeContext';
import { endStaffSessionToPin } from '../../utils/pinSession';
import ProfileMenu from './ProfileMenu';
import NotificationBell from '../notifications/NotificationBell';
import PinSessionBanner from '../auth/PinSessionBanner';
import LicenseRequiredGate from '../LicenseRequiredGate';
import LicenseSidebarStatus from '../license/LicenseSidebarStatus';
import { canViewCustomers } from '../../utils/customerAccess';
import { canViewAnalytics } from '../../utils/analyticsAccess';
import { getAdminHubCards, hasAdminHubAccess } from '../../utils/adminHub';
import { getCaisseHubCards, hasCaisseHubAccess } from '../../utils/caisseHub';
import { resolveHubSection } from '../../utils/hubSections';
import HubSubNav from './HubSubNav';
import MobileBottomNav from './MobileBottomNav';
import PageErrorBoundary from '../errors/PageErrorBoundary';
import { MENU_HUB_SECTIONS } from '../../utils/menuHub';
import {
  canAccessMenuAdmin,
  canViewKdsDrink,
  canViewKdsFood,
  canViewTables,
  hasPermission,
} from '../../utils/permissions';
import {
  getKitchenDashboardPath,
  isKitchenStaffRole,
} from '../../utils/kdsaccess';
import { canViewOwnShift, canViewWaiterDailyClose } from '../../utils/shiftAccess';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const SIDER_COLLAPSED_KEY = 'TouDev_sider_collapsed';

function readSiderCollapsed() {
  try {
    return localStorage.getItem(SIDER_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function canAccess(roleKey, keys) {
  if (!roleKey) return false;
  if (roleKey === 'superadmin' || roleKey === 'owner') return true;
  return keys.includes(roleKey);
}

function navItem(key, icon, label, tryNavigate) {
  return { key, icon, label, onClick: () => tryNavigate(key) };
}

function wrapNavItems(navItems, onAfterNavigate) {
  return navItems.map((item) => {
    if (item.children) {
      return {
        ...item,
        children: wrapNavItems(item.children, onAfterNavigate),
      };
    }
    if (!item.onClick) return item;
    const originalOnClick = item.onClick;
    return {
      ...item,
      onClick: () => {
        originalOnClick();
        onAfterNavigate?.();
      },
    };
  });
}

export default function AppLayout() {
  const { user, logout, logoutPinSession, refreshUser, isPinSession: isPin } = useAuth();
  const { isShiftGated } = useShift();
  const { tryNavigate } = usePosCart();
  const { tablesEnabled } = useEstablishment();
  const { touchMode } = useTouchMode();
  const navigate = useNavigate();
  const location = useLocation();
  const roleKey = user?.role?.role_key;
  const isSuperAdmin = roleKey === 'superadmin';
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(readSiderCollapsed);
  const showMobileBottomNav = isMobile && Boolean(user);

  useEffect(() => {
    localStorage.setItem(SIDER_COLLAPSED_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  useEffect(() => {
    if (!tablesEnabled && location.pathname.startsWith('/tables')) {
      navigate('/pos', { replace: true });
    }
  }, [tablesEnabled, location.pathname, navigate]);

  const navItems = useMemo(() => {
  if (!user) return [];
  const items = [];
  if (canViewAnalytics(user)) {
    items.push(navItem('/dashboard', ChartBar, 'Tableau de bord', tryNavigate));
  }

  if (isKitchenStaffRole(roleKey)) {
    const kdsPath = getKitchenDashboardPath(roleKey);
    items.push(
      navItem(
        kdsPath,
        roleKey === 'cook' ? Flame : CupSoda,
        'Tableau de bord',
        tryNavigate
      ),
      navItem('/orders', MenuSquare, 'Commandes', tryNavigate),
      navItem('/shift', Clock3, 'Shift', tryNavigate),
    );
  } else {
    if (hasPermission(user, 'order_create')) {
      items.push(navItem('/pos', ShoppingCart, 'Point de vente', tryNavigate));
    }
    if (hasPermission(user, 'order_view')) {
      items.push(navItem('/orders', MenuSquare, 'Commandes', tryNavigate));
    }
    if (canViewOwnShift(user)) {
      items.push(navItem('/shift', Clock3, 'Shift', tryNavigate));
    }
    if (canViewWaiterDailyClose(user)) {
      items.push(navItem('/shift/daily-close', ClipboardCheck, 'Clôture jour', tryNavigate));
    }
  }

  if (hasCaisseHubAccess(user)) {
    items.push(navItem('/caisse', Wallet, 'Caisse', tryNavigate));
  }

  if (hasPermission(user, 'order_view') && canAccess(roleKey, ['waiter', 'manager', 'submanager', 'superadmin', 'owner', 'systempos'])) {
    items.splice(2, 0, navItem('/service', Bell, 'À servir', tryNavigate));
  }

  if (canAccessMenuAdmin(user)) {
    items.push(navItem('/menu', Grid3X3, 'Menu', tryNavigate));
  }
  if (tablesEnabled && canViewTables(user)) {
    items.push(navItem('/tables', Armchair, 'Plan de salle', tryNavigate));
  }
  if (canViewKdsFood(user) && !isKitchenStaffRole(roleKey)) {
    items.push(navItem('/kds/food', Flame, 'Cuisine', tryNavigate));
  }
  if (canViewKdsDrink(user) && !isKitchenStaffRole(roleKey)) {
    items.push(navItem('/kds/drink', CupSoda, 'Bar', tryNavigate));
  }

  if (canViewCustomers(user)) {
    items.push(navItem('/admin/clients', BookUser, 'Clients réguliers', tryNavigate));
  }

  if (hasAdminHubAccess(user)) {
    items.push(navItem('/admin', Settings, 'Administration', tryNavigate));
  }

  return items;
  }, [user, roleKey, tablesEnabled, tryNavigate]);

  const adminCardPaths = useMemo(
    () => getAdminHubCards(user).map((card) => card.path),
    [user]
  );

  const caisseCardPaths = useMemo(
    () => getCaisseHubCards(user).map((card) => card.path),
    [user]
  );

  const menuCardPaths = useMemo(
    () => MENU_HUB_SECTIONS.map((section) => section.path),
    [],
  );

  const items = isShiftGated ? filterNavForShiftGate(navItems, user) : navItems;
  const hubSection = useMemo(
    () => resolveHubSection(location.pathname, user),
    [location.pathname, user],
  );

  const flatKeys = [
    ...items
      .flatMap((i) => (i.children ? i.children.map((c) => c.key) : [i.key])),
    ...adminCardPaths,
    ...caisseCardPaths,
    ...menuCardPaths,
  ]
    .sort((a, b) => b.length - a.length);
  const defaultPath = isKitchenStaffRole(roleKey)
    ? getKitchenDashboardPath(roleKey)
    : canViewAnalytics(user)
      ? '/dashboard'
      : '/pos';
  const selected = flatKeys.find((k) => location.pathname.startsWith(k))
    || (location.pathname === '/admin' ? '/admin' : null)
    || (location.pathname === '/caisse' ? '/caisse' : null)
    || (location.pathname === '/menu' ? '/menu' : null)
    || defaultPath;
  const routeOpenKeys = useMemo(() => [], []);
  const [menuOpenKeys, setMenuOpenKeys] = useState(routeOpenKeys);

  useEffect(() => {
    setMenuOpenKeys((prev) => [...new Set([...prev, ...routeOpenKeys])]);
  }, [routeOpenKeys]);

  const menuItems = useMemo(
    () => wrapNavItems(items),
    [items, isShiftGated]
  );

  const handleReturnToPin = async () => {
    await endStaffSessionToPin(
      { logoutPinSession, refreshUser, user },
      { toastMessage: 'Retour à l\'écran PIN' },
    );
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.info('Déconnecté');
      navigate('/login');
    } catch (err) {
      if (err?.response?.data?.code === 'SHIFT_MUST_CLOSE') {
        toast.warning('Clôturez votre shift avant déconnexion');
        navigate('/shift');
        return;
      }
      toast.error(err?.response?.data?.message || 'Erreur déconnexion');
    }
  };

  const iconOnlySidebar = collapsed && !isMobile;

  const wrapWithTooltip = (key, label, node) => {
    if (!iconOnlySidebar) return node;
    return (
      <Tooltip key={key}>
        <TooltipTrigger asChild>{node}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  };

  const renderNavItem = (item) => {
    const Icon = item.icon;
    const isActive = selected === item.key;

    if (item.children) {
      const isOpen = menuOpenKeys.includes(item.key);
      return (
        <div key={item.key} className="app-nav-group">
          <Button
            type="button"
            variant="ghost"
            className="app-nav-button app-nav-button-group"
            onClick={() => {
              setMenuOpenKeys((prev) => (
                prev.includes(item.key) ? prev.filter((key) => key !== item.key) : [...prev, item.key]
              ));
            }}
          >
            <span className="app-nav-button-left">
              {Icon && <Icon data-icon="inline-start" />}
              <span className="app-nav-label">{item.label}</span>
            </span>
            <span className="app-nav-group-toggle">{isOpen ? '−' : '+'}</span>
          </Button>
          <div className={`app-nav-children${isOpen ? '' : ' app-nav-children--closed'}`}>
            {item.children.map((child) => renderNavItem(child))}
          </div>
        </div>
      );
    }

    const button = (
      <Button
        key={item.key}
        type="button"
        variant={isActive ? 'secondary' : 'ghost'}
        className="app-nav-button"
        onClick={item.onClick}
        aria-label={iconOnlySidebar ? item.label : undefined}
      >
        {Icon && <Icon data-icon="inline-start" />}
        <span className="app-nav-label">{item.label}</span>
      </Button>
    );

    return wrapWithTooltip(item.key, item.label, button);
  };

  const siderBrand = isMobile ? (
    <div className="app-sider-brand">
      <AppLogo variant="long" className="app-logo--sider-long" alt="TouDev" />
      {touchMode && (
        <Badge variant="secondary" className="app-sider-tactile-tag app-sider-brand-text">
          Tactile
        </Badge>
      )}
    </div>
  ) : (
    <div className={`app-sider-brand app-sider-brand--desktop ${collapsed ? 'app-sider-brand-collapsed' : 'app-sider-brand--hidden'}`}>
      <AppLogo variant="mark" className="app-logo--sider-collapsed" alt="TouDev" />
    </div>
  );

  const sideMenu = (
    <nav className="app-nav">
      {menuItems.map((item) => renderNavItem(item))}
    </nav>
  );

  return (
    <LicenseRequiredGate>
    <div className={`app-layout-shell ${touchMode ? 'app-layout-touch' : ''} ${isMobile ? 'app-layout-shell--mobile' : ''}`}>
      {!isMobile && (
        <aside className={`app-sider app-sidebar ${collapsed ? 'app-sidebar-collapsed' : ''}`}>
          {siderBrand}
          <LicenseSidebarStatus collapsed={collapsed} />
          <Separator />
          {sideMenu}
        </aside>
      )}

      <div className={`app-main${showMobileBottomNav ? ' app-main--mobile-nav' : ''}`}>
        <header className="app-topbar">
          <div className="app-topbar__left">
            <AppWordmark className="app-wordmark--topbar" />
            {!showMobileBottomNav && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setCollapsed((c) => !c)}
                aria-label="Menu"
              >
                {collapsed ? <Menu data-icon="inline-start" /> : <MenuSquare data-icon="inline-start" />}
              </Button>
            )}
            <span className="app-topbar__role-tags hidden md:inline-flex">
              {isSuperAdmin && <Badge variant="destructive">Super Admin</Badge>}
              {roleKey === 'owner' && <Badge variant="secondary">Propriétaire</Badge>}
            </span>
          </div>
          <div className="app-topbar__right">
            <NotificationBell />
            <ProfileMenu onLogout={handleLogout} onReturnToPin={handleReturnToPin} />
          </div>
        </header>
        <main className="app-content">
          <PinSessionBanner />
          <EstablishmentSetupBanner />
          <EstablishmentRequiredGate>
            <div className="app-outlet flex w-full min-w-0 flex-col gap-4">
              {hubSection ? (
                <HubSubNav
                  hubTitle={hubSection.hubTitle}
                  items={hubSection.items}
                  activePath={location.pathname}
                />
              ) : null}
              <PageErrorBoundary>
                <Outlet />
              </PageErrorBoundary>
            </div>
          </EstablishmentRequiredGate>
        </main>
        {showMobileBottomNav && (
          <MobileBottomNav
            navItems={items}
            user={user}
            roleKey={roleKey}
            tryNavigate={tryNavigate}
          />
        )}
      </div>
    </div>
    </LicenseRequiredGate>
  );
}
