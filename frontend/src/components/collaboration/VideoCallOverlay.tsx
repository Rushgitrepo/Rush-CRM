import { useEffect, useRef, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useVideoCall } from "@/contexts/VideoCallContext";
import { getAvatarUrl, cn } from "@/lib/utils";
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Maximize2,
  Minimize2,
  Smile,
  UserPlus,
  Plus,
  Search,
  Check,
  X,
  User,
  Monitor,
} from "lucide-react";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// ─── Sub-Component for Remote Peer ───────────────────────────────
function RemotePeerVideo({
  peer,
  fullScreen,
}: {
  peer: any;
  fullScreen?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && peer.stream) {
      videoRef.current.srcObject = peer.stream;
    }
  }, [peer.stream]);

  const initials = peer.name
    ? peer.name
        .split(" ")
        .map((w: string) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "??";

  return (
    <div
      className={cn(
        "relative overflow-hidden group transition-all duration-500",
        fullScreen
          ? "w-full h-full rounded-none"
          : "aspect-video bg-slate-900 rounded-2xl border border-white/5 shadow-2xl",
      )}
    >
      {/* Video element always present to maintain audio stream playback */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={cn(
          "w-full h-full transition-opacity duration-700",
          peer.isScreenSharing ? "object-contain bg-black" : "object-cover",
          (peer.isVideoOff && !peer.isScreenSharing) || !peer.stream
            ? "opacity-0"
            : "opacity-100",
        )}
      />

      {((peer.isVideoOff && !peer.isScreenSharing) || !peer.stream) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950 z-0">
          <div
            className={cn(
              "rounded-full bg-slate-900 flex items-center justify-center border-2 border-white/10 overflow-hidden shadow-2xl animate-in zoom-in duration-700",
              fullScreen ? "w-40 h-40" : "w-24 h-24",
            )}
          >
            {peer.avatar ? (
              <img
                src={getAvatarUrl(peer.avatar)}
                alt={peer.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span
                className={cn(
                  "font-bold text-white/50",
                  fullScreen ? "text-5xl" : "text-3xl",
                )}
              >
                {initials}
              </span>
            )}
          </div>
          <span className="text-white font-medium text-lg tracking-tight">
            {peer.name}
          </span>
          <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full backdrop-blur-md">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
            <span className="text-[10px] text-white/40 uppercase font-bold tracking-widest">
              Camera Off
            </span>
          </div>
        </div>
      )}

      {/* Peer Label */}
      <div
        className={cn(
          "absolute flex items-center gap-3 px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/10 transition-all z-10",
          fullScreen ? "top-32 left-8" : "bottom-4 left-4",
        )}
      >
        <span className="text-white text-xs font-bold">{peer.name}</span>
        {peer.isMuted && <MicOff className="w-3 h-3 text-red-500" />}
      </div>
    </div>
  );
}

// ─── Smartphone-style Audio Call View ────────────────────────────
function OutgoingCallView({ peer, callType, status, endCall }: any) {
  const avatarUrl = getAvatarUrl(peer?.avatar);
  const isRoomJoin = !peer;

  return (
    <div className="w-full h-full bg-zinc-950 flex flex-col items-center justify-center gap-12 py-24 px-8 animate-in fade-in duration-700 relative overflow-hidden">
      {/* Immersive Background */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/50 via-zinc-950 to-zinc-950 z-10" />
        {avatarUrl ? (
          <img
            src={avatarUrl}
            className="w-full h-full object-cover blur-[120px] scale-150 opacity-40"
            alt=""
          />
        ) : (
          <div className="w-full h-full bg-indigo-500/5 blur-[120px] scale-150 opacity-20" />
        )}
      </div>

      <div className="relative z-10 text-center flex flex-col items-center">
        <div className="flex items-center gap-3 mb-6 bg-white/5 px-4 py-2 rounded-full border border-white/5 backdrop-blur-md">
          <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
          <p
            className={cn(
              "font-bold tracking-[0.2em] uppercase text-[12px] text-white",
              status && "text-red-500",
            )}
          >
            {status ||
              (isRoomJoin
                ? "Connecting to meeting..."
                : callType === "video"
                  ? "Video Calling..."
                  : "Calling...")}
          </p>
        </div>

        <h2 className="text-3xl font-bold text-white tracking-tight leading-tight flex items-center gap-3">
          {isRoomJoin ? "Meeting Room" : peer?.name}
          {peer?.isModerator && (
            <Badge className="bg-indigo-600 text-white text-sm px-2 py-0.5 font-bold">
              Moderator
            </Badge>
          )}
        </h2>
      </div>

      <div className="relative z-10">
        <div className="relative group">
          <div
            className={cn(
              "absolute inset-0 rounded-full scale-150 blur-2xl animate-pulse duration-[3000ms]",
              status ? "bg-red-500/20" : "bg-indigo-500/20",
            )}
          />
          <div
            className={cn(
              "absolute inset-0 rounded-full scale-125 animate-ping duration-[2000ms]",
              status ? "bg-red-500/10" : "bg-indigo-500/10",
            )}
          />
          <Avatar className="h-32 w-32 border-8 border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.5)] relative z-10 transition-transform duration-700 group-hover:scale-105">
            {avatarUrl ? <AvatarImage src={avatarUrl} /> : null}
            <AvatarFallback className="bg-zinc-800 text-7xl font-bold text-zinc-500">
              {isRoomJoin ? (
                <Monitor className="w-24 h-24" />
              ) : (
                peer?.name?.charAt(0)
              )}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>

      <div className="relative z-10 pt-8">
        <button
          onClick={endCall}
          className="h-20 w-20 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-[0_0_40px_rgba(239,68,68,0.4)] transition-all hover:scale-105 active:scale-95 border-b-4 border-red-700"
        >
          <PhoneOff className="w-10 h-10 text-white" />
        </button>
        <p className="text-red-500/60 uppercase font-black tracking-widest text-[9px] text-center mt-4">
          End Call
        </p>
      </div>
    </div>
  );
}

function AudioCallView({
  peer,
  duration,
  isMuted,
  toggleMute,
  endCall,
  renderInvitePopover,
}: any) {
  const avatarUrl = getAvatarUrl(peer.avatar);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current && peer.stream) {
      audioRef.current.srcObject = peer.stream;
    }
  }, [peer.stream]);

  return (
    <div className="w-full h-full bg-zinc-950 flex flex-col items-center justify-between py-14 px-6 animate-in fade-in duration-700 relative overflow-hidden">
      {/* Invisible audio element */}
      <audio
        ref={audioRef}
        autoPlay
        playsInline
        className="opacity-0 pointer-events-none absolute"
      />

      {/* Decorative Blur Background */}
      <div className="absolute inset-x-0 top-0 h-2/3 z-0 overflow-hidden opacity-30">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-zinc-950 to-zinc-950 z-10" />
        <img
          src={avatarUrl}
          className="w-full h-full object-cover blur-[50px] scale-125"
          alt=""
        />
      </div>

      <div className="relative z-10 text-center flex flex-col items-center pt-2">
        <div className="mb-3 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full backdrop-blur-md">
          <p className="text-emerald-400 font-bold tracking-[0.2em] uppercase text-[8px]">
            Secure
          </p>
        </div>
        <h2 className="text-xl font-bold text-white tracking-tight leading-tight mb-1 flex items-center gap-2">
          {peer.name}
          {peer.isModerator && (
            <Badge className="bg-indigo-600 text-white text-[9px] px-1.5 py-0 font-bold">
              Moderator
            </Badge>
          )}
        </h2>
        <div className="flex items-center gap-2">
          <div className="w-1 h-1 rounded-full bg-white/20" />
          <p className="text-zinc-500 font-mono text-[11px] font-medium tracking-wider">
            {formatDuration(duration)}
          </p>
        </div>
      </div>

      <div className="relative z-10 my-4">
        <div className="relative group">
          <div className="absolute inset-0 bg-indigo-500/20 rounded-full scale-125 blur-xl animate-pulse" />
          <Avatar className="h-20 w-20 border-4 border-white/5 shadow-2xl relative z-10 transition-transform duration-500">
            <AvatarImage src={avatarUrl} />
            <AvatarFallback className="bg-zinc-900 text-5xl font-bold text-zinc-500">
              {peer.name?.charAt(0)}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>

      <div className="relative z-10 w-full grid grid-cols-3 gap-y-6 gap-x-4 mb-4">
        <div className="flex flex-col items-center gap-1.5">
          <button
            onClick={toggleMute}
            className={cn(
              "h-14 w-14 rounded-full flex items-center justify-center transition-all",
              isMuted
                ? "bg-white text-zinc-950"
                : "bg-white/5 text-white hover:bg-white/10 border border-white/5",
            )}
          >
            {isMuted ? (
              <MicOff className="w-6 h-6" />
            ) : (
              <Mic className="w-6 h-6" />
            )}
          </button>
          <span className="text-[9px] text-white/40 uppercase font-black tracking-tighter">
            Mute
          </span>
        </div>
        <div className="flex flex-col items-center gap-1.5 text-white/20">
          <button className="h-14 w-14 rounded-full bg-white/5 flex items-center justify-center border border-white/5 cursor-not-allowed">
            <User className="w-6 h-6" />
          </button>
          <span className="text-[9px] uppercase font-black tracking-tighter">
            Keypad
          </span>
        </div>
        <div className="flex flex-col items-center gap-1.5 text-white">
          <button className="h-14 w-14 rounded-full bg-white/5 text-white flex items-center justify-center hover:bg-white/10 border border-white/5">
            <Smile className="w-6 h-6" />
          </button>
          <span className="text-[9px] text-white/40 uppercase font-black tracking-tighter">
            Audio
          </span>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          {renderInvitePopover(
            <button className="h-14 w-14 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center hover:bg-indigo-500/20 border border-indigo-500/20 shadow-lg shadow-indigo-500/5">
              <UserPlus className="w-6 h-6" />
            </button>,
          )}
          <span className="text-[9px] text-indigo-400/60 uppercase font-black tracking-tighter">
            Invite
          </span>
        </div>
        <div className="flex flex-col items-center gap-1.5 text-white/20">
          <button className="h-14 w-14 rounded-full bg-white/5 flex items-center justify-center border border-white/5 cursor-not-allowed">
            <Video className="w-6 h-6" />
          </button>
          <span className="text-[9px] uppercase font-black tracking-tighter">
            Video
          </span>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <button
            onClick={endCall}
            className="h-14 w-14 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition-all shadow-lg active:scale-95"
          >
            <PhoneOff className="w-7 h-7 text-white" />
          </button>
          <span className="text-[9px] text-red-500/60 uppercase font-black tracking-tighter">
            End
          </span>
        </div>
      </div>
    </div>
  );
}

