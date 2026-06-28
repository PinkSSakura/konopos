import React from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { useLicense } from '../../context/LicenseContext';
import { useAuth } from '../../context/AuthContext';
import { getLicenseStatusLabel } from '../../utils/licenseDisplay';
import useLicenseCountdown from '../../hooks/useLicenseCountdown';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export default function LicenseSidebarStatus({ collapsed = false }) {
  const { valid, status } = useLicense();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { countdown } = useLicenseCountdown(status);

  const isSuperAdmin = user?.role?.role_key === 'superadmin';
  if (!isSuperAdmin || !status) return null;

  const detailPath = '/admin/license';
  const statusLabel = getLicenseStatusLabel(status);
  const subtitle = status.lifetime && status.valid
    ? statusLabel
    : countdown
      ? `${statusLabel} · ${countdown}`
      : statusLabel;

  const content = (
    <div
      className={`app-sider-license ${detailPath ? 'app-sider-license--link' : ''}`}
      role={detailPath ? 'button' : undefined}
      tabIndex={detailPath ? 0 : undefined}
      onClick={detailPath ? () => navigate(detailPath) : undefined}
      onKeyDown={detailPath ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          navigate(detailPath);
        }
      } : undefined}
    >
      {collapsed ? (
        <KeyRound className="app-sider-license__icon" aria-hidden />
      ) : (
        <>
          <div className="app-sider-license__row">
            <KeyRound className="app-sider-license__icon" aria-hidden />
            <span className="app-sider-license__period">Licence</span>
          </div>
          <div className="app-sider-license__meta">
            <Badge
              variant={valid ? 'secondary' : 'destructive'}
              className="app-sider-license__badge"
            >
              {valid ? 'Active' : 'Expirée'}
            </Badge>
            {!status.lifetime && countdown ? (
              <span className="app-sider-license__countdown">{countdown}</span>
            ) : null}
          </div>
        </>
      )}
    </div>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" className="max-w-[220px]">
          <p className="font-medium">Licence</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}
