import React, { useState } from 'react';
import { Bell, Check, CheckAll, Trash, Info, AlertTriangle, CheckCircle, XCircle, ExternalLink, Inbox } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate } from 'react-router-dom';

const CATEGORY_ICONS = {
  crm: <Inbox className="h-4 w-4 text-blue-500" />,
  projects: <CheckCircle className="h-4 w-4 text-green-500" />,
  hrms: <Info className="h-4 w-4 text-purple-500" />,
  recruitment: <Info className="h-4 w-4 text-orange-500" />,
  system: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
};

export function NotificationsPopover() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, isLoading } = useNotifications();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleNotificationClick = (n: any) => {
    if (!n.is_read) markAsRead(n.id);
    if (n.action_url) {
      navigate(n.action_url);
      setOpen(false);
    }
  };

  const getIcon = (type: string, category: string) => {
    // Override based on type if needed, but category is a good default
    return CATEGORY_ICONS[category as keyof typeof CATEGORY_ICONS] || <Bell className="h-4 w-4" />;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative group overflow-visible">
          <Bell className="h-5 w-5 transition-transform group-hover:scale-110" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px] animate-in zoom-in duration-300"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0 mr-4 mt-2 shadow-2xl border-white/20 bg-background/95 backdrop-blur-md" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-semibold text-lg flex items-center gap-2">
            Notifications
            {unreadCount > 0 && (
              <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                {unreadCount} New
              </Badge>
            )}
          </h4>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
            className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
          >
            Mark all read
          </Button>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <div className="px-4 py-2 bg-muted/30">
            <TabsList className="grid w-full grid-cols-2 h-8">
              <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
              <TabsTrigger value="unread" className="text-xs">Unread</TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="h-[400px]">
            <TabsContent value="all" className="m-0">
              {notifications.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="divide-y">
                  {notifications.map((n) => (
                    <NotificationItem 
                      key={n.id} 
                      notification={n} 
                      onClick={() => handleNotificationClick(n)} 
                      icon={getIcon(n.type, n.category)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="unread" className="m-0">
              {notifications.filter(n => !n.is_read).length === 0 ? (
                <EmptyState message="No unread notifications" />
              ) : (
                <div className="divide-y">
                  {notifications.filter(n => !n.is_read).map((n) => (
                    <NotificationItem 
                      key={n.id} 
                      notification={n} 
                      onClick={() => handleNotificationClick(n)}
                      icon={getIcon(n.type, n.category)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <div className="p-2 border-t text-center">
          <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={() => navigate('/settings')}>
            View All Settings
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function NotificationItem({ notification: n, onClick, icon }: { notification: any, onClick: () => void, icon: React.ReactNode }) {
  return (
    <div 
      className={cn(
        "p-4 flex gap-3 cursor-pointer transition-all hover:bg-accent/50 group relative overflow-hidden",
        !n.is_read && "bg-primary/5 border-l-4 border-l-primary shadow-sm"
      )}
      onClick={onClick}
    >
      <div className={cn(
        "h-9 w-9 rounded-full flex items-center justify-center shrink-0 shadow-sm",
        !n.is_read ? "bg-background border-primary/20 border" : "bg-muted"
      )}>
        {icon}
      </div>
      <div className="flex-1 space-y-1 pr-2">
        <div className="flex justify-between items-start gap-2">
          <p className={cn("text-sm font-semibold leading-none", !n.is_read ? "text-foreground" : "text-muted-foreground")}>
            {n.title}
          </p>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap bg-muted/50 px-1.5 py-0.5 rounded uppercase font-bold tracking-tighter">
            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
          </span>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {n.message}
        </p>
        {!n.is_read && (
          <div className="absolute right-2 bottom-2 h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
        )}
      </div>
    </div>
  );
}

function EmptyState({ message = "No notifications yet" }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground space-y-3">
      <div className="bg-muted p-4 rounded-full">
        <Bell className="h-10 w-10 opacity-20" />
      </div>
      <p className="text-sm font-medium">{message}</p>
      <p className="text-xs opacity-70">We'll alert you when something happens.</p>
    </div>
  );
}
