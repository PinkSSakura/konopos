import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function PagePrimaryButton({
  to,
  onClick,
  icon: Icon,
  children,
  className,
  type = 'button',
}) {
  const button = (
    <Button
      type={type}
      className={cn('w-full sm:w-auto', className)}
      onClick={onClick}
    >
      {Icon ? <Icon data-icon="inline-start" /> : null}
      {children}
    </Button>
  );

  if (to) {
    return (
      <Link to={to} className="block w-full sm:inline-block sm:w-auto">
        {button}
      </Link>
    );
  }

  return button;
}
