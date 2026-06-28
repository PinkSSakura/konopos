import React from 'react';

export default function AppWordmark({ className = '' }) {
  return (
    <span className={['app-wordmark', className].filter(Boolean).join(' ')} aria-label="KonoPOS">
      <span className="app-wordmark__kono">Kono</span>
      <span className="app-wordmark__pos">POS</span>
    </span>
  );
}
