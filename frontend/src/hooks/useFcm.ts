import { useEffect } from 'react';
import { requestForToken, onMessageListener } from '@/lib/firebase';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export const useFcm = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const setupFCM = async () => {
      // 1. Request permission and get token
      const token = await requestForToken();
      
      if (token) {
        // 2. Register token on backend
        try {
          await api.post('/push/fcm/register', {
            token,
            deviceType: 'web'
          });
          console.log('FCM token registered successfully');
        } catch (error) {
          console.error('Failed to register FCM token:', error);
        }
      }
    };

    setupFCM();

    // 3. Listen for foreground messages
    const listenForMessages = async () => {
      try {
        const payload: any = await onMessageListener();
        if (payload) {
          toast(payload.notification?.title || 'New Notification', {
            description: payload.notification?.body,
            action: payload.data?.action_url ? {
              label: 'View',
              onClick: () => window.location.href = payload.data.action_url
            } : undefined
          });
        }
        // Recursively listen again
        listenForMessages();
      } catch (error) {
        console.error('Error listening for FCM messages:', error);
      }
    };

    listenForMessages();
  }, [user]);
};
