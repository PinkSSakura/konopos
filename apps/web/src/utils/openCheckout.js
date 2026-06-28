import { isSystemTerminalContext } from './terminalContext';

export function shouldUseCheckoutPage({ user, isPinSession, establishment }) {
  if (user?.role?.role_key === 'systempos' || isPinSession || isSystemTerminalContext()) {
    return true;
  }
  return establishment?.checkout_ui_mode === 'page';
}

export function shouldCheckoutFullscreen({ user, isPinSession }) {
  return user?.role?.role_key === 'systempos' || isPinSession || isSystemTerminalContext();
}

export function checkoutPagePath(orderId, { fullscreen = false } = {}) {
  const base = `/caisse/encaisser/${orderId}`;
  return fullscreen ? `${base}?fullscreen=1` : base;
}

/**
 * Opens checkout as sub-page or modal depending on establishment / terminal context.
 */
export function openCheckout({
  orderId,
  navigate,
  user,
  isPinSession,
  establishment,
  openModal,
  returnTo,
}) {
  if (!orderId) return;

  const usePage = shouldUseCheckoutPage({ user, isPinSession, establishment });
  if (usePage && navigate) {
    const fullscreen = shouldCheckoutFullscreen({ user, isPinSession });
    navigate(checkoutPagePath(orderId, { fullscreen }), {
      state: { returnTo: returnTo ?? `${window.location.pathname}${window.location.search}` },
    });
    return;
  }

  openModal?.(orderId);
}
