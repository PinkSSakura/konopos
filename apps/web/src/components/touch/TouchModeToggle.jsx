import React from 'react';
import { Tablet } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTouchMode } from '../../context/TouchModeContext';
import { canToggleTouchMode } from '../../utils/touchModeAccess';
import { useAuth } from '../../context/AuthContext';

export default function TouchModeToggle({ className, showLabel = true, size = 'default' }) {
  const { touchMode, setTouchMode } = useTouchMode();
  const { user } = useAuth();
  const roleKey = user?.role?.role_key;

  if (!canToggleTouchMode(roleKey)) return null;

  const iconSize = size === 'large' ? 20 : 16;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={className || 'touch-mode-toggle'}>
          <Tablet style={{ width: iconSize, height: iconSize }} aria-hidden />
          {showLabel && (
            <span className="touch-mode-toggle__label text-sm">
              Tactile
            </span>
          )}
          <Switch
            size={size === 'large' ? 'default' : 'sm'}
            checked={touchMode}
            onCheckedChange={setTouchMode}
          />
        </div>
      </TooltipTrigger>
      <TooltipContent>
        Interface agrandie et clavier à l&apos;écran pour tablette / tactile
      </TooltipContent>
    </Tooltip>
  );
}
