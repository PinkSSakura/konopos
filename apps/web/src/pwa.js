import { toast } from 'sonner';

export function registerPwa() {
  if (!('serviceWorker' in navigator)) return;

  // Electron POS window — unregister SW to avoid stale cached bundles (blank pages).
  if (window.konoPosShell) {
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
