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
import { useWorkgroupMembers } from "@/hooks/useWorkgroups";
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
  forceVideoOff,
}: {
  peer: any;
  fullScreen?: boolean;
  forceVideoOff?: boolean;
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

  // Treat as video-off if explicitly forced (audio call) or peer has video off or no stream
  const showAvatar = forceVideoOff || (peer.isVideoOff && !peer.isScreenSharing) || !peer.stream;

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
          showAvatar ? "opacity-0" : "opacity-100",
        )}
      />

      {showAvatar && (
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
          {!forceVideoOff && (
            <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full backdrop-blur-md">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
              <span className="text-[10px] text-white/40 uppercase font-bold tracking-widest">
                Camera Off
              </span>
            </div>
          )}
        </div>
      )}

      {/* Peer Label - only show when video is playing */}
      {!showAvatar && (
        <div
          className={cn(
            "absolute flex items-center gap-3 px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/10 transition-all z-10",
            fullScreen ? "top-32 left-8" : "bottom-4 left-4",
          )}
        >
          <span className="text-white text-xs font-bold">{peer.name}</span>
          {peer.isMuted && <MicOff className="w-3 h-3 text-red-500" />}
        </div>
      )}
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
              "absolute inset-0 rounded-full scale-150 blur-2xl animate-pulse [animation-duration:3000ms]",
              status ? "bg-red-500/20" : "bg-indigo-500/20",
            )}
          />
          <div
            className={cn(
              "absolute inset-0 rounded-full scale-125 animate-ping [animation-duration:2000ms]",
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
    workgroupId,
  } = useVideoCall();

  const { users: allUsers = [] } = useAdminUsers();
  const { data: workgroupMembers = [] } = useWorkgroupMembers(workgroupId || "");
  const { user, profile: currentUser } = useAuth();
  const [showInvitePopover, setShowInvitePopover] = useState(false);

  // Filter to workgroup members only (excluding self and already-in-call peers)
  const inviteableUsers = useMemo(() => {
    const peerIds = new Set(Object.keys(peers));
    // If we have workgroup members, use them; otherwise fall back to all users
    const sourceList = workgroupMembers.length > 0
      ? workgroupMembers.map((m: any) => ({
        id: m.user_id || m.id,
        full_name: m.full_name || m.name,
        email: m.email,
        avatar_url: m.avatar_url,
      }))
      : allUsers;
    return sourceList.filter(
      (u: any) => u.id !== user?.id && !peerIds.has(u.id),
    );
  }, [workgroupMembers, allUsers, peers, user]);

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
  const [pipSwapped, setPipSwapped] = useState(false); // true = PiP is main, main is PiP
  const [gridPage, setGridPage] = useState(0); // pagination for group call grid

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

  console.log('[VideoCallOverlay] rendering, callState:', callState);

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
          ) : peerList.length === 1 ? (
            /* 2-person call (direct or group): Big + Small PiP Layout */
            <div className="flex-1 relative bg-black overflow-hidden">
              {/* Main Full-screen Video - swaps on pipSwapped */}
              <div className="absolute inset-0 z-0">
                {!pipSwapped ? (
                  <RemotePeerVideo peer={peerList[0]} fullScreen forceVideoOff={callType === "audio"} />
                ) : (
                  <div className="w-full h-full relative">
                    {(callType === "audio" || isVideoOff || !localStream) ? (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-slate-950">
                        <div className="w-40 h-40 rounded-full bg-slate-900 border-2 border-white/10 overflow-hidden shadow-2xl flex items-center justify-center animate-in zoom-in duration-700">
                          {currentUser?.avatar_url ? (
                            <img
                              src={getAvatarUrl(currentUser.avatar_url)}
                              alt={currentUser.full_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-5xl font-bold text-white/50">
                              {currentUser?.full_name?.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2) || "ME"}
                            </span>
                          )}
                        </div>
                        <span className="text-white font-medium text-lg tracking-tight">
                          {currentUser?.full_name || "You"}
                        </span>
                        {callType !== "audio" && (
                          <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full backdrop-blur-md">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            <span className="text-[10px] text-white/40 uppercase font-bold tracking-widest">
                              Camera Off
                            </span>
                          </div>
                        )}
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
                      <span className="text-xs text-white font-bold">{currentUser?.full_name || "You"}</span>
                      {isMuted && <MicOff className="w-4 h-4 text-red-500" />}
                    </div>
                  </div>
                )}
              </div>

              {/* PiP Floating Video - click to swap with main */}
              <div
                className="absolute w-32 md:w-52 aspect-[3/4] bg-zinc-900 rounded-2xl overflow-hidden border-2 border-white/30 shadow-2xl z-50 cursor-pointer touch-none hover:border-white/60 transition-all group"
                style={{
                  transform: `translate3d(${pipPosition.x}px, ${pipPosition.y}px, 0)`,
                  right: '24px',
                  bottom: '2px'
                }}
                onMouseDown={(e) => handleMouseDown(e, 'pip')}
                onClick={() => setPipSwapped(prev => !prev)}
                title="Click to swap"
              >
                {/* Swap icon overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-black/30">
                  <div className="bg-white/20 backdrop-blur-sm rounded-full p-2">
                    <Maximize2 className="w-5 h-5 text-white" />
                  </div>
                </div>

                {pipSwapped ? (
                  /* Swapped: main=local, so PiP shows REMOTE */
                  <div className="w-full h-full relative pointer-events-none flex flex-col items-center justify-center gap-4 bg-slate-950">
                    {(callType === "audio" || peerList[0]?.isVideoOff || !peerList[0]?.stream) ? (
                      <>
                        <div className="w-40 h-40 rounded-full bg-slate-900 border-2 border-white/10 overflow-hidden shadow-2xl flex items-center justify-center animate-in zoom-in duration-700">
                          {peerList[0]?.avatar ? (
                            <img src={getAvatarUrl(peerList[0].avatar)} alt={peerList[0].name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-5xl font-bold text-white/50">
                              {peerList[0]?.name?.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2) || "??"}
                            </span>
                          )}
                        </div>
                        <span className="text-white font-medium text-lg tracking-tight">{peerList[0]?.name}</span>
                      </>
                    ) : (
                      <video
                        ref={(el) => { if (el && peerList[0]?.stream) el.srcObject = peerList[0].stream; }}
                        autoPlay playsInline
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                ) : (
                  /* Default: main=remote, so PiP shows LOCAL */
                  <div className="w-full h-full relative pointer-events-none">
                    {(callType === "audio" || isVideoOff || !localStream) ? (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-slate-950">
                        <div className="w-40 h-40 rounded-full bg-slate-900 border-2 border-white/10 overflow-hidden shadow-2xl flex items-center justify-center animate-in zoom-in duration-700">
                          {currentUser?.avatar_url ? (
                            <img
                              src={getAvatarUrl(currentUser.avatar_url)}
                              alt={currentUser.full_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-5xl font-bold text-white/50">
                              {currentUser?.full_name?.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2) || "ME"}
                            </span>
                          )}
                        </div>
                        <span className="text-white font-medium text-lg tracking-tight">
                          {currentUser?.full_name || "You"}
                        </span>
                      </div>
                    ) : (
                      <video
                        ref={(el) => { if (el && localStream) el.srcObject = localStream; }}
                        autoPlay muted playsInline
                        className="w-full h-full object-cover scale-x-[-1]"
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* 3+ person: Paginated Grid + PiP self-view */
            (() => {
              const PEERS_PER_PAGE = 6;
              const totalPages = Math.ceil(peerList.length / PEERS_PER_PAGE);
              const pagedPeers = peerList.slice(gridPage * PEERS_PER_PAGE, (gridPage + 1) * PEERS_PER_PAGE);

              return (
                <div className="flex-1 relative bg-zinc-950 overflow-hidden flex flex-col">
                  {/* Remote peers grid — fills available space, no scroll */}
                  <div className="flex-1 p-4 flex flex-col min-h-0">
                    <div
                      className={cn(
                        "grid gap-3 h-full",
                        pagedPeers.length <= 2
                          ? "grid-cols-2 grid-rows-1"
                          : pagedPeers.length <= 4
                            ? "grid-cols-2 grid-rows-2"
                            : "grid-cols-3 grid-rows-2",
                      )}
                    >
                      {pagedPeers.map((p) => (
                        <div
                          key={p.userId}
                          className="relative rounded-2xl overflow-hidden border border-white/5 bg-zinc-900 shadow-xl min-h-0"
                        >
                          <RemotePeerVideo peer={p} fullScreen />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pagination arrows — only when more than 6 peers */}
                  {totalPages > 1 && (
                    <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 flex justify-between px-2 pointer-events-none z-30">
                      <button
                        onClick={() => setGridPage((p) => Math.max(0, p - 1))}
                        disabled={gridPage === 0}
                        className={cn(
                          "pointer-events-auto w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white transition-all hover:bg-black/80",
                          gridPage === 0 && "opacity-30 cursor-not-allowed",
                        )}
                      >
                        ‹
                      </button>
                      <button
                        onClick={() => setGridPage((p) => Math.min(totalPages - 1, p + 1))}
                        disabled={gridPage === totalPages - 1}
                        className={cn(
                          "pointer-events-auto w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white transition-all hover:bg-black/80",
                          gridPage === totalPages - 1 && "opacity-30 cursor-not-allowed",
                        )}
                      >
                        ›
                      </button>
                    </div>
                  )}

                  {/* Page indicator dots */}
                  {totalPages > 1 && (
                    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex gap-1.5 z-30">
                      {Array.from({ length: totalPages }).map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setGridPage(i)}
                          className={cn(
                            "w-1.5 h-1.5 rounded-full transition-all",
                            i === gridPage ? "bg-white w-4" : "bg-white/30",
                          )}
                        />
                      ))}
                    </div>
                  )}

                  {/* PiP self-view — sits inside the controls bar area, positioned bottom-right */}
                  <div
                    className="absolute w-28 md:w-36 aspect-[3/4] bg-zinc-900 rounded-xl overflow-hidden border-2 border-white/20 shadow-2xl z-50 hover:border-white/50 transition-all"
                    style={{
                      right: '16px',
                      bottom: '0px',
                    }}
                    title="You"
                  >
                    {isVideoOff || !localStream ? (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-zinc-900">
                        <div className="w-10 h-10 rounded-full bg-zinc-800 border border-white/10 overflow-hidden flex items-center justify-center">
                          {currentUser?.avatar_url ? (
                            <img src={getAvatarUrl(currentUser.avatar_url)} alt="You" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-sm font-bold text-zinc-400">
                              {currentUser?.full_name?.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2) || "ME"}
                            </span>
                          )}
                        </div>
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
                    {/* You label */}
                    <div className="absolute bottom-1 left-0 right-0 flex justify-center">
                      <span className="text-[9px] text-white/80 font-bold bg-black/50 px-2 py-0.5 rounded-full">You</span>
                    </div>
                  </div>
                </div>
              );
            })()
          )}
        </div>


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
            <div className="flex items-center gap-2 mx-auto">
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
                  callType === "audio" && "hidden",
                )}
              >
                {isVideoOff ? (
                  <VideoOff className="w-5 h-5 text-white" />
                ) : (
                  <Video className="w-5 h-5 text-white" />
                )}
              </button>

              {/* Functional Buttons */}
              <div className={cn("w-px h-8 bg-white/10 mx-1 hidden sm:block", callType === "audio" && "!hidden")} />

              <button
                onClick={toggleScreenShare}
                className={cn(
                  "p-3.5 rounded-2xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center",
                  isScreenSharing
                    ? "bg-emerald-500 text-white shadow-[0_0_20_rgba(16,185,129,0.3)]"
                    : "bg-white/10 text-white hover:bg-white/20",
                  callType === "audio" && "hidden",
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
                  {currentUser?.full_name?.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2) || "ME"}
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

  // ─── Minimized floating widget (audio call) ──────────────────
  if (isMinimized && !shouldShowFullScreen && callState === "connected") {
    const peer = peerList[0];
    const avatarUrl = peer?.avatar ? getAvatarUrl(peer.avatar) : null;
    return createPortal(
      <div
        className="fixed bottom-6 right-6 z-[9999] cursor-pointer group"
        onClick={() => setIsMinimized(false)}
        title="Click to expand call"
      >
        <div className="relative flex items-center gap-3 bg-zinc-900 border border-white/10 rounded-2xl px-4 py-3 shadow-2xl hover:bg-zinc-800 transition-all duration-200 hover:scale-105">
          {/* Pulsing green dot */}
          <div className="absolute -top-1 -left-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-zinc-900 animate-pulse" />

          {/* Avatar */}
          <div className="relative shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} className="w-10 h-10 rounded-full object-cover border-2 border-white/10" alt={peer?.name} />
            ) : (
              <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm border-2 border-white/10">
                {peer?.name?.charAt(0)?.toUpperCase()}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col min-w-0">
            <span className="text-white text-xs font-semibold truncate max-w-[100px]">{peer?.name || "Call"}</span>
            <span className="text-emerald-400 text-[10px] font-mono">{formatDuration(callDuration)}</span>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1 ml-1">
            <button
              onClick={(e) => { e.stopPropagation(); toggleMute(); }}
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                isMuted ? "bg-white text-zinc-900" : "bg-white/10 text-white hover:bg-white/20"
              )}
            >
              {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); endCall(); }}
              className="w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all"
            >
              <PhoneOff className="w-3.5 h-3.5 text-white" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setIsMinimized(false); }}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
            >
              <Maximize2 className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    shouldShowFullScreen ? (
      <div className="fixed inset-0 z-[9999] bg-zinc-950 animate-in fade-in duration-500">
        {content}
      </div>
    ) : (
      // Audio call - mobile frame with minimize button
      <div
        className="fixed top-20 bottom-10 right-12 z-[9999] animate-in slide-in-from-right-20 fade-in duration-700 hidden lg:block touch-none"
        style={{ transform: `translate3d(${mobilePosition.x}px, ${mobilePosition.y}px, 0)` }}
        onMouseDown={(e) => handleMouseDown(e, "mobile")}
      >
        {/* Minimize button */}
        <button
          onClick={() => setIsMinimized(true)}
          className="absolute top-3 right-3 z-50 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all border border-white/10"
          title="Minimize call"
        >
          <Minimize2 className="w-4 h-4 text-white" />
        </button>
        <div className="relative w-[310px] h-[480px] bg-zinc-950 rounded-[48px] border-[10px] border-zinc-900 shadow-[0_80px_160px_rgba(0,0,0,1)] overflow-hidden ring-1 ring-white/10 ring-inset">
          {/* Dynamic Island style Notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-7 bg-zinc-900 rounded-b-[20px] z-50 flex items-center justify-center cursor-move">
            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse mr-2" />
            <div className="w-10 h-1.5 bg-white/10 rounded-full" />
          </div>
          <div className="absolute inset-0 pointer-events-none z-40 bg-gradient-to-tr from-transparent via-white/[0.02] to-white/[0.04]" />
          {content}
        </div>
      </div>
    ),
    document.body,
  );
}