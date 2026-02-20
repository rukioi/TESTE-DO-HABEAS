import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/apiService';

interface Notification {
  id: string;
  userId: string;
  actorId?: string;
  type: 'task' | 'invoice' | 'system' | 'client' | 'project';
  title: string;
  message: string;
  payload: any;
  link?: string;
  read: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function useNotifications() {
  const queryClient = useQueryClient();
  const [ pushEnabled, setPushEnabled ] = useState<boolean>(false);

  // Fetch notifications
  const {
    data: notificationsData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiService.getNotifications({ limit: 50 }),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch unread count
  const { data: unreadData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => apiService.getUnreadCount(),
    refetchInterval: 15000, // Refetch every 15 seconds
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await apiService.get('/settings/notifications');
        if (!mounted) return;
        const n = res?.notifications || {};
        setPushEnabled(!!n.pushNotifications);
        const hasAPI = typeof window !== 'undefined' && 'Notification' in window;
        if (n.pushNotifications && hasAPI && (window as any).Notification.permission === 'default') {
          try { await (window as any).Notification.requestPermission(); } catch {}
        }
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);

  // Mutations
  const createNotificationMutation = useMutation({
    mutationFn: (data: any) => apiService.createNotification(data),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      try {
        const hasAPI = typeof window !== 'undefined' && 'Notification' in window;
        const perm = hasAPI ? (window as any).Notification.permission : 'denied';
        if (pushEnabled && hasAPI && perm === 'granted') {
          const n = res?.notification || null;
          if (n && n.id) {
            const notified = new Set<string>((() => {
              try { return JSON.parse(localStorage.getItem('browser_notified_ids') || '[]'); } catch { return []; }
            })());
            if (!notified.has(n.id)) {
              try {
                const notif = new (window as any).Notification(n.title, { body: n.message, tag: n.id });
                notif.onclick = () => {
                  try {
                    if (n.link) window.open(n.link, '_blank'); else window.focus();
                  } catch {}
                };
              } catch {}
              notified.add(n.id);
              try { localStorage.setItem('browser_notified_ids', JSON.stringify(Array.from(notified))); } catch {}
            }
          }
        }
      } catch {}
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => apiService.markNotificationAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => apiService.markAllNotificationsAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteNotification(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const notifications = notificationsData?.notifications || [];
  const unreadCount = unreadData?.unreadCount || 0;

  useEffect(() => {
    try {
      const hasAPI = typeof window !== 'undefined' && 'Notification' in window;
      const perm = hasAPI ? (window as any).Notification.permission : 'denied';
      if (!pushEnabled || !hasAPI || perm !== 'granted') return;
      const notifiedIdsArr = (() => { try { return JSON.parse(localStorage.getItem('browser_notified_ids') || '[]'); } catch { return []; } })();
      const notifiedIds = new Set<string>(Array.isArray(notifiedIdsArr) ? notifiedIdsArr : []);
      for (const n of notifications as any[]) {
        if (!n.read && !notifiedIds.has(n.id)) {
          try {
            const notif = new (window as any).Notification(n.title, { body: n.message, tag: n.id });
            notif.onclick = () => {
              try { if (n.link) window.open(n.link, '_blank'); else window.focus(); } catch {}
            };
          } catch {}
          notifiedIds.add(n.id);
        }
      }
      try { localStorage.setItem('browser_notified_ids', JSON.stringify(Array.from(notifiedIds))); } catch {}
    } catch {}
  }, [ notifications, pushEnabled ]);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    createNotification: createNotificationMutation.mutate,
    markAsRead: markAsReadMutation.mutate,
    markAllAsRead: markAllAsReadMutation.mutate,
    deleteNotification: deleteNotificationMutation.mutate,
    refetch: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  };
}
