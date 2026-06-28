import React from 'react';

export default function AppFooter() {
  return (
    <footer className="app-footer">
      <p className="app-footer__text">
        <span className="app-footer__wordmark" aria-hidden="true">
          <span className="app-footer__tou">Tou</span>
          <span className="app-footer__dev">Dev</span>
        </span>
        <span className="app-footer__copy"> @ 2026 · All rights reserved</span>
      </p>
    </footer>
  );
}
