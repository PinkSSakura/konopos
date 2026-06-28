import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { TouchModeProvider } from './context/TouchModeContext';
import TouchKeyboardHost from './components/touch/TouchKeyboardHost';
import { PosCartProvider } from './context/PosCartContext';
import { SocketProvider } from './context/SocketContext';
import { EstablishmentProvider } from './context/EstablishmentContext';
import { LicenseProvider } from './context/LicenseContext';
import { ShiftProvider } from './context/ShiftContext';
import InactivityLogoutGuard from './components/InactivityLogoutGuard';
import SessionRevokedGuard from './components/auth/SessionRevokedGuard';
import AppRootErrorBoundary from './components/errors/AppRootErrorBoundary';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { registerPwa } from './pwa';
import { usePushNotifications } from './hooks/usePushNotifications';
import { WaiterNotificationProvider } from './context/WaiterNotificationContext';
import './index.css';
import './styles/responsive.css';
import './styles/pos-cart.css';
import './styles/touch-mode.css';
import './styles/touch-keyboard.css';

registerPwa();

function PushNotificationsBootstrap() {
  usePushNotifications();
  return null;
}

function showBootstrapError(message) {
  const root = document.getElementById('root');
  if (!root || root.childElementCount > 0) return;
  root.innerHTML = `
    <div style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:1.5rem;border:1px solid #e5e7eb;border-radius:12px;">
      <h1 style="font-size:1.125rem;margin:0 0 0.5rem;">KonoPOS — erreur</h1>
      <p style="color:#6b7280;font-size:0.875rem;margin:0 0 1rem;">${String(message).replace(/</g, '&lt;')}</p>
      <button type="button" onclick="location.reload()" style="padding:0.5rem 1rem;border-radius:8px;border:1px solid #d1d5db;background:#fff;cursor:pointer;">Recharger</button>
    </div>
  `;
}

window.addEventListener('error', (event) => {
  const root = document.getElementById('root');
  if (!root || root.childElementCount > 0) return;
  showBootstrapError(event.message || 'Erreur JavaScript');
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppRootErrorBoundary>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <BrowserRouter>
        <AuthProvider>
          <TouchModeProvider>
            <TooltipProvider>
              <TouchKeyboardHost />
              <SocketProvider>
                <LicenseProvider>
                  <EstablishmentProvider>
                  <ShiftProvider>
                    <PosCartProvider>
                      <InactivityLogoutGuard />
                      <SessionRevokedGuard />
                      <PushNotificationsBootstrap />
                      <WaiterNotificationProvider>
                        <App />
                      </WaiterNotificationProvider>
                      <Toaster richColors closeButton position="top-right" />
                    </PosCartProvider>
                  </ShiftProvider>
                </EstablishmentProvider>
                </LicenseProvider>
              </SocketProvider>
            </TooltipProvider>
          </TouchModeProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
    </AppRootErrorBoundary>
  </React.StrictMode>
);
