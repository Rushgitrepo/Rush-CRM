import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getSocket } from "@/hooks/useRealtime";
import { toast } from "sonner";
import { getAvatarUrl } from "@/lib/utils";
import { fireRushNotification } from "@/components/ui/RushNotification";

// ─── Types ───────────────────────────────────────────────
export type CallState =
  | "idle"
  | "outgoing"
  | "incoming"
  | "connecting"
  | "connected";
export type CallType = "video" | "audio";

interface CallPeer {
  userId: string;
  name: string;
  avatar: string | null;
}

interface RemotePeer extends CallPeer {
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isModerator?: boolean;
  stream: MediaStream | null;
}

interface Reaction {
  id: string;
  userId: string;
  emoji: string;
  userName: string;
}

export interface CallMessage {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  text: string;
  timestamp: string;
  targetUserId?: string; // If present, it's a private message
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
  workgroupId: string | null;
  isOutgoing: boolean;
  groupName: string | null;
  groupAvatar: string | null;
  callMessages: CallMessage[];
}

interface VideoCallContextType extends VideoCallState {
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  startCall: (
    targetUserId: string,
    targetName: string,
    targetAvatar: string | null,
    callType: CallType,
    workgroupId: string,
    forceGroupCall?: boolean,
    isModerator?: boolean,
  ) => void;
  joinRoom: (roomId: string, callType: CallType) => void;
  acceptCall: () => void;
  rejectCall: () => void;
  endCall: (endForAll?: boolean) => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => void;
  sendReaction: (emoji: string) => void;
  inviteToCall: (
    targetUserId: string,
    targetName?: string,
    targetAvatar?: string | null,
  ) => void;
  sendCallMessage: (text: string, targetUserId?: string) => void;
}

const VideoCallContext = createContext<VideoCallContextType | undefined>(
  undefined,
);

// STUN/TURN servers for NAT traversal
// TURN is required for production behind NAT/reverse proxy — STUN alone only works on local networks
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  {
    urls: [
      "turn:rms.rushcorporation.com:3478",
      "turn:rms.rushcorporation.com:3478?transport=tcp",
    ],
    username: import.meta.env.VITE_TURN_USERNAME || "",
    credential: import.meta.env.VITE_TURN_CREDENTIAL || "",
  },
];

