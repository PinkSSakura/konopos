import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Clock3, KeyRound, LogOut, Tablet, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTouchMode } from '../../context/TouchModeContext';
import { canToggleTouchMode } from '../../utils/touchModeAccess';
import { canViewOwnShift } from '../../utils/shiftAccess';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const ROLE_LABELS = {
  superadmin: 'Super Admin',
  owner: 'Propriétaire',
  manager: 'Manager',
  submanager: 'Sous-manager',
  waiter: 'Serveur',
  cook: 'Cuisine',
  barman: 'Bar',
  systempos: 'SystemPOS',
};

function getInitials(name) {
  if (!name?.trim()) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function ProfileMenu({ onLogout, onReturnToPin, className }) {
  const navigate = useNavigate();
  const { user, isPinSession: isPin } = useAuth();
  const { touchMode, setTouchMode } = useTouchMode();
  const roleKey = user?.role?.role_key;
  const showTouchToggle = canToggleTouchMode(roleKey);
  const touchLocked = isPin || roleKey === 'systempos';
  const roleLabel = ROLE_LABELS[roleKey] || user?.role?.name || 'Utilisateur';
  const showShiftLink = isPin && canViewOwnShift(user);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className={cn('app-profile-menu__trigger gap-2 px-2', className)}
          aria-label="Menu profil"
        >
          <span className="app-profile-menu__avatar" aria-hidden>
            {getInitials(user?.fullname)}
          </span>
          <span className="app-profile-menu__name hidden min-w-0 truncate sm:inline">
            {user?.fullname}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium leading-snug">{user?.fullname}</p>
          <p className="truncate text-xs text-muted-foreground">{roleLabel}</p>
        </DropdownMenuLabel>
        {showTouchToggle && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={touchMode}
              disabled={touchLocked}
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={(checked) => {
                if (!touchLocked) setTouchMode(checked);
              }}
            >
              <Tablet />
              Mode tactile
            </DropdownMenuCheckboxItem>
            {touchLocked && (
              <p className="px-2 pb-1 text-[11px] text-muted-foreground">
                {isPin ? 'Activé pour la session PIN.' : 'Activé sur ce terminal.'}
              </p>
            )}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/profile')}>
          <User />
          Mon profil
        </DropdownMenuItem>
        {showShiftLink && (
          <DropdownMenuItem onSelect={() => navigate('/shift')}>
            <Clock3 />
            Mon shift
          </DropdownMenuItem>
        )}
        {isPin ? (
          <DropdownMenuItem onSelect={onReturnToPin}>
            <KeyRound />
            Retour PIN
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem variant="destructive" onSelect={onLogout}>
            <LogOut />
            Déconnexion
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
