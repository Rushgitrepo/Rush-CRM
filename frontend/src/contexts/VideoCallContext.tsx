import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getSocket } from '@/hooks/useRealtime';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────
export type CallState = 'idle' | 'outgoing' | 'incoming' | 'connecting' | 'connected';
export type CallType = 'video' | 'audio';

interface CallPeer {
  userId: string;
  name: string;
  avatar: string | null;
}

interface RemotePeer extends CallPeer {
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  stream: MediaStream | null;
}

interface Reaction {
  id: string;
  userId: string;
  emoji: string;
  userName: string;
}

interface VideoCallState {
  callState: CallState;
  callType: CallType;
  callId: string | null;
  roomId: string | null;
  peers: Record<string, RemotePeer>;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  callDuration: number;
  reactions: Reaction[];
  callStatus: string | null;
  isGroupCall: boolean;
}

interface VideoCallContextType extends VideoCallState {
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  startCall: (targetUserId: string, targetName: string, targetAvatar: string | null, callType: CallType) => void;
  joinRoom: (roomId: string, callType: CallType) => void;
  acceptCall: () => void;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => void;
  sendReaction: (emoji: string) => void;
  inviteToCall: (targetUserId: string) => void;
}

const VideoCallContext = createContext<VideoCallContextType | undefined>(undefined);

// STUN/TURN servers for NAT traversal
// TURN is required for production behind NAT/reverse proxy — STUN alone only works on local networks
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  {
    urls: [
      'turn:rms.rushcorporation.com:3478',
      'turn:rms.rushcorporation.com:3478?transport=tcp',
    ],
    username: import.meta.env.VITE_TURN_USERNAME || '',
    credential: import.meta.env.VITE_TURN_CREDENTIAL || '',
  },
];

