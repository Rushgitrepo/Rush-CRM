import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';

// Global Socket Instance
let socketInstance: Socket | null = null;
let connectionCount = 0;
let workgroupToastListenerAttached = false;

export const getSocket = (): Socket | null => {
  if (socketInstance) return socketInstance;
  
  const token = localStorage.getItem('token');
  if (!token) return null;

  socketInstance = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
  });

  socketInstance.on('connect', () => {
    console.log('✅ Global WebSocket connected');
  });

  socketInstance.on('disconnect', () => {
    console.log('❌ Global WebSocket disconnected');
  });

  socketInstance.on('connect_error', (error) => {
    console.error('WebSocket connection error:', error);
  });

  if (!workgroupToastListenerAttached) {
    socketInstance.on('workgroup_post:new', (message: any) => {
      const path = window.location.pathname;
      const isOnWorkgroupsScreen = path.startsWith('/collaboration/workgroups');
      if (isOnWorkgroupsScreen) return;

      const author = message?.author_name || 'Team member';
      const content = String(message?.content || '').replace('[SYSTEM] ', '');
      if (!content.trim()) return;

      toast(`${author}: ${content}`, {
        duration: 3500,
        position: 'bottom-right',
      });
    });
    workgroupToastListenerAttached = true;
  }

  return socketInstance;
};

export const closeSocket = () => {
  if (socketInstance && connectionCount <= 0) {
    socketInstance.disconnect();
    socketInstance = null;
  }
};

export function useRealtime() {
  const [isConnected, setIsConnected] = useState(socketInstance?.connected || false);
  const socket = getSocket();

  useEffect(() => {
    if (!socket) return;
    
    connectionCount++;
    setIsConnected(socket.connected);

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      connectionCount--;
      if (connectionCount === 0) closeSocket();
    };
  }, [socket]);

  const subscribeToCampaign = (campaignId: string) => {
    socket?.emit('subscribe:campaign', campaignId);
  };

  const unsubscribeFromCampaign = (campaignId: string) => {
    socket?.emit('unsubscribe:campaign', campaignId);
  };

  const subscribeToAnalytics = () => {
    socket?.emit('subscribe:analytics');
  };

  const subscribeToWorkgroup = (workgroupId: string) => {
    socket?.emit('subscribe:workgroup', workgroupId);
  };

  const unsubscribeFromWorkgroup = (workgroupId: string) => {
    socket?.emit('unsubscribe:workgroup', workgroupId);
  };

  const on = (event: string, callback: (...args: any[]) => void) => {
    socket?.on(event, callback);
  };

  const off = (event: string, callback?: (...args: any[]) => void) => {
    socket?.off(event, callback);
  };

  return {
    socket,
    isConnected,
    subscribeToCampaign,
    unsubscribeFromCampaign,
    subscribeToAnalytics,
    subscribeToWorkgroup,
    unsubscribeFromWorkgroup,
    on,
    off,
  };
}

// Hook for campaign real-time stats
export function useCampaignRealtime(campaignId: string) {
  const { subscribeToCampaign, unsubscribeFromCampaign, on, off } = useRealtime();
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (!campaignId) return;

    subscribeToCampaign(campaignId);

    const handleStats = (data: any) => {
      setStats(data);
    };

    const handleOpened = (data: any) => {
      setStats((prev: any) => prev ? { ...prev, opened_count: prev.opened_count + 1 } : null);
    };

    const handleClicked = (data: any) => {
      setStats((prev: any) => prev ? { ...prev, clicked_count: prev.clicked_count + 1 } : null);
    };

    on('campaign:stats', handleStats);
    on('campaign:opened', handleOpened);
    on('campaign:clicked', handleClicked);

    return () => {
      unsubscribeFromCampaign(campaignId);
      off('campaign:stats', handleStats);
      off('campaign:opened', handleOpened);
      off('campaign:clicked', handleClicked);
    };
  }, [campaignId]);

  return stats;
}

// Hook for drive real-time updates
export function useDriveRealtime(onUpdate: (data: any) => void) {
  const { on, off } = useRealtime();

  useEffect(() => {
    on('drive:update', onUpdate);
    return () => {
      off('drive:update', onUpdate);
    };
  }, [onUpdate]);
}

// Hook for analytics real-time updates
export function useAnalyticsRealtime() {
  const { subscribeToAnalytics, on, off } = useRealtime();
  const [metrics, setMetrics] = useState<Record<string, any>>({});

  useEffect(() => {
    subscribeToAnalytics();

    const handleUpdate = (data: any) => {
      setMetrics((prev) => ({ ...prev, ...data }));
    };

    const handleMetric = (data: any) => {
      setMetrics((prev) => ({ ...prev, [data.metric]: data.value }));
    };

    on('analytics:update', handleUpdate);
    on('metric:update', handleMetric);

    return () => {
      off('analytics:update', handleUpdate);
      off('metric:update', handleMetric);
    };
  }, []);

  return metrics;
}

// Hook for direct messaging real-time updates
export function useDirectMessageRealtime(onMessage: (message: any) => void) {
  const { on, off } = useRealtime();

  useEffect(() => {
    on('direct_message:new', onMessage);
    return () => {
      off('direct_message:new', onMessage);
    };
  }, [onMessage]);
}

// Hook for workgroup real-time updates
export function useWorkgroupRealtime(workgroupId: string, onMessage: (message: any) => void, onReaction?: (data: any) => void) {
  const { subscribeToWorkgroup, unsubscribeFromWorkgroup, on, off } = useRealtime();

  useEffect(() => {
    if (!workgroupId) return;

    subscribeToWorkgroup(workgroupId);
    on('workgroup_post:new', onMessage);
    if(onReaction) on('reaction:added', onReaction);

    return () => {
      unsubscribeFromWorkgroup(workgroupId);
      off('workgroup_post:new', onMessage);
      if(onReaction) off('reaction:added', onReaction);
    };
  }, [workgroupId, onMessage, onReaction]);
}

// Hook for mentions and broadcasts
export function useCollaborationNotifications(onMention: (notification: any) => void, onBroadcast: (notification: any) => void) {
  const { on, off } = useRealtime();

  useEffect(() => {
    on('mention:new', onMention);
    on('broadcast:new', onBroadcast);

    return () => {
      off('mention:new', onMention);
      off('broadcast:new', onBroadcast);
    };
  }, [onMention, onBroadcast]);
}