export function VideoCallProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();

  const [state, setState] = useState<VideoCallState>({
    callState: "idle",
    callType: "video",
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
    workgroupId: null,
    isOutgoing: false,
    groupName: null,
    groupAvatar: null,
    callMessages: [],
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
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(
    new Map(),
  );
  const loggedCallsRef = useRef<Set<string>>(new Set());
  const callStateRef = useRef(state.callState);
  const stateRef = useRef(state);

  useEffect(() => {
    callStateRef.current = state.callState;
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    ringtoneRef.current = new Audio("/dial_tone.mp3");
    ringtoneRef.current.loop = true;
    ringtoneRef.current.volume = 0.4;

    incomingRingtoneRef.current = new Audio("/skype_ring.mp3");
    incomingRingtoneRef.current.loop = true;
    incomingRingtoneRef.current.volume = 0.5;

    return () => {
      ringtoneRef.current?.pause();
      incomingRingtoneRef.current?.pause();
    };
  }, []);

  const playRingtone = useCallback((type: "incoming" | "outgoing") => {
    // If we are in Electron and it's an incoming call, we let the overlay handle the ringtone
    // to avoid double audio (one from main window, one from overlay).
    // @ts-ignore
    if (type === "incoming" && window.electronAPI?.isElectron) {
      return;
    }

    if (type === "incoming") {
      incomingRingtoneRef.current
        ?.play()
        .catch((err) => console.debug("[Audio] Play incoming failed:", err));
    } else {
      ringtoneRef.current
        ?.play()
        .catch((err) => console.debug("[Audio] Play outgoing failed:", err));
    }
  }, []);

  const stopRingtone = useCallback(() => {
    ringtoneRef.current?.pause();
    if (ringtoneRef.current) ringtoneRef.current.currentTime = 0;
    incomingRingtoneRef.current?.pause();
    if (incomingRingtoneRef.current)
      incomingRingtoneRef.current.currentTime = 0;
  }, []);

  const startCallTimer = useCallback(() => {
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    setState((prev) => ({ ...prev, callDuration: 0 }));
    callTimerRef.current = window.setInterval(() => {
      setState((prev) => ({ ...prev, callDuration: prev.callDuration + 1 }));
    }, 1000);
  }, []);

  const stopCallTimer = useCallback(() => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
  }, []);

  const cleanupMedia = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);

    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    setScreenStream(null);

    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();
    remoteStreamsRef.current.clear();
    pendingCandidatesRef.current.clear();
  }, []);

  const resetCallState = useCallback(() => {
    console.log("[WebRTC] Resetting call state...");
    stopRingtone();
    stopCallTimer();
    cleanupMedia();
    loggedCallsRef.current.clear();

    // Close electron call overlay if it's open
    // @ts-ignore
    window.electronAPI?.closeIncomingCall?.();

    setState({
      callState: "idle",
      callType: "video",
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
      workgroupId: null,
      isOutgoing: false,
      groupName: null,
      groupAvatar: null,
      callMessages: [],
    });
  }, [stopRingtone, stopCallTimer, cleanupMedia]);

  const getUserMedia = useCallback(
    async (callType: CallType) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: callType === "video",
        });

        stream.getAudioTracks().forEach((t) => {
          t.enabled = !state.isMuted;
        });
        stream.getVideoTracks().forEach((t) => {
          t.enabled = !state.isVideoOff;
        });

        localStreamRef.current = stream;
        setLocalStream(stream);
        return stream;
      } catch (error) {
        console.error("[WebRTC] Media access failed:", error);
        toast.error("Could not access camera/microphone.");
        throw error;
      }
    },
    [state.isMuted, state.isVideoOff],
  );

  const createPeerConnection = useCallback(
    (targetUserId: string) => {
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
        if (!remoteMs.getTracks().find((t) => t.id === event.track.id)) {
          remoteMs.addTrack(event.track);
        }

        // Use the live MediaStream reference directly so new tracks are picked up automatically
        const liveStream = remoteMs;

        setState((prev) => {
          const newState = {
            ...prev,
            peers: {
              ...prev.peers,
              [targetUserId]: {
                ...prev.peers[targetUserId],
                stream: new MediaStream(remoteMs.getTracks()),
                // When we receive a video track, mark video as on
                isVideoOff:
                  event.track.kind === "video"
                    ? false
                    : (prev.peers[targetUserId]?.isVideoOff ?? true),
              },
            },
          };

          // Fallback: If we receive tracks, we are effectively connected
          if (
            callStateRef.current === "connecting" ||
            callStateRef.current === "outgoing"
          ) {
            newState.callState = "connected";
            newState.callStatus = null;
          }

          return newState;
        });

        // Start timer if transitioning to connected
        if (
          callStateRef.current === "connecting" ||
          callStateRef.current === "outgoing"
        ) {
          startCallTimer();
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && state.callId) {
          socket.emit("call:ice-candidate", {
            callId: state.callId,
            targetUserId,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (
          pc.iceConnectionState === "connected" ||
          pc.iceConnectionState === "completed"
        ) {
          if (callStateRef.current !== "connected") {
            setState((prev) => ({
              ...prev,
              callState: "connected",
              callStatus: null,
            }));
            startCallTimer();
          }
        }
      };

      if (localStreamRef.current) {
        localStreamRef.current
          .getTracks()
          .forEach((track) => pc.addTrack(track, localStreamRef.current!));
      }
      if (screenStreamRef.current) {
        screenStreamRef.current
          .getTracks()
          .forEach((track) => pc.addTrack(track, screenStreamRef.current!));
      }

      return pc;
    },
    [state.callId, startCallTimer],
  );

  const toggleScreenShare = useCallback(async () => {
    const socket = getSocket();
    if (state.isScreenSharing) {
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
      setScreenStream(null);
      setState((prev) => ({ ...prev, isScreenSharing: false }));
      socket?.emit("call:toggle-media", {
        callId: state.callId,
        mediaType: "screen",
        enabled: false,
      });

      const videoTrack = localStreamRef.current?.getVideoTracks()[0];
      peerConnectionsRef.current.forEach(async (pc, peerId) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        try {
          if (sender && videoTrack) {
            await sender.replaceTrack(videoTrack);
          } else if (sender && !videoTrack) {
            // No camera to fall back to, remove the screen track sender
            pc.removeTrack(sender);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket?.emit("call:offer", {
              callId: stateRef.current.callId,
              targetUserId: peerId,
              sdp: offer,
            });
          }
        } catch (e) {
          console.error("[WebRTC] Error stopping screen share:", e);
        }
      });
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        screenStreamRef.current = stream;
        setScreenStream(stream);
        setState((prev) => ({ ...prev, isScreenSharing: true }));
        socket?.emit("call:toggle-media", {
          callId: state.callId,
          mediaType: "screen",
          enabled: true,
        });

        const videoTrack = stream.getVideoTracks()[0];
        if (!videoTrack) return;

        peerConnectionsRef.current.forEach(async (pc, peerId) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          try {
            if (sender) {
              await sender.replaceTrack(videoTrack);
            } else {
              pc.addTrack(videoTrack, stream);
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              socket?.emit("call:offer", {
                callId: stateRef.current.callId,
                targetUserId: peerId,
                sdp: offer,
              });
            }
          } catch (e) {
            console.error("[WebRTC] Error starting screen share:", e);
          }
        });

        videoTrack.onended = () => {
          if (screenStreamRef.current === stream) {
            toggleScreenShare();
          }
        };
      } catch (err) {
        console.error("[WebRTC] Screen share failed:", err);
      }
    }
  }, [state.isScreenSharing, state.callId]);

  const logCall = useCallback(
    async (
      workgroupId: string,
      callType: CallType,
      status: "missed" | "completed" | "rejected",
      duration: number,
      callerId: string,
    ) => {
      if (!workgroupId || !state.callId) return;

      // Prevent duplicate logs for the same callId
      if (loggedCallsRef.current.has(state.callId)) return;
      loggedCallsRef.current.add(state.callId);

      const callData = {
        type: callType,
        status,
        duration,
        callerId,
      };
      try {
        const { workgroupsApi } = await import("@/lib/api");
        await workgroupsApi.createPost(workgroupId, {
          content: JSON.stringify(callData),
          content_type: "call" as any,
        });
      } catch (err) {
        console.error("[WebRTC] Failed to log call:", err);
      }
    },
    [state.callId],
  );

  const joinRoom = useCallback(
    async (roomId: string, callType: CallType) => {
      const socket = getSocket();
      if (!socket || !profile) return;

      const callId = `room_${roomId}`;
      setState((prev) => ({
        ...prev,
        callState: "connecting",
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
        socket.emit("call:join-room", {
          roomId: callId,
          userId: user?.id,
          name: profile.full_name,
          avatar: profile.avatar_url,
        });
      } catch (err) {
        resetCallState();
      }
    },
    [profile, user?.id, getUserMedia, resetCallState],
  );

  const sendReaction = useCallback(
    (emoji: string) => {
      if (!state.callId || !profile) return;
      const socket = getSocket();
      const reaction: Reaction = {
        id: Math.random().toString(36).slice(2, 9),
        userId: user?.id || "",
        userName: profile.full_name || "User",
        emoji,
      };
      socket?.emit("call:reaction", { callId: state.callId, reaction });
      setState((prev) => ({
        ...prev,
        reactions: [...prev.reactions, reaction],
      }));
      setTimeout(() => {
        setState((prev) => ({
          ...prev,
          reactions: prev.reactions.filter((r) => r.id !== reaction.id),
        }));
      }, 5000);
    },
    [state.callId, profile, user?.id],
  );

  const startCall = useCallback(
    async (
      targetUserId: string,
      targetName: string,
      targetAvatar: string | null,
      callType: CallType,
      workgroupId: string,
      forceGroupCall: boolean = false,
      isModerator: boolean = false,
    ) => {
      if (callStateRef.current !== "idle") return;
      const socket = getSocket();
      if (!socket || !profile) return;

      const callId = `call_${Date.now()}`;
      const peers: Record<string, any> = {};
      if (targetUserId) {
        peers[targetUserId] = {
          userId: targetUserId,
          name: targetName,
          avatar: targetAvatar,
          isMuted: false,
          isVideoOff: false,
          isScreenSharing: false,
          stream: null,
        };
      }

      setState((prev) => ({
        ...prev,
        callState: "outgoing",
        callType,
        callId,
        workgroupId,
        isOutgoing: true,
        isGroupCall: forceGroupCall,
        callStatus: null,
        isVideoOff: callType === "audio" ? true : prev.isVideoOff,
        peers,
      }));

      playRingtone("outgoing");
      try {
        await getUserMedia(callType);
        socket.emit("call:initiate", {
          callId,
          targetUserId,
          callerName: profile.full_name,
          callerAvatar: profile.avatar_url,
          callType,
          workgroupId,
          isGroupCall: forceGroupCall,
          callerIsModerator: isModerator,
        });
        socket.emit("call:join-room", {
          roomId: callId,
          userId: user?.id,
          name: profile.full_name,
          avatar: profile.avatar_url,
        });
      } catch (err) {
        resetCallState();
      }
    },
    [profile, user?.id, playRingtone, getUserMedia, resetCallState],
  );

  const acceptCall = useCallback(async () => {
    if (state.callState !== "incoming" || !state.callId) return;
    const callerId = Object.keys(state.peers)[0];
    const socket = getSocket();
    if (!socket || !callerId || !profile) return;

    stopRingtone();
    setState((prev) => ({
      ...prev,
      callState: "connecting",
      callStatus: null,
      isVideoOff: state.callType === "audio" ? true : prev.isVideoOff,
    }));
    try {
      await getUserMedia(state.callType);
      socket.emit("call:accept", {
        callId: state.callId,
        callerId,
        accepterName: profile.full_name,
        accepterAvatar: profile.avatar_url,
      });
      socket.emit("call:join-room", {
        roomId: state.callId,
        userId: user?.id,
        name: profile.full_name,
        avatar: profile.avatar_url,
      });
    } catch (err) {
      resetCallState();
    }
  }, [
    state.callId,
    state.callState,
    state.peers,
    state.callType,
    profile,
    user?.id,
    stopRingtone,
    getUserMedia,
    resetCallState,
  ]);

  const rejectCall = useCallback(() => {
    if (state.callState !== "incoming" || !state.callId) return;
    const callerId = Object.keys(state.peers)[0];
    getSocket()?.emit("call:reject", {
      callId: state.callId,
      callerId,
      reason: "declined",
    });
    resetCallState();
  }, [state.callId, state.callState, state.peers, resetCallState]);

  const endCall = useCallback(
    (endForAll: boolean = false) => {
      const socket = getSocket();
      const currentState = stateRef.current;

      if (currentState.callId) {
        const peerIds = Object.keys(currentState.peers);
        // It's a group call if it was marked as one OR if there are currently more than 1 peers
        const isActuallyMultiParty =
          currentState.isGroupCall || peerIds.length > 1;

        // In a 1-on-1, always end for all. In a group, follow the endForAll flag.
        const effectiveEndForAll = !isActuallyMultiParty ? true : endForAll;

        if (effectiveEndForAll) {
          socket?.emit("call:end", {
            callId: currentState.callId,
            targetUserId: !isActuallyMultiParty ? peerIds[0] : undefined,
            workgroupId: currentState.workgroupId,
            isGroupCall: currentState.isGroupCall,
            isOriginalCaller: currentState.isOutgoing,
            reason: "hangup",
          });
        } else {
          // Just leaving the group call
          socket?.emit("call:user-left", {
            callId: currentState.callId,
            userId: user?.id,
            workgroupId: currentState.workgroupId,
          });
        }

        // Log call if it was connected - Only caller logs to avoid duplicates
        if (currentState.isOutgoing && currentState.workgroupId) {
          if (currentState.callState === "connected") {
            logCall(
              currentState.workgroupId,
              currentState.callType,
              "completed",
              currentState.callDuration,
              user?.id || "",
            );
          } else if (currentState.callState === "outgoing") {
            logCall(
              currentState.workgroupId,
              currentState.callType,
              "missed",
              0,
              user?.id || "",
            );
          }
        }
      }
      resetCallState();
    },
    [user?.id, logCall, resetCallState],
  );

  const toggleMute = useCallback(() => {
    const newState = !state.isMuted;
    setState((prev) => ({ ...prev, isMuted: newState }));
    localStreamRef.current
      ?.getAudioTracks()
      .forEach((t) => (t.enabled = !newState));
    getSocket()?.emit("call:toggle-media", {
      callId: state.callId,
      mediaType: "audio",
      enabled: !newState,
    });
  }, [state.isMuted, state.callId]);

  const toggleVideo = useCallback(async () => {
    const socket = getSocket();

    // Audio call upgrading to video — need to acquire video track first
    if (state.callType === "audio" && state.isVideoOff) {
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        const videoTrack = videoStream.getVideoTracks()[0];
        if (!videoTrack) return;

        // Add video track to existing local stream
        if (localStreamRef.current) {
          localStreamRef.current.addTrack(videoTrack);
        } else {
          localStreamRef.current = new MediaStream([videoTrack]);
        }

        // Update React state with new stream reference so video elements re-render
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));

        // Add/replace video track in all peer connections + renegotiate
        const renegotiations: Promise<void>[] = [];
        peerConnectionsRef.current.forEach((pc, peerId) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          const renegotiate = async () => {
            try {
              if (sender) {
                await sender.replaceTrack(videoTrack);
              } else {
                pc.addTrack(videoTrack, localStreamRef.current!);
              }
              // Renegotiate so remote peer receives the new video track
              if (pc.signalingState === "stable") {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                socket?.emit("call:offer", {
                  callId: stateRef.current.callId,
                  targetUserId: peerId,
                  sdp: offer,
                });
              }
            } catch (e) {
              console.error("[WebRTC] renegotiate error:", e);
            }
          };
          renegotiations.push(renegotiate());
        });
        await Promise.all(renegotiations);

        setState((prev) => ({ ...prev, isVideoOff: false, callType: "video" }));
        socket?.emit("call:toggle-media", {
          callId: state.callId,
          mediaType: "video",
          enabled: true,
        });
        socket?.emit("call:upgrade-to-video", { callId: state.callId });
      } catch (err) {
        console.error("[WebRTC] Failed to get video track:", err);
        toast.error("Could not access camera.");
      }
      return;
    }

    const newState = !state.isVideoOff;
    setState((prev) => ({ ...prev, isVideoOff: newState }));
    localStreamRef.current
      ?.getVideoTracks()
      .forEach((t) => (t.enabled = !newState));
    socket?.emit("call:toggle-media", {
      callId: state.callId,
      mediaType: "video",
      enabled: !newState,
    });
  }, [state.isVideoOff, state.callType, state.callId]);

  const inviteToCall = useCallback(
    (
      targetUserId: string,
      targetName?: string,
      targetAvatar?: string | null,
    ) => {
      if (!state.callId) return;
      getSocket()?.emit("call:initiate", {
        callId: state.callId,
        targetUserId,
        callerName: profile?.full_name || "User",
        callerAvatar: profile?.avatar_url || null,
        callType: state.callType,
        workgroupId: state.workgroupId,
        isGroupCall: true,
      });
      // Add peer to state immediately so their tile shows name/avatar while ringing
      if (targetName) {
        setState((prev) => ({
          ...prev,
          isGroupCall: true, // Mark as group call now that we are adding a 3rd person
          peers: {
            ...prev.peers,
            [targetUserId]: {
              userId: targetUserId,
              name: targetName,
              avatar: targetAvatar ?? null,
              isMuted: false,
              isVideoOff: true,
              isScreenSharing: false,
              stream: null,
            },
          },
        }));
      }
      toast.success("Invitation sent");
    },
    [state.callId, state.callType, state.workgroupId, profile],
  );

  const sendCallMessage = useCallback(
    (text: string, targetUserId?: string) => {
      if (!state.callId || !profile || !text.trim()) return;
      const socket = getSocket();
      const message: CallMessage = {
        id: Math.random().toString(36).slice(2, 9),
        userId: user?.id || "",
        userName: profile.full_name || "User",
        userAvatar: profile.avatar_url,
        text: text.trim(),
        timestamp: new Date().toISOString(),
        targetUserId,
      };
      socket?.emit("call:message", {
        callId: state.callId,
        message,
        targetUserId,
      });
      setState((prev) => ({
        ...prev,
        callMessages: [...prev.callMessages, message],
      }));
    },
    [state.callId, profile, user?.id],
  );

  // ─── Stable incoming call listener ──────────────────────────────
  // Kept in its own effect with NO state.callId dependency so it is
  // never torn down / re-attached during an active call.  Using refs
  // for everything that changes over time keeps the handler fresh.
  const playRingtoneRef = useRef(playRingtone);
  const stopRingtoneRef = useRef(stopRingtone);
  const resetCallStateRef = useRef(resetCallState);
  useEffect(() => {
    playRingtoneRef.current = playRingtone;
  }, [playRingtone]);
  useEffect(() => {
    stopRingtoneRef.current = stopRingtone;
  }, [stopRingtone]);
  useEffect(() => {
    resetCallStateRef.current = resetCallState;
  }, [resetCallState]);

  useEffect(() => {
    // Use a stable handler reference so socket.off works correctly
    const handleIncoming = (p: any) => {
      console.log(
        "[VideoCall] call:incoming received",
        p,
        "callState:",
        callStateRef.current,
      );
      if (callStateRef.current !== "idle") {
        console.log(
          "[VideoCall] Rejecting - not idle, state:",
          callStateRef.current,
        );
        getSocket()?.emit("call:reject", {
          callId: p.callId,
          callerId: p.callerId,
          reason: "busy",
        });
        return;
      }
      console.log("[VideoCall] Setting state to incoming");
      setState((prev) => ({
        ...prev,
        callState: "incoming",
        callType: p.callType,
        callId: p.callId,
        callStatus: null,
        workgroupId: p.workgroupId || null,
        isOutgoing: false,
        isGroupCall: !!p.isGroupCall,
        groupName: p.groupName || null,
        groupAvatar: p.groupAvatar || null,
        peers: {
          [p.callerId]: {
            userId: p.callerId,
            name: p.callerName,
            avatar: p.callerAvatar,
            isMuted: false,
            isVideoOff: false,
            isScreenSharing: false,
            isModerator: !!p.callerIsModerator,
            stream: null,
          },
        },
      }));
      playRingtoneRef.current("incoming");

      // Show electron call overlay if applicable
      // @ts-ignore
      if (window.electronAPI?.isElectron) {
        // @ts-ignore
        window.electronAPI.showIncomingCall({
          callId: p.callId,
          callType: p.callType,
          callerName: p.callerName,
          callerAvatar: p.callerAvatar,
          workgroupId: p.workgroupId,
        });
      }
    };

    // ─── Stable call:end handler ─────────────────────────────────
    const handleEnd = (p: any) => {
      const s = stateRef.current;
      if (p.callId !== s.callId) return;

      const peerCount = Object.keys(s.peers).length;

      // End for all if:
      // 1. It's explicitly not a group call
      // 2. OR only 2 people were in the call (1 peer in state)
      // 3. OR the original caller ended it
      // 4. OR it was an incoming call that never connected
      const shouldEndForAll =
        !s.isGroupCall ||
        peerCount <= 1 ||
        p.isOriginalCaller ||
        s.callState === "incoming" ||
        s.callState === "outgoing";

      if (shouldEndForAll) {
        // Show missed call toast if we were ringing and never answered
        if (s.callState === "incoming") {
          const caller = Object.values(s.peers)[0];
          const displayName =
            s.isGroupCall && s.groupName
              ? s.groupName
              : caller?.name || "Someone";
          const rawAvatar =
            s.isGroupCall && s.groupAvatar
              ? s.groupAvatar
              : caller?.avatar || null;
          const isVideo = s.callType === "video";
          const label = isVideo ? "Missed video call" : "Missed voice call";

          fireRushNotification({
            title: displayName,
            body: `📵 ${label}`,
            avatar: rawAvatar,
            avatarColor: null,
            isDirectChat: !s.isGroupCall,
            isBroadcast: false,
            workgroupId: s.workgroupId || s.callId || "",
            unreadCount: 0,
            authorName: "",
          });
        }
        resetCallStateRef.current();
      } else {
        // Group call: a member left — remove them
        const targetId = p.userId || p.fromUserId;
        if (targetId) {
          setState((prev) => {
            const newPeers = { ...prev.peers };
            delete newPeers[targetId];
            // If only we are left in a call that was a conversation (at least 2 people before), end it
            const remainingCount = Object.keys(newPeers).length;
            if (
              remainingCount === 0 &&
              (prev.callState === "connected" || prev.callState === "outgoing")
            ) {
              setTimeout(() => resetCallStateRef.current(), 500);
            }
            return { ...prev, peers: newPeers };
          });
        }
      }
    };

    // ─── Stable call:rejected handler ────────────────────────────
    const handleRejected = (p: any) => {
      const s = stateRef.current;
      if (p.callId !== s.callId) return;
      stopRingtoneRef.current();

      const peerCount = Object.keys(s.peers).length;
      const reason = p.reason === "busy" ? "Busy" : "Declined";

      // If it's a 1-on-1 scenario (only 1 peer), reset INSTANTLY
      if (!s.isGroupCall || peerCount <= 1) {
        toast.error(`Call ${reason.toLowerCase()}`);
        resetCallStateRef.current();
        return;
      }

      // Group call with multiple members: remove the one who declined
      const rejectorId = p.rejectedBy || p.callerId || p.fromUserId;
      if (rejectorId) {
        setState((prev) => {
          const newPeers = { ...prev.peers };
          const rejectorName =
            newPeers[rejectorId]?.name || p.accepterName || "A member";
          delete newPeers[rejectorId];
          toast.info(`${rejectorName} declined the call`);

          // If no one else is left, reset instantly
          if (Object.keys(newPeers).length === 0) {
            setTimeout(() => resetCallStateRef.current(), 100);
          }

          return { ...prev, peers: newPeers };
        });
      }
    };

    const attach = () => {
      const socket = getSocket();
      console.log(
        "[VideoCall] attach() called, socket:",
        socket?.id,
        "connected:",
        socket?.connected,
      );
      if (!socket) {
        console.log("[VideoCall] attach() - no socket yet, skipping");
        return;
      }
      socket.off("call:incoming", handleIncoming);
      socket.on("call:incoming", handleIncoming);
      socket.off("call:end", handleEnd);
      socket.on("call:end", handleEnd);
      socket.off("call:rejected", handleRejected);
      socket.on("call:rejected", handleRejected);
      console.log(
        "[VideoCall] stable listeners attached on socket:",
        socket.id,
      );
    };

    attach();

    let pollInterval: number | null = null;
    const registerConnectListener = () => {
      const socket = getSocket();
      if (socket) {
        socket.off("connect", attach);
        socket.on("connect", attach);
        if (socket.connected) attach();
        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
      }
    };

    registerConnectListener();
    if (!getSocket()?.connected) {
      pollInterval = window.setInterval(registerConnectListener, 100);
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      const s = getSocket();
      s?.off("call:incoming", handleIncoming);
      s?.off("call:end", handleEnd);
      s?.off("call:rejected", handleRejected);
      s?.off("connect", attach);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // stable: mount once only

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // handleIncoming is now handled by the stable effect above
    const handleIncoming = (_p: any) => {
      /* handled above */
    };

    const handleUserJoined = async (p: any) => {
      if (
        !callStateRef.current.includes("connected") &&
        callStateRef.current !== "connecting"
      )
        return;

      // Skip only if already fully connected to this peer OR currently connecting
      const existingPc = peerConnectionsRef.current.get(p.userId);
      if (existingPc) {
        const isConnected =
          existingPc.iceConnectionState === "connected" ||
          existingPc.iceConnectionState === "completed";
        const isSignaling = existingPc.signalingState !== "stable";

        if (isConnected || isSignaling) {
          console.log(
            `[WebRTC] handleUserJoined: Skipping PC creation for ${p.userId} (connected: ${isConnected}, signaling: ${existingPc.signalingState})`,
          );
          // Just update name/avatar if missing
          setState((prev) => {
            const existing = prev.peers[p.userId];
            if (existing?.name) return prev;
            return {
              ...prev,
              peers: {
                ...prev.peers,
                [p.userId]: {
                  ...existing,
                  name: p.name || existing?.name || "",
                  avatar: p.avatar ?? existing?.avatar ?? null,
                },
              },
            };
          });
          return;
        }
      }

      console.log(`[WebRTC] handleUserJoined: Creating PC for ${p.userId}`);
      const pc = createPeerConnection(p.userId);
      if (!pc) return;

      // Merge with existing peer data — preserve name/avatar if already set
      setState((prev) => ({
        ...prev,
        isGroupCall: true, // Any multi-party action makes it a group call
        peers: {
          ...prev.peers,
          [p.userId]: {
            userId: p.userId,
            name: p.name || prev.peers[p.userId]?.name || "",
            avatar: p.avatar ?? prev.peers[p.userId]?.avatar ?? null,
            isMuted: false,
            isVideoOff: false,
            isScreenSharing: false,
            stream: prev.peers[p.userId]?.stream || null,
          },
        },
      }));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("call:offer", {
        callId: stateRef.current.callId,
        targetUserId: p.userId,
        sdp: offer,
      });
    };

    const flushIceCandidates = async (
      userId: string,
      pc: RTCPeerConnection,
    ) => {
      const pending = pendingCandidatesRef.current.get(userId);
      if (pending && pending.length > 0) {
        console.log(
          `[WebRTC] Flushing ${pending.length} pending ICE candidates for ${userId}`,
        );
        for (const candidate of pending) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.error("[WebRTC] Error adding pending ICE:", e);
          }
        }
        pendingCandidatesRef.current.delete(userId);
      }
    };

    const handleAccepted = async (p: any) => {
      if (p.callId !== stateRef.current.callId) return;
      stopRingtone();
      setState((prev) => ({
        ...prev,
        callState: "connecting",
        callStatus: null,
        peers: {
          ...prev.peers,
          [p.accepterId]: {
            ...(prev.peers[p.accepterId] || {}),
            userId: p.accepterId,
            name: p.accepterName || prev.peers[p.accepterId]?.name || "",
            avatar:
              p.accepterAvatar ?? prev.peers[p.accepterId]?.avatar ?? null,
            isMuted: false,
            isVideoOff: false,
            isScreenSharing: false,
            stream: prev.peers[p.accepterId]?.stream || null,
          },
        },
      }));
      // Avoid race conditions if we already started connecting via handleUserJoined
      const existingPc = peerConnectionsRef.current.get(p.accepterId);
      if (existingPc && existingPc.signalingState !== "stable") {
        console.log(
          `[WebRTC] handleAccepted: PC already exists and is signaling for ${p.accepterId}, skipping duplicate offer`,
        );
        return;
      }

      const pc = createPeerConnection(p.accepterId);
      if (!pc) return;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("call:offer", {
        callId: p.callId,
        targetUserId: p.accepterId,
        sdp: offer,
      });
    };

    const handleOffer = async (p: any) => {
      let pc = peerConnectionsRef.current.get(p.fromUserId);
      if (!pc) pc = createPeerConnection(p.fromUserId)!;
      if (!pc) return;

      // Ensure peer entry has name/avatar; on renegotiation mark video as on
      setState((prev) => {
        const existing = prev.peers[p.fromUserId];
        return {
          ...prev,
          peers: {
            ...prev.peers,
            [p.fromUserId]: {
              userId: p.fromUserId,
              name: p.callerName || p.name || existing?.name || "",
              avatar: p.callerAvatar ?? p.avatar ?? existing?.avatar ?? null,
              isMuted: existing?.isMuted ?? false,
              isVideoOff: existing?.isVideoOff ?? false,
              isScreenSharing: existing?.isScreenSharing ?? false,
              stream: existing?.stream ?? null,
            },
          },
        };
      });
      try {
        const offerCollision =
          p.sdp.type === "offer" &&
          (pc.signalingState !== "stable" || pc.remoteDescription !== null);

        // Simple polite peer logic: peer with "smaller" userId is polite
        const isPolite =
          user?.id && p.fromUserId ? user.id < p.fromUserId : false;

        if (offerCollision && !isPolite) {
          console.warn(
            "[WebRTC] Offer collision detected (impolite), ignoring offer from:",
            p.fromUserId,
          );
          return;
        }

        if (offerCollision && isPolite) {
          console.log(
            "[WebRTC] Offer collision detected (polite), rolling back and accepting offer from:",
            p.fromUserId,
          );
          await Promise.all([
            pc.setLocalDescription({ type: "rollback" } as any),
            pc.setRemoteDescription(new RTCSessionDescription(p.sdp)),
          ]);
        } else {
          await pc.setRemoteDescription(new RTCSessionDescription(p.sdp));
        }

        await flushIceCandidates(p.fromUserId, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("call:answer", {
          callId: p.callId,
          targetUserId: p.fromUserId,
          sdp: answer,
        });
      } catch (err) {
        console.error("[WebRTC] handleOffer error:", err);
      }
    };

    const handleAnswer = async (p: any) => {
      if (p.callId !== stateRef.current.callId) return;
      const pc = peerConnectionsRef.current.get(p.fromUserId);
      if (pc) {
        try {
          if (pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(p.sdp));
            await flushIceCandidates(p.fromUserId, pc);
          } else {
            console.warn(
              "[WebRTC] Received answer but signaling state is:",
              pc.signalingState,
            );
          }
        } catch (err) {
          console.error("[WebRTC] handleAnswer error:", err);
        }
      }
    };

    const handleIce = async (p: any) => {
      if (p.callId !== stateRef.current.callId) return;
      const pc = peerConnectionsRef.current.get(p.fromUserId);
      try {
        if (pc && pc.remoteDescription && pc.signalingState !== "closed") {
          await pc.addIceCandidate(new RTCIceCandidate(p.candidate));
        } else {
          // Queue candidates if remote description is not yet set
          const pending = pendingCandidatesRef.current.get(p.fromUserId) || [];
          pending.push(p.candidate);
          pendingCandidatesRef.current.set(p.fromUserId, pending);
        }
      } catch (e) {
        console.error("[WebRTC] Error adding ICE candidate:", e);
      }
    };

    const handleToggleMedia = (p: any) => {
      setState((prev) => {
        const peer = prev.peers[p.fromUserId];
        if (!peer) return prev;
        const updates: Partial<RemotePeer> = {};
        if (p.mediaType === "audio") updates.isMuted = !p.enabled;
        if (p.mediaType === "video") updates.isVideoOff = !p.enabled;
        if (p.mediaType === "screen") updates.isScreenSharing = p.enabled;
        return {
          ...prev,
          peers: { ...prev.peers, [p.fromUserId]: { ...peer, ...updates } },
        };
      });
    };

    const handleReaction = (p: any) => {
      setState((prev) => ({
        ...prev,
        reactions: [...prev.reactions, p.reaction],
      }));
      setTimeout(
        () =>
          setState((prev) => ({
            ...prev,
            reactions: prev.reactions.filter((r) => r.id !== p.reaction.id),
          })),
        5000,
      );
    };

    const handleUserLeft = (p: any) => {
      const targetId = p.userId || p.fromUserId;
      if (!targetId) return;

      setState((prev) => {
        const newPeers = { ...prev.peers };
        delete newPeers[targetId];

        // If we are in a call and no one else is left, end it for us too
        const remainingPeerCount = Object.keys(newPeers).length;
        if (
          remainingPeerCount === 0 &&
          (prev.callState === "connected" || prev.callState === "outgoing")
        ) {
          setTimeout(() => resetCallState(), 500);
        }

        return { ...prev, peers: newPeers };
      });
      peerConnectionsRef.current.get(targetId)?.close();
      peerConnectionsRef.current.delete(targetId);
    };

    const handleEnd = (_p: any) => {
      /* handled by stable effect above */
    };
    const handleRejected = (_p: any) => {
      /* handled by stable effect above */
    };

    const handleUpgradeToVideo = (p: any) => {
      // A peer upgraded to video — switch our call type to video and mark their camera as on
      setState((prev) => ({
        ...prev,
        callType: "video",
        peers: {
          ...prev.peers,
          ...(prev.peers[p.fromUserId]
            ? {
                [p.fromUserId]: {
                  ...prev.peers[p.fromUserId],
                  isVideoOff: false,
                },
              }
            : {}),
        },
      }));
    };

    // Populate existing room members for late joiners
    const handleRoomMembers = (p: any) => {
      if (!p.members || !Array.isArray(p.members)) return;
      setState((prev) => {
        const updatedPeers = { ...prev.peers };
        for (const member of p.members) {
          if (!member.userId) continue;
          updatedPeers[member.userId] = {
            userId: member.userId,
            name: member.name || updatedPeers[member.userId]?.name || "",
            avatar:
              member.avatar ?? updatedPeers[member.userId]?.avatar ?? null,
            isMuted: updatedPeers[member.userId]?.isMuted ?? false,
            isVideoOff: updatedPeers[member.userId]?.isVideoOff ?? true,
            isScreenSharing:
              updatedPeers[member.userId]?.isScreenSharing ?? false,
            stream: updatedPeers[member.userId]?.stream ?? null,
          };
        }
        return {
          ...prev,
          isGroupCall: p.members.length > 0 ? true : prev.isGroupCall,
          peers: updatedPeers,
        };
      });
    };

    socket.on("call:user-joined", handleUserJoined);
    socket.on("call:room-members", handleRoomMembers);
    socket.on("call:upgrade-to-video", handleUpgradeToVideo);
    socket.on("call:accepted", handleAccepted);
    socket.on("call:offer", handleOffer);
    socket.on("call:answer", handleAnswer);
    socket.on("call:ice-candidate", handleIce);
    socket.on("call:toggle-media", handleToggleMedia);
    socket.on("call:reaction", handleReaction);

    const handleMessage = (p: any) => {
      setState((prev) => ({
        ...prev,
        callMessages: [...prev.callMessages, p.message],
      }));
    };
    socket.on("call:message", handleMessage);

    socket.on("call:user-left", handleUserLeft);

    return () => {
      socket.off("call:incoming", handleIncoming);
      socket.off("call:user-joined", handleUserJoined);
      socket.off("call:room-members", handleRoomMembers);
      socket.off("call:upgrade-to-video", handleUpgradeToVideo);
      socket.off("call:accepted", handleAccepted);
      socket.off("call:offer", handleOffer);
      socket.off("call:answer", handleAnswer);
      socket.off("call:ice-candidate", handleIce);
      socket.off("call:toggle-media", handleToggleMedia);
      socket.off("call:reaction", handleReaction);
      socket.off("call:message", handleMessage);
      socket.off("call:user-left", handleUserLeft);
    };
  }, [playRingtone, createPeerConnection, resetCallState, stopRingtone]);

  // Electron event listeners
  useEffect(() => {
    // @ts-ignore
    if (!window.electronAPI?.isElectron) return;

    const handleAcceptFromOverlay = () => {
      console.log("[Electron] Call accepted from overlay");
      acceptCall();
    };

    // @ts-ignore
    window.electronAPI.onCallAcceptedFromOverlay(handleAcceptFromOverlay);

    return () => {
      // @ts-ignore
      window.electronAPI.removeAllListeners('call-accepted-from-overlay');
    };
  }, [acceptCall]);

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
        sendCallMessage,
      }}
    >
      {children}
    </VideoCallContext.Provider>
  );
}

export function useVideoCall() {
  const context = useContext(VideoCallContext);
  if (context === undefined) {
    throw new Error("useVideoCall must be used within a VideoCallProvider");
  }
  return context;
}
