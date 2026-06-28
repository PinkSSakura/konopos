import React from 'react';
import logoMark from './images/kono_pos_no_background.png';
import logoLong from './images/kono_pos_long.png';

export default function AppLogo({ className = '', alt = 'KonoPOS', variant = 'mark' }) {
  const src = variant === 'long' ? logoLong : logoMark;
  const variantClass = variant === 'long' ? 'app-logo--long' : 'app-logo--mark';

  return (
    <img
      src={src}
      alt={alt}
      className={['app-logo', variantClass, className].filter(Boolean).join(' ')}
    />
  );
}
