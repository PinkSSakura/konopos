import React from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

const STATUS = {
  success: { icon: CheckCircle2, className: 'border-emerald-200 bg-emerald-50 text-emerald-950' },
  info: { icon: Info, className: 'border-sky-200 bg-sky-50 text-sky-950' },
  warning: { icon: AlertCircle, className: 'border-amber-200 bg-amber-50 text-amber-950' },
  error: { icon: AlertCircle, className: 'border-red-200 bg-red-50 text-red-950' },
};

/** Replacement for antd `Result`. */
export default function InfoResult({
  status = 'info',
  title,
  subTitle,
  extra,
  className,
}) {
  const meta = STATUS[status] || STATUS.info;
  const Icon = meta.icon;

  return (
    <div className={cn('flex flex-col items-center gap-4 py-10 text-center', className)}>
      <Alert className={cn('max-w-lg text-left', meta.className)}>
        <Icon className="size-4" />
        {title ? <AlertTitle>{title}</AlertTitle> : null}
        {subTitle ? <AlertDescription>{subTitle}</AlertDescription> : null}
      </Alert>
      {extra ? <div className="flex flex-wrap justify-center gap-2">{extra}</div> : null}
    </div>
  );
}

export function Result(props) {
  return <InfoResult {...props} />;
}