export default function VideoCallOverlay() {
  const {
    callState,
    callType,
    peers,
    isMuted,
    isVideoOff,
    isScreenSharing,
    callDuration,
    localStream,
    screenStream,
    reactions,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    sendReaction,
    inviteToCall,
    isGroupCall,
    callStatus,
  } = useVideoCall();

  const { users: allUsers = [] } = useAdminUsers();
  const { user: currentUser } = useAuth();
  const [showInvitePopover, setShowInvitePopover] = useState(false);

  // Filter out users already in call and self
  const inviteableUsers = useMemo(() => {
    const peerIds = new Set(Object.keys(peers));
    return allUsers.filter(
      (u) => u.id !== currentUser?.id && !peerIds.has(u.id),
    );
  }, [allUsers, peers, currentUser]);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const controlsTimerRef = useRef<number | null>(null);

  // Dragging & Minimize State
  const [isMinimized, setIsMinimized] = useState(false);
  const [mobilePosition, setMobilePosition] = useState({ x: 0, y: 0 });
  const [minimizedPosition, setMinimizedPosition] = useState({ x: 0, y: 0 });
  const [pipPosition, setPipPosition] = useState({ x: 0, y: 0 });
  const [pipMode, setPipMode] = useState<"local" | "remote">("local");

  const dragRef = useRef({
    startX: 0,
    startY: 0,
    initX: 0,
    initY: 0,
    isDragging: false,
    type: "mobile" as "mobile" | "minimized" | "pip",
  });

  const handleMouseDown = (
    e: React.MouseEvent<HTMLDivElement>,
    type: "mobile" | "minimized" | "pip",
  ) => {
    if (
      (e.target as HTMLElement).closest("button") ||
      (e.target as HTMLElement).closest(".no-drag")
    )
      return;

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: type === "mobile" ? mobilePosition.x : type === "minimized" ? minimizedPosition.x : pipPosition.x,
      initY: type === "mobile" ? mobilePosition.y : type === "minimized" ? minimizedPosition.y : pipPosition.y,
      isDragging: true,
      type,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragRef.current.isDragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (dragRef.current.type === "mobile") {
      setMobilePosition({ x: dragRef.current.initX + dx, y: dragRef.current.initY + dy });
    } else if (dragRef.current.type === "minimized") {
      setMinimizedPosition({ x: dragRef.current.initX + dx, y: dragRef.current.initY + dy });
    } else if (dragRef.current.type === "pip") {
      setPipPosition({ x: dragRef.current.initX + dx, y: dragRef.current.initY + dy });
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragRef.current.isDragging) {
      dragRef.current.isDragging = false;
    }
  };

  // Attach local stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Attach screen stream
  useEffect(() => {
    if (screenVideoRef.current && screenStream) {
      screenVideoRef.current.srcObject = screenStream;
    }
  }, [screenStream]);

  // Auto-hide controls
  useEffect(() => {
    if (callState !== "connected") {
      setShowControls(true);
      return;
    }

    const resetTimer = () => {
      setShowControls(true);
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
      controlsTimerRef.current = window.setTimeout(
        () => setShowControls(false),
        4000,
      );
    };

    resetTimer();
    window.addEventListener("mousemove", resetTimer);
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
      window.removeEventListener("mousemove", resetTimer);
    };
  }, [callState]);

  if (callState === "idle") return null;

  const peerList = Object.values(peers);
  const firstPeer = peerList[0];

  const renderInMobileFrame = (content: React.ReactNode) => (
    <div
      className="fixed top-20 bottom-10 right-12 z-[9999] animate-in slide-in-from-right-20 fade-in duration-700 hidden lg:block touch-none"
      style={{
        transform: `translate3d(${mobilePosition.x}px, ${mobilePosition.y}px, 0)`,
      }}
      onMouseDown={(e) => handleMouseDown(e, "mobile")}
    >
      <div className="relative w-[310px] h-[480px] bg-zinc-950 rounded-[48px] border-[10px] border-zinc-900 shadow-[0_80px_160px_rgba(0,0,0,1)] overflow-hidden ring-1 ring-white/10 ring-inset">
        {/* Dynamic Island style Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-7 bg-zinc-900 rounded-b-[20px] z-50 flex items-center justify-center cursor-move">
          <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse mr-2" />
          <div className="w-10 h-1.5 bg-white/10 rounded-full" />
        </div>

        {/* Screen Gloss Effect */}
        <div className="absolute inset-0 pointer-events-none z-40 bg-gradient-to-tr from-transparent via-white/[0.02] to-white/[0.04]" />

        {content}
      </div>
    </div>
  );

  const renderInvitePopover = (trigger: React.ReactNode) => (
    <Popover open={showInvitePopover} onOpenChange={setShowInvitePopover}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        className="w-64 p-0 bg-slate-900 border-white/10 shadow-2xl rounded-2xl overflow-hidden z-[10001]"
        side="top"
        align="center"
        sideOffset={20}
      >
        <Command className="bg-transparent">
          <CommandInput
            placeholder="Search people..."
            className="text-white text-xs h-10"
          />
          <CommandList className="max-h-60">
            <CommandEmpty className="p-4 text-center text-xs text-white/40 italic">
              No users found
            </CommandEmpty>
            <CommandGroup className="px-2 pb-2">
              {inviteableUsers.map((u) => (
                <CommandItem
                  key={u.id}
                  value={u.full_name}
                  onSelect={() => {
                    console.log(
                      `[VideoCall] Inviting user: ${u.full_name} (${u.id})`,
                    );
                    inviteToCall(u.id);
                    setShowInvitePopover(false);
                  }}
                  className="flex items-center gap-2 p-2 rounded-xl cursor-pointer hover:bg-white/5 transition-colors"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={getAvatarUrl(u.avatar_url)} />
                    <AvatarFallback className="text-[10px] bg-zinc-800">
                      {u.full_name?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-medium text-white truncate">
                      {u.full_name}
                    </span>
                    <span className="text-[9px] text-zinc-500 truncate">
                      {u.email}
                    </span>
                  </div>
                  <Plus className="w-3 h-3 ml-auto text-zinc-600" />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );

  if (callState === "incoming") {
    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
        <div className="relative bg-zinc-900 w-full max-w-sm rounded-[40px] p-10 border border-white/5 shadow-2xl animate-in zoom-in-95 fade-in duration-300">
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-8">
              <div className="w-28 h-28 rounded-full bg-indigo-500/10 flex items-center justify-center animate-pulse">
                <Avatar className="h-16 w-16 border-4 border-zinc-900 shadow-2xl overflow-hidden">
                  <AvatarImage src={getAvatarUrl(firstPeer?.avatar)} />
                  <AvatarFallback className="bg-indigo-600 text-white text-xl font-bold">
                    {firstPeer?.name?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center border-4 border-zinc-900 text-white">
                {callType === "video" ? (
                  <Video className="w-5 h-5 font-bold" />
                ) : (
                  <Phone className="w-5 h-5 font-bold" />
                )}
              </div>
            </div>
            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              {firstPeer?.name}
              {firstPeer?.isModerator && (
                <Badge className="bg-indigo-600 text-white text-[9px] px-1.5 py-0 font-bold">
                  Moderator
                </Badge>
              )}
            </h2>
            <p className="text-zinc-500 tracking-widest uppercase text-[10px] font-bold mb-10">
              {callType === "video" ? "Video Call..." : "Audio Call..."}
            </p>
            <div className="flex gap-4 w-full">
              <button
                onClick={rejectCall}
                className="flex-1 h-16 rounded-[24px] bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95"
              >
                <PhoneOff className="w-8 h-8 text-white" />
              </button>
              <button
                onClick={acceptCall}
                className="flex-1 h-16 rounded-[24px] bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95"
              >
                <Phone className="w-8 h-8 text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  // ─── Connected/Outgoing State ──────────────────────────────────────
  const renderCallContent = () => {
    // Status (Busy/Declined) or Outgoing
    if (callStatus || callState === "outgoing" || callState === "connecting") {
      return (
        <OutgoingCallView
          peer={firstPeer}
          callType={callType}
          status={callStatus}
          endCall={endCall}
        />
      );
    }

    // Audio View (Only for 1-on-1 private calls)
    if (callType === "audio" && peerList.length === 1 && !isGroupCall) {
      return (
        <AudioCallView
          peer={peerList[0]}
          duration={callDuration}
          isMuted={isMuted}
          toggleMute={toggleMute}
          endCall={endCall}
          renderInvitePopover={renderInvitePopover}
        />
      );
    }

    // ─── Video / Group / Zoom-style View ────────────────────────────
    const activeScreenSharePeer = peerList.find((p) => p.isScreenSharing);
    const anyScreenSharing = isScreenSharing || activeScreenSharePeer;

    return (
      <div
        className={cn(
          "w-full h-full relative bg-zinc-950 flex flex-col transition-all duration-500",
          (isGroupCall || anyScreenSharing) ? "p-0" : "pt-5 pb-5",
        )}
      >
        {/* Main Viewing Area */}
        <div className="flex-1 relative overflow-hidden flex flex-col">
          {/* Active Screen Share View (Local or Remote) */}
          {anyScreenSharing ? (
            <div className="flex-1 bg-black relative flex items-center justify-center">
              {isScreenSharing ? (
                <video
                  ref={screenVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full relative">
                  <RemotePeerVideo peer={activeScreenSharePeer!} fullScreen />
                </div>
              )}

              <div className="absolute top-4 left-4 flex items-center gap-2 bg-indigo-600 px-3 py-1 rounded-full text-[10px] font-bold text-white shadow-xl animate-pulse z-50">
                <Monitor className="w-3 h-3" />
                {isScreenSharing
                  ? "YOU ARE SCREEN SHARING"
                  : `${activeScreenSharePeer?.name?.toUpperCase()} IS SHARING`}
              </div>

              {/* Participant strip during screen share */}
              <div className="absolute bottom-4 left-4 right-4 flex justify-center gap-2 overflow-x-auto p-2 no-scrollbar z-50">
                <div className="w-32 aspect-video rounded-xl bg-zinc-800 border border-white/20 overflow-hidden shrink-0 relative">
                  {isVideoOff ? (
                    <div className="w-full h-full flex items-center justify-center text-[10px] text-white/20 font-bold uppercase">
                      You
                    </div>
                  ) : (
                    <video
                      ref={localVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                  )}
                </div>
                {peerList.map((p) => (
                  /* Don't show the presenter in the strip if they are the main view (optional, but Zoom usually keeps them in the strip too) */
                  <div
                    key={p.userId}
                    className="w-32 aspect-video rounded-xl bg-zinc-800 border border-white/20 overflow-hidden shrink-0 relative"
                  >
                    <RemotePeerVideo peer={p} />
                  </div>
                ))}
              </div>
            </div>
          ) : !isGroupCall && peerList.length === 1 ? (
            /* 1-on-1 Picture-in-Picture Layout */
            <div className="flex-1 relative bg-black overflow-hidden">
              {/* Main Full-screen Video */}
              <div className="absolute inset-0 z-0">
                {pipMode === 'local' ? (
                  <RemotePeerVideo peer={peerList[0]} fullScreen />
                ) : (
                  <div className="w-full h-full relative">
                    {isVideoOff || !localStream ? (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-zinc-900">
                        <Avatar className="h-32 w-32 border-2 border-white/10">
                          <AvatarFallback className="bg-zinc-800 text-4xl font-bold text-zinc-500">
                            {currentUser?.full_name?.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm text-white/20 font-bold uppercase tracking-widest">
                          You
                        </span>
                      </div>
                    ) : (
                      <video
                        ref={(el) => { if (el && localStream) el.srcObject = localStream; }}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full object-cover scale-x-[-1]"
                      />
                    )}
                    <div className="absolute bottom-6 left-6 flex items-center gap-2 px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/5 z-10">
                      <span className="text-xs text-white font-bold">You</span>
                      {isMuted && <MicOff className="w-4 h-4 text-red-500" />}
                    </div>
                  </div>
                )}
              </div>

              {/* PiP Floating Video */}
              <div 
                className="absolute w-32 md:w-48 aspect-[3/4] bg-zinc-900 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl z-50 cursor-move touch-none"
                style={{ 
                  transform: `translate3d(${pipPosition.x}px, ${pipPosition.y}px, 0)`,
                  right: '24px',
                  bottom: '24px'
                }}
                onMouseDown={(e) => handleMouseDown(e, 'pip')}
                onClick={() => setPipMode(prev => prev === 'local' ? 'remote' : 'local')}
              >
                {pipMode === 'local' ? (
                  <div className="w-full h-full relative pointer-events-none">
                    {isVideoOff || !localStream ? (
                      <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                        <Avatar className="h-12 w-12 border border-white/10">
                          <AvatarFallback className="bg-zinc-800 text-lg font-bold text-zinc-500">
                            {currentUser?.full_name?.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    ) : (
                      <video
                        ref={(el) => { if (el && localStream) el.srcObject = localStream; }}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full object-cover scale-x-[-1]"
                      />
                    )}
                  </div>
                ) : (
                  <div className="w-full h-full relative pointer-events-none">
                     <RemotePeerVideo peer={peerList[0]} fullScreen />
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Standard Grid View */
            <div
              className={cn(
                "flex-1 p-4 overflow-y-auto no-scrollbar",
                isGroupCall ? "bg-zinc-950" : "px-4",
              )}
            >
              <div
                className={cn(
                  "grid gap-4 h-full content-center",
                  isGroupCall
                    ? peerList.length === 0
                      ? "grid-cols-1"
                      : peerList.length === 1
                        ? "grid-cols-1 lg:grid-cols-2"
                        : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
                    : peerList.length <= 1
                      ? "grid-cols-1"
                      : "grid-cols-2",
                )}
              >
                {/* Local Video Card */}
                <div
                  className={cn(
                    "relative rounded-3xl overflow-hidden border border-white/5 bg-zinc-900 group shadow-2xl transition-all duration-500",
                    isGroupCall ? "aspect-video" : "aspect-[3/4]",
                  )}
                >
                  {isVideoOff || !localStream ? (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                      <Avatar className="h-20 w-20 border-2 border-white/10">
                        <AvatarFallback className="bg-zinc-800 text-2xl font-bold text-zinc-500">
                          {currentUser?.full_name?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-[11px] text-white/20 font-bold uppercase tracking-widest">
                        You
                      </span>
                    </div>
                  ) : (
                    <video
                      ref={localVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                  )}
                  <div className="absolute bottom-4 left-4 flex items-center gap-2 px-2.5 py-1 bg-black/40 backdrop-blur-md rounded-full border border-white/5">
                    <span className="text-[10px] text-white font-bold">
                      You
                    </span>
                    {isMuted && <MicOff className="w-3 h-3 text-red-500" />}
                  </div>
                </div>

                {/* Remote Peers */}
                {peerList.map((p) => (
                  <div
                    key={p.userId}
                    className={cn(
                      "relative rounded-3xl overflow-hidden border border-white/5 bg-zinc-900 shadow-2xl transition-all duration-500",
                      isGroupCall ? "aspect-video" : "aspect-[3/4]",
                    )}
                  >
                    <RemotePeerVideo peer={p} fullScreen />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Floating Controls Bar (Zoom Style) */}
        <div
          className={cn(
            "relative z-[70] transition-all duration-500",
            isGroupCall
              ? "bg-zinc-900/50 backdrop-blur-3xl border-t border-white/5 px-6 py-4"
              : "h-0",
          )}
        >
          <div
            className={cn(
              "flex items-center justify-between max-w-5xl mx-auto",
              !isGroupCall &&
                "absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-3 bg-white/5 backdrop-blur-3xl rounded-[32px] border border-white/10 z-30 transition-all",
              !isGroupCall &&
                !showControls &&
                "opacity-0 translate-y-10 scale-90 pointer-events-none",
            )}
          >
            {/* Left Info (Zoom style - Meeting ID/Time) */}
            {isGroupCall && (
              <div className="hidden lg:flex items-center gap-3 text-white/40">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-tighter text-indigo-400">
                    Security
                  </span>
                  <span className="text-[11px] font-medium text-emerald-500">
                    Encrypted
                  </span>
                </div>
              </div>
            )}

            {/* Center Controls */}
            <div className="flex items-center gap-3 mx-auto">
              {/* Media Toggles */}
              <button
                onClick={toggleMute}
                className={cn(
                  "p-3.5 rounded-2xl transition-all hover:scale-105 active:scale-95",
                  isMuted
                    ? "bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]"
                    : "bg-white/10 hover:bg-white/20",
                )}
              >
                {isMuted ? (
                  <MicOff className="w-5 h-5 text-white" />
                ) : (
                  <Mic className="w-5 h-5 text-white" />
                )}
              </button>
              <button
                onClick={toggleVideo}
                className={cn(
                  "p-3.5 rounded-2xl transition-all hover:scale-105 active:scale-95",
                  isVideoOff
                    ? "bg-red-500 shadow-[0_0_20_rgba(239,68,68,0.3)]"
                    : "bg-white/10 hover:bg-white/20",
                )}
              >
                {isVideoOff ? (
                  <VideoOff className="w-5 h-5 text-white" />
                ) : (
                  <Video className="w-5 h-5 text-white" />
                )}
              </button>

              {/* Functional Buttons */}
              <div className="w-px h-8 bg-white/10 mx-1 hidden sm:block" />

              <button
                onClick={toggleScreenShare}
                className={cn(
                  "p-3.5 rounded-2xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center",
                  isScreenSharing
                    ? "bg-emerald-500 text-white shadow-[0_0_20_rgba(16,185,129,0.3)]"
                    : "bg-white/10 text-white hover:bg-white/20",
                )}
              >
                <Monitor className="w-5 h-5" />
              </button>

              {renderInvitePopover(
                <button className="p-3.5 rounded-2xl bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/40 transition-all hover:scale-105 active:scale-95">
                  <UserPlus className="w-5 h-5" />
                </button>,
              )}

              <button
                onClick={() => setShowReactionPicker(!showReactionPicker)}
                className={cn(
                  "p-3.5 rounded-2xl bg-white/10 text-white hover:bg-white/20 transition-all hover:scale-105 active:scale-95",
                  showReactionPicker && "bg-white text-zinc-950",
                )}
              >
                <Smile className="w-5 h-5" />
              </button>

              <div className="w-px h-8 bg-white/10 mx-1" />

              {/* End Call */}
              <button
                onClick={endCall}
                className="px-6 h-12 rounded-2xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-widest shadow-xl transition-all active:scale-95 hover:scale-105"
              >
                Leave Call
              </button>
            </div>

            {/* Reaction Picker Popover */}
            {showReactionPicker && (
              <div className="absolute bottom-24 left-1/2 -translate-x-1/2 p-4 bg-zinc-900 border border-white/10 rounded-3xl flex gap-3 shadow-2xl animate-in slide-in-from-bottom-5 duration-300 z-[80]">
                {["👍", "❤️", "👏", "🔥", "😮", "🎉"].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      sendReaction(emoji);
                      setShowReactionPicker(false);
                    }}
                    className="text-2xl hover:scale-125 transition-transform"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const content = (
    <div
      className={cn("w-full h-full relative", isGroupCall ? "bg-zinc-950" : "")}
    >
      {/* Dynamic Header */}
      <div
        className={cn(
          "absolute left-8 right-8 flex justify-between items-center z-[80] transition-all",
          isGroupCall ? "top-8" : "top-10",
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-xl border border-white/5">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-white text-[11px] font-bold tracking-tight">
              {formatDuration(callDuration)}
            </span>
          </div>
          {isGroupCall && (
            <div className="flex -space-x-2">
              <Avatar className="h-6 w-6 border-2 border-zinc-950">
                <AvatarFallback className="bg-zinc-800 text-[8px] font-bold text-white">
                  {currentUser?.full_name?.charAt(0)}
                </AvatarFallback>
              </Avatar>
              {peerList.map((p) => (
                <Avatar
                  key={p.userId}
                  className="h-6 w-6 border-2 border-zinc-950"
                >
                  <AvatarImage src={getAvatarUrl(p.avatar)} />
                  <AvatarFallback className="bg-zinc-700 text-[8px] font-bold text-white">
                    {p.name?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
          )}
        </div>

        {!isGroupCall && peerList.length > 1 && (
          <div className="text-[10px] text-white font-bold bg-white/5 px-2 py-1 rounded mt-1">
            {peerList.length + 1} ON CALL
          </div>
        )}
      </div>

      {renderCallContent()}

      {/* Reaction animation portal area */}
      <div className="absolute top-1/2 left-0 right-0 pointer-events-none z-[100] flex flex-col items-center">
        {reactions.map((r) => (
          <div
            key={r.id}
            className="animate-reaction flex flex-col items-center mb-4"
          >
            <span className="text-6xl drop-shadow-[0_10px_20px_rgba(0,0,0,0.6)]">
              {r.emoji}
            </span>
            <span className="text-[10px] text-white/50 font-bold uppercase mt-2 tracking-widest">
              {r.userName}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
  const shouldShowFullScreen = isGroupCall || callType === "video";

  return createPortal(
    shouldShowFullScreen ? (
      <div className="fixed inset-0 z-[9999] bg-zinc-950 animate-in fade-in duration-500">
        {content}
      </div>
    ) : (
      renderInMobileFrame(content)
    ),
    document.body,
  );
}
