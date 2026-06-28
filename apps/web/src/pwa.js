import { toast } from 'sonner';

export function registerPwa() {
  if (!('serviceWorker' in navigator)) return;

  // Electron — never cache the POS UI with a service worker (stale bundles after updates).
  if (window.konoPosShell || /\bElectron\b/i.test(navigator.userAgent)) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => reg.unregister());
    }).catch(() => {});
    return;
  }

  import('virtual:pwa-register').then(({ registerSW }) => {
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        toast('Mise à jour disponible', {
          description: 'Une nouvelle version de KonoPOS est prête.',
          action: {
            label: 'Recharger',
            onClick: () => updateSW(true),
          },
          duration: Infinity,
        });
      },
    });
  }).catch(() => {
    // PWA plugin not active (e.g. dev without build)
  });
}