export function VideoCallProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();

  const [state, setState] = useState<VideoCallState>({
    callState: 'idle',
    callType: 'video',
    callId: null,
    roomId: null,
    peers: {},
    isMuted: false,
    isVideoOff: false,
    isScreenSharing: false,
    callDuration: 0,
    reactions: [],
    callStatus: null,
    isGroupCall: false,
  });

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const callTimerRef = useRef<number | null>(null);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const incomingRingtoneRef = useRef<HTMLAudioElement | null>(null);
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const callStateRef = useRef(state.callState);

  useEffect(() => {
    callStateRef.current = state.callState;
  }, [state.callState]);

  useEffect(() => {
    ringtoneRef.current = new Audio('/dial_tone.mp3');
    ringtoneRef.current.loop = true;
    ringtoneRef.current.volume = 0.4;

    incomingRingtoneRef.current = new Audio('/skype_ring.mp3');
    incomingRingtoneRef.current.loop = true;
    incomingRingtoneRef.current.volume = 0.5;

    return () => {
      ringtoneRef.current?.pause();
      incomingRingtoneRef.current?.pause();
    };
  }, []);

  const playRingtone = useCallback((type: 'incoming' | 'outgoing') => {
    if (type === 'incoming') {
      incomingRingtoneRef.current?.play().catch(err => console.debug('[Audio] Play incoming failed:', err));
    } else {
      ringtoneRef.current?.play().catch(err => console.debug('[Audio] Play outgoing failed:', err));
    }
  }, []);

  const stopRingtone = useCallback(() => {
    ringtoneRef.current?.pause();
    if (ringtoneRef.current) ringtoneRef.current.currentTime = 0;
    incomingRingtoneRef.current?.pause();
    if (incomingRingtoneRef.current) incomingRingtoneRef.current.currentTime = 0;
  }, []);

  const startCallTimer = useCallback(() => {
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    setState(prev => ({ ...prev, callDuration: 0 }));
    callTimerRef.current = window.setInterval(() => {
      setState(prev => ({ ...prev, callDuration: prev.callDuration + 1 }));
    }, 1000);
  }, []);

  const stopCallTimer = useCallback(() => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
  }, []);

  const cleanupMedia = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);

    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    setScreenStream(null);

    peerConnectionsRef.current.forEach(pc => pc.close());
    peerConnectionsRef.current.clear();
    remoteStreamsRef.current.clear();
    pendingCandidatesRef.current.clear();
  }, []);

  const resetCallState = useCallback(() => {
    stopRingtone();
    stopCallTimer();
    cleanupMedia();
    setState({
      callState: 'idle',
      callType: 'video',
      callId: null,
      roomId: null,
      peers: {},
      isMuted: false,
      isVideoOff: false,
      isScreenSharing: false,
      callDuration: 0,
      reactions: [],
      callStatus: null,
      isGroupCall: false,
    });
  }, [stopRingtone, stopCallTimer, cleanupMedia]);

  const getUserMedia = useCallback(async (callType: CallType) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'video',
      });

      stream.getAudioTracks().forEach(t => { t.enabled = !state.isMuted; });
      stream.getVideoTracks().forEach(t => { t.enabled = !state.isVideoOff; });

      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error('[WebRTC] Media access failed:', error);
      toast.error('Could not access camera/microphone.');
      throw error;
    }
  }, [state.isMuted, state.isVideoOff]);

  const createPeerConnection = useCallback((targetUserId: string) => {
    const socket = getSocket();
    if (!socket) return null;

    if (peerConnectionsRef.current.has(targetUserId)) {
      peerConnectionsRef.current.get(targetUserId)?.close();
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peerConnectionsRef.current.set(targetUserId, pc);

    pc.ontrack = (event) => {
      let remoteMs = remoteStreamsRef.current.get(targetUserId);
      if (!remoteMs) {
        remoteMs = new MediaStream();
        remoteStreamsRef.current.set(targetUserId, remoteMs);
      }
      if (!remoteMs.getTracks().find(t => t.id === event.track.id)) {
        remoteMs.addTrack(event.track);
      }

      setState(prev => {
        const newState = {
          ...prev,
          peers: {
            ...prev.peers,
            [targetUserId]: {
              ...prev.peers[targetUserId],
              stream: new MediaStream(remoteMs!.getTracks()),
            }
          }
        };

        // Fallback: If we receive tracks, we are effectively connected
        if (callStateRef.current === 'connecting' || callStateRef.current === 'outgoing') {
          newState.callState = 'connected';
          newState.callStatus = null;
        }

        return newState;
      });

      // Start timer if transitioning to connected
      if (callStateRef.current === 'connecting' || callStateRef.current === 'outgoing') {
        startCallTimer();
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && state.callId) {
        socket.emit('call:ice-candidate', {
          callId: state.callId,
          targetUserId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        if (callStateRef.current !== 'connected') {
          setState(prev => ({ ...prev, callState: 'connected', callStatus: null }));
          startCallTimer();
        }
      }
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current!));
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => pc.addTrack(track, screenStreamRef.current!));
    }

    return pc;
  }, [state.callId, startCallTimer]);

  const toggleScreenShare = useCallback(async () => {
    const socket = getSocket();
    if (state.isScreenSharing) {
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
      setScreenStream(null);
      setState(prev => ({ ...prev, isScreenSharing: false }));
      socket?.emit('call:toggle-media', { callId: state.callId, mediaType: 'screen', enabled: false });

      if (localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        peerConnectionsRef.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender && videoTrack) sender.replaceTrack(videoTrack).catch(e => console.error(e));
        });
      }
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: { echoCancellation: true, noiseSuppression: true }
        });
        screenStreamRef.current = stream;
        setScreenStream(stream);
        setState(prev => ({ ...prev, isScreenSharing: true }));
        socket?.emit('call:toggle-media', { callId: state.callId, mediaType: 'screen', enabled: true });

        const videoTrack = stream.getVideoTracks()[0];
        peerConnectionsRef.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender && videoTrack) sender.replaceTrack(videoTrack).catch(e => console.error(e));
        });

        videoTrack.onended = () => {
          if (screenStreamRef.current === stream) {
            toggleScreenShare();
          }
        };
      } catch (err) {
        console.error('[WebRTC] Screen share failed:', err);
      }
    }
  }, [state.isScreenSharing, state.callId]);

  const joinRoom = useCallback(async (roomId: string, callType: CallType) => {
    const socket = getSocket();
    if (!socket || !profile) return;

    const callId = `room_${roomId}`;
    setState(prev => ({
      ...prev,
      callState: 'connecting',
      callType,
      callId,
      roomId,
      peers: {},
      isMuted: false,
      isVideoOff: false,
      isGroupCall: true,
      callStatus: null,
    }));

    try {
      await getUserMedia(callType);
      socket.emit('call:join-room', { roomId: callId, userId: user?.id, name: profile.full_name, avatar: profile.avatar_url });
    } catch (err) {
      resetCallState();
    }
  }, [profile, user?.id, getUserMedia, resetCallState]);

  const sendReaction = useCallback((emoji: string) => {
    if (!state.callId || !profile) return;
    const socket = getSocket();
    const reaction: Reaction = {
      id: Math.random().toString(36).slice(2, 9),
      userId: user?.id || '',
      userName: profile.full_name || 'User',
      emoji,
    };
    socket?.emit('call:reaction', { callId: state.callId, reaction });
    setState(prev => ({ ...prev, reactions: [...prev.reactions, reaction] }));
    setTimeout(() => {
      setState(prev => ({ ...prev, reactions: prev.reactions.filter(r => r.id !== reaction.id) }));
    }, 5000);
  }, [state.callId, profile, user?.id]);

  const startCall = useCallback(async (targetUserId: string, targetName: string, targetAvatar: string | null, callType: CallType, forceGroupCall: boolean = false) => {
    if (callStateRef.current !== 'idle') return;
    const socket = getSocket();
    if (!socket || !profile) return;

    const callId = `call_${Date.now()}`;
    setState(prev => ({
      ...prev,
      callState: 'outgoing',
      callType,
      callId,
      isGroupCall: forceGroupCall,
      callStatus: null,
      peers: {
        [targetUserId]: { userId: targetUserId, name: targetName, avatar: targetAvatar, isMuted: false, isVideoOff: false, isScreenSharing: false, stream: null }
      }
    }));

    playRingtone('outgoing');
    try {
      await getUserMedia(callType);
      socket.emit('call:initiate', { callId, targetUserId, callerName: profile.full_name, callerAvatar: profile.avatar_url, callType, isGroupCall: forceGroupCall });
      socket.emit('call:join-room', { roomId: callId, userId: user?.id, name: profile.full_name, avatar: profile.avatar_url });
    } catch (err) { resetCallState(); }
  }, [profile, user?.id, playRingtone, getUserMedia, resetCallState]);

  const acceptCall = useCallback(async () => {
    if (state.callState !== 'incoming' || !state.callId) return;
    const callerId = Object.keys(state.peers)[0];
    const socket = getSocket();
    if (!socket || !callerId || !profile) return;

    stopRingtone();
    setState(prev => ({ ...prev, callState: 'connecting', callStatus: null }));
    try {
      await getUserMedia(state.callType);
      socket.emit('call:accept', { callId: state.callId, callerId, accepterName: profile.full_name, accepterAvatar: profile.avatar_url });
      socket.emit('call:join-room', { roomId: state.callId, userId: user?.id, name: profile.full_name, avatar: profile.avatar_url });
    } catch (err) { resetCallState(); }
  }, [state.callId, state.callState, state.peers, state.callType, profile, user?.id, stopRingtone, getUserMedia, resetCallState]);

  const rejectCall = useCallback(() => {
    if (state.callState !== 'incoming' || !state.callId) return;
    const callerId = Object.keys(state.peers)[0];
    getSocket()?.emit('call:reject', { callId: state.callId, callerId, reason: 'declined' });
    resetCallState();
  }, [state.callId, state.callState, state.peers, resetCallState]);

  const endCall = useCallback(() => {
    const socket = getSocket();
    if (state.callId) {
      const peerIds = Object.keys(state.peers);
      socket?.emit('call:end', { callId: state.callId, targetUserId: peerIds.length === 1 ? peerIds[0] : undefined, reason: 'hangup' });
    }
    resetCallState();
  }, [state.callId, state.peers, resetCallState]);

  const toggleMute = useCallback(() => {
    const newState = !state.isMuted;
    setState(prev => ({ ...prev, isMuted: newState }));
    localStreamRef.current?.getAudioTracks().forEach(t => t.enabled = !newState);
    getSocket()?.emit('call:toggle-media', { callId: state.callId, mediaType: 'audio', enabled: !newState });
  }, [state.isMuted, state.callId]);

  const toggleVideo = useCallback(() => {
    const newState = !state.isVideoOff;
    setState(prev => ({ ...prev, isVideoOff: newState }));
    localStreamRef.current?.getVideoTracks().forEach(t => t.enabled = !newState);
    getSocket()?.emit('call:toggle-media', { callId: state.callId, mediaType: 'video', enabled: !newState });
  }, [state.isVideoOff, state.callId]);

  const inviteToCall = useCallback((targetUserId: string) => {
    if (!state.callId) return;
    getSocket()?.emit('call:initiate', {
      callId: state.callId,
      targetUserId,
      callerName: profile?.full_name || 'User',
      callerAvatar: profile?.avatar_url || null,
      callType: state.callType,
    });
    toast.success('Invitation sent');
  }, [state.callId, state.callType, profile]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleIncoming = (p: any) => {
      if (callStateRef.current !== 'idle') {
        socket.emit('call:reject', { callId: p.callId, callerId: p.callerId, reason: 'busy' });
        return;
      }
      setState(prev => ({
        ...prev,
        callState: 'incoming',
        callType: p.callType,
        callId: p.callId,
        isGroupCall: p.isGroupCall || false,
        callStatus: null,
        peers: { [p.callerId]: { userId: p.callerId, name: p.callerName, avatar: p.callerAvatar, isMuted: false, isVideoOff: false, isScreenSharing: false, stream: null } }
      }));
      playRingtone('incoming');
    };

    const handleUserJoined = async (p: any) => {
      if (!callStateRef.current.includes('connected') && callStateRef.current !== 'connecting') return;
      const pc = createPeerConnection(p.userId);
      if (!pc) return;
      setState(prev => ({ ...prev, peers: { ...prev.peers, [p.userId]: { userId: p.userId, name: p.name, avatar: p.avatar, isMuted: false, isVideoOff: false, isScreenSharing: false, stream: null } } }));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('call:offer', { callId: state.callId, targetUserId: p.userId, sdp: offer });
    };

    const flushIceCandidates = async (userId: string, pc: RTCPeerConnection) => {
      const pending = pendingCandidatesRef.current.get(userId);
      if (pending && pending.length > 0) {
        console.log(`[WebRTC] Flushing ${pending.length} pending ICE candidates for ${userId}`);
        for (const candidate of pending) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.error('[WebRTC] Error adding pending ICE:', e);
          }
        }
        pendingCandidatesRef.current.delete(userId);
      }
    };

    const handleAccepted = async (p: any) => {
      if (p.callId !== state.callId) return;
      stopRingtone();
      setState(prev => ({ ...prev, callState: 'connecting', callStatus: null }));
      const pc = createPeerConnection(p.accepterId);
      if (!pc) return;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('call:offer', { callId: p.callId, targetUserId: p.accepterId, sdp: offer });
    };

    const handleOffer = async (p: any) => {
      let pc = peerConnectionsRef.current.get(p.fromUserId);
      if (!pc) pc = createPeerConnection(p.fromUserId)!;
      if (!pc) return;
      
      try {
        if (pc.signalingState === 'stable') {
          await pc.setRemoteDescription(new RTCSessionDescription(p.sdp));
          await flushIceCandidates(p.fromUserId, pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('call:answer', { callId: p.callId, targetUserId: p.fromUserId, sdp: answer });
        }
      } catch (err) {
        console.error('[WebRTC] handleOffer error:', err);
      }
    };

    const handleAnswer = async (p: any) => {
      if (p.callId !== state.callId) return;
      const pc = peerConnectionsRef.current.get(p.fromUserId);
      if (pc && pc.signalingState === 'have-local-offer') {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(p.sdp));
          await flushIceCandidates(p.fromUserId, pc);
        } catch (err) {
          console.error('[WebRTC] handleAnswer error:', err);
        }
      }
    };

    const handleIce = async (p: any) => {
      if (p.callId !== state.callId) return;
      const pc = peerConnectionsRef.current.get(p.fromUserId);
      if (pc && pc.remoteDescription && pc.signalingState !== 'closed') {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(p.candidate));
        } catch (e) {
          console.error('[WebRTC] Error adding ICE candidate:', e);
        }
      } else {
        const pending = pendingCandidatesRef.current.get(p.fromUserId) || [];
        pending.push(p.candidate);
        pendingCandidatesRef.current.set(p.fromUserId, pending);
      }
    };

    const handleToggleMedia = (p: any) => {
      setState(prev => {
        const peer = prev.peers[p.fromUserId];
        if (!peer) return prev;
        const updates: Partial<RemotePeer> = {};
        if (p.mediaType === 'audio') updates.isMuted = !p.enabled;
        if (p.mediaType === 'video') updates.isVideoOff = !p.enabled;
        if (p.mediaType === 'screen') updates.isScreenSharing = p.enabled;
        return { ...prev, peers: { ...prev.peers, [p.fromUserId]: { ...peer, ...updates } } };
      });
    };

    const handleReaction = (p: any) => {
      setState(prev => ({ ...prev, reactions: [...prev.reactions, p.reaction] }));
      setTimeout(() => setState(prev => ({ ...prev, reactions: prev.reactions.filter(r => r.id !== p.reaction.id) })), 5000);
    };

    const handleUserLeft = (p: any) => {
      setState(prev => {
        const newPeers = { ...prev.peers };
        delete newPeers[p.userId];
        return { ...prev, peers: newPeers };
      });
      peerConnectionsRef.current.get(p.userId)?.close();
      peerConnectionsRef.current.delete(p.userId);
    };

    const handleEnd = (p: any) => { if (p.callId === state.callId) resetCallState(); };
    const handleRejected = (p: any) => {
      if (p.callId !== state.callId) return;
      stopRingtone();
      const reason = p.reason === 'busy' ? 'Busy' : 'Declined';
      setState(prev => ({ ...prev, callStatus: reason }));
      toast.error(`Call ${reason.toLowerCase()}`);
      setTimeout(() => {
        resetCallState();
      }, 3000);
    };

    socket.on('call:incoming', handleIncoming);
    socket.on('call:user-joined', handleUserJoined);
    socket.on('call:accepted', handleAccepted);
    socket.on('call:offer', handleOffer);
    socket.on('call:answer', handleAnswer);
    socket.on('call:ice-candidate', handleIce);
    socket.on('call:toggle-media', handleToggleMedia);
    socket.on('call:reaction', handleReaction);
    socket.on('call:user-left', handleUserLeft);
    socket.on('call:end', handleEnd);
    socket.on('call:rejected', handleRejected);

    return () => {
      socket.off('call:incoming', handleIncoming);
      socket.off('call:user-joined', handleUserJoined);
      socket.off('call:accepted', handleAccepted);
      socket.off('call:offer', handleOffer);
      socket.off('call:answer', handleAnswer);
      socket.off('call:ice-candidate', handleIce);
      socket.off('call:toggle-media', handleToggleMedia);
      socket.off('call:reaction', handleReaction);
      socket.off('call:user-left', handleUserLeft);
      socket.off('call:end', handleEnd);
    };
  }, [state.callId, playRingtone, createPeerConnection, resetCallState, stopRingtone]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      resetCallState();
    };
  }, []);

  return (
    <VideoCallContext.Provider
      value={{
        ...state,
        localStream,
        screenStream,
        startCall,
        joinRoom,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleVideo,
        toggleScreenShare,
        sendReaction,
        inviteToCall,
      }}
    >
      {children}
    </VideoCallContext.Provider>
  );
}

export function useVideoCall() {
  const context = useContext(VideoCallContext);
  if (context === undefined) {
    throw new Error('useVideoCall must be used within a VideoCallProvider');
  }
  return context;
}
