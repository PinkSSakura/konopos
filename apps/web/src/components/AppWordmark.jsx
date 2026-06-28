import React from 'react';

export default function AppWordmark({ className = '' }) {
  return (
    <span className={['app-wordmark', className].filter(Boolean).join(' ')} aria-label="TouDev">
      <span className="app-wordmark__tou">Tou</span>
      <span className="app-wordmark__dev">Dev</span>
    </span>
  );
}
