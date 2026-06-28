import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useWaiterNotifications } from '../../context/WaiterNotificationContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

function formatWhen(at) {
  try {
    return formatDistanceToNow(at, { addSuffix: true, locale: fr });
  } catch {
    return '';
  }
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const {
    notifications, unreadCount, markRead, markAllRead, isWaiter,
  } = useWaiterNotifications();

  if (!isWaiter) return null;

  const handleOpen = (notification) => {
    markRead(notification.id);
    navigate(notification.url || '/service');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Notifications${unreadCount ? ` (${unreadCount} non lues)` : ''}`}
        >
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px]"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <DropdownMenuLabel className="p-0 text-sm font-semibold">
            Notifications
          </DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto px-0 text-xs"
              onClick={markAllRead}
            >
              Tout marquer lu
            </Button>
          )}
        </div>
        <DropdownMenuSeparator className="m-0" />
        {notifications.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            Aucune notification
          </p>
        ) : (
          <div className="max-h-80 overflow-y-auto py-1">
            {notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={cn(
                  'cursor-pointer flex-col items-start gap-0.5 rounded-none px-3 py-2.5',
                  !notification.read && 'bg-accent/40',
                )}
                onClick={() => handleOpen(notification)}
              >
                <span className="text-sm font-medium leading-snug">
                  {notification.title}
                </span>
                <span className="text-xs leading-snug text-muted-foreground">
                  {notification.body}
                </span>
                <span className="text-[11px] text-muted-foreground/80">
                  {formatWhen(notification.at)}
                </span>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
