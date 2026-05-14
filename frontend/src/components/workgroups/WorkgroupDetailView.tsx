import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { createPortal } from "react-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Users,
  MessageSquare,
  UserPlus,
  Send,
  Pin,
  Trash2,
  MoreHorizontal,
  MoreVertical,
  Reply,
  Crown,
  UserMinus,
  Hash,
  Video,
  Phone,
  Calendar,
  Files,
  Settings,
  Bell,
  Search,
  Smile,
  Paperclip,
  Mic,
  Camera,
  Share,
  Star,
  Download,
  Copy,
  Forward,
  ChevronDown,
  X,
  MessageCircle,
  Shield,
  Plus,
  PhoneMissed,
  ArrowUpRight,
  ArrowDownLeft,
  MapPin,
  Clock,
} from "lucide-react";
import {
  useWorkgroup,
  useWorkgroups,
  useWorkgroupMembers,
  useWorkgroupPosts,
  useAddWorkgroupMember,
  useRemoveWorkgroupMember,
  useCreatePost,
  useDeletePost,
  useDeletePostForMe,
  useTogglePinPost,
  type WorkgroupPost,
} from "@/hooks/useWorkgroups";
import { API_BASE_URL, api, workgroupsApi } from "@/lib/api";
import { getAvatarUrl } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useCustomDialog } from "@/contexts/DialogContext";
import { useRealtime, useWorkgroupRealtime } from "@/hooks/useRealtime";
import { useQueryClient } from "@tanstack/react-query";
import { useVideoCall } from "@/contexts/VideoCallContext";
import { CreateEventDialog } from "@/components/calendar/CreateEventDialog";

interface Props {
  workgroupId: string;
  onBack: () => void;
}

export default function WorkgroupDetailView({ workgroupId, onBack }: Props) {
  const { user, profile } = useAuth();
  const { prompt, confirm } = useCustomDialog();
  const { startCall: startVideoCall, callState } = useVideoCall();
  const { data: workgroup } = useWorkgroup(workgroupId);
  const { data: allWorkgroups = [] } = useWorkgroups();
  const navigate = useNavigate();
  const { data: members = [], isLoading: membersLoading } =
    useWorkgroupMembers(workgroupId);
  const queryClient = useQueryClient();
  const { on: onRealtime, off: offRealtime } = useRealtime();
  const {
    data: posts = [],
    isLoading: postsLoading,
    refetch: refetchPosts,
  } = useWorkgroupPosts(workgroupId);
  const { users: orgUsers = [], isLoading: orgUsersLoading } = useAdminUsers();
  const addMember = useAddWorkgroupMember();
  const removeMember = useRemoveWorkgroupMember();
  const createPost = useCreatePost();
  const deletePost = useDeletePost();
  const deletePostForMe = useDeletePostForMe();
  const togglePin = useTogglePinPost();
  const deleteWorkgroup = useMutation({
    mutationFn: () => workgroupsApi.delete(workgroupId),
    onSuccess: () => {
      toast.success("Team removed successfully");
      onBack();
    },
    onError: (error: any) => {
      const serverMessage = error?.response?.data?.error;
      const fallbackMessage = error?.message;
      toast.error(
        serverMessage ||
        fallbackMessage ||
        "Only team creator/owner can remove this team.",
      );
    },
  });
  const workgroupDisplayName =
    workgroup?.display_name || workgroup?.name || "Direct chat";

  // Listen to Socket.io real-time chat updates
  useWorkgroupRealtime(
    workgroupId,
    (newMessage) => {
      if (!newMessage?.id) return;

      // Handle deleted message real-time update
      if (newMessage.is_deleted) {
        queryClient.setQueriesData(
          { queryKey: ["workgroup-posts", workgroupId] },
          (prev: WorkgroupPost[] | undefined) => {
            if (!Array.isArray(prev)) return prev;
            return prev.map((p) => {
              if (p.id === newMessage.id) {
                return {
                  ...p,
                  is_deleted: true,
                  deleted_for_users: newMessage.deleted_for_users || p.deleted_for_users || [],
                };
              }
              // Check replies too
              if (p.replies?.some((r: any) => r.id === newMessage.id)) {
                return {
                  ...p,
                  replies: p.replies.map((r: any) =>
                    r.id === newMessage.id
                      ? {
                        ...r,
                        is_deleted: true,
                        deleted_for_users: newMessage.deleted_for_users || r.deleted_for_users || [],
                      }
                      : r
                  ),
                };
              }
              return p;
            });
          },
        );
        return;
      }

      if (!newMessage.parent_id) {
        // Root message: inject directly for instant display
        queryClient.setQueriesData(
          { queryKey: ["workgroup-posts", workgroupId] },
          (prev: WorkgroupPost[] | undefined) => {
            if (!Array.isArray(prev)) return prev;
            if (prev.some((p) => p.id === newMessage.id)) return prev;
            return [...prev, { ...newMessage, replies: [] }];
          },
        );
      }
      // Always refetch to sync replies, edits, and server state
      queryClient.invalidateQueries({
        queryKey: ["workgroup-posts", workgroupId],
      });
    },
    (reactionData) => {
      queryClient.invalidateQueries({
        queryKey: ["workgroup-posts", workgroupId],
      });
    },
  );

  useEffect(() => {
    const handlePresenceUpdate = (payload: {
      userId?: string;
      is_online?: boolean;
      last_seen_at?: string | null;
    }) => {
      if (!payload?.userId) return;
      queryClient.setQueryData(
        ["workgroup-members", workgroupId],
        (prev: any[] | undefined) => {
          if (!Array.isArray(prev)) return prev;
          return prev.map((member) =>
            member.user_id === payload.userId
              ? {
                ...member,
                is_online: payload.is_online ?? member.is_online,
                last_seen_at:
                  payload.last_seen_at !== undefined
                    ? payload.last_seen_at
                    : member.last_seen_at,
              }
              : member,
          );
        },
      );
    };

    onRealtime("presence:update", handlePresenceUpdate);
    return () => {
      offRealtime("presence:update", handlePresenceUpdate);
    };
  }, [onRealtime, offRealtime, queryClient, workgroupId]);

  useEffect(() => {
    const handleWorkgroupUpdated = (payload: {
      workgroup_id?: string;
      workgroup?: Record<string, any>;
    }) => {
      if (!payload?.workgroup_id || payload.workgroup_id !== workgroupId)
        return;

      // Invalidate both the specific workgroup and the list to ensure all permissions and settings are refreshed
      queryClient.invalidateQueries({ queryKey: ["workgroup", workgroupId] });
      queryClient.invalidateQueries({ queryKey: ["workgroups"] });
    };

    onRealtime("workgroup:updated", handleWorkgroupUpdated);
    return () => {
      offRealtime("workgroup:updated", handleWorkgroupUpdated);
    };
  }, [onRealtime, offRealtime, queryClient, workgroupId]);

  useEffect(() => {
    const handleMemberAdded = () => {
      queryClient.invalidateQueries({
        queryKey: ["workgroup-members", workgroupId],
      });
      queryClient.invalidateQueries({ queryKey: ["workgroups"] });
    };
    const handleMemberRemoved = () => {
      queryClient.invalidateQueries({
        queryKey: ["workgroup-members", workgroupId],
      });
      queryClient.invalidateQueries({ queryKey: ["workgroups"] });
    };
    onRealtime("workgroup:member_added", handleMemberAdded);
    onRealtime("workgroup:member_removed", handleMemberRemoved);

    const handlePostSeen = (payload: {
      postIds: string[];
      user: { user_id: string; full_name: string; avatar_url?: string };
    }) => {
      if (!payload?.postIds || !payload?.user) return;

      queryClient.setQueriesData(
        { queryKey: ["workgroup-posts", workgroupId] },
        (prev: WorkgroupPost[] | undefined) => {
          if (!Array.isArray(prev)) return prev;
          return prev.map((post) => {
            if (payload.postIds.includes(post.id)) {
              const currentSeenBy = post.seen_by || [];
              if (
                !currentSeenBy.some((u) => u.user_id === payload.user.user_id)
              ) {
                return {
                  ...post,
                  seen_count: (post.seen_count || 0) + 1,
                  seen_by: [...currentSeenBy, payload.user],
                };
              }
            }
            return post;
          });
        },
      );
    };
    onRealtime("workgroup_post:seen", handlePostSeen);

    return () => {
      offRealtime("workgroup:member_added", handleMemberAdded);
      offRealtime("workgroup:member_removed", handleMemberRemoved);
      offRealtime("workgroup_post:seen", handlePostSeen);
    };
  }, [onRealtime, offRealtime, queryClient, workgroupId]);

  const [activeTab, setActiveTab] = useState<
    "posts" | "files" | "wiki" | "settings"
  >("posts");
  const [newPost, setNewPost] = useState("");
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [selectedMentions, setSelectedMentions] = useState<
    Array<{ id: string; label: string }>
  >([]);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [addMemberSearch, setAddMemberSearch] = useState("");
  const [showCreateWikiPage, setShowCreateWikiPage] = useState(false);
  const [newWikiPageTitle, setNewWikiPageTitle] = useState("");
  const [newWikiPageContent, setNewWikiPageContent] = useState("");
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showChannels, setShowChannels] = useState(false);

  const onEventCreated = async (event: any) => {
    // Send a special message to the chat with event details
    try {
      const eventStartTime = event.start_time || event.startTime;
      await createPost.mutateAsync({
        workgroupId,
        content: `📅 **Meeting Scheduled**\n\n**Title:** ${event.title}\n**Time:** ${new Date(eventStartTime).toLocaleString()}\n**Location:** ${event.location || "Online"}\n\n[Click to View in Calendar](/collaboration/calendar)`,
        // We could also add a content_type: "event" if the backend supports it
        // and metadata: { event_id: event.id }
      });
      toast.success("Meeting scheduled and shared in chat!");
    } catch (err) {
      console.error("Failed to share event in chat:", err);
    }
  };
  const [showMembersList, setShowMembersList] = useState(false);
  const [showStarredMessages, setShowStarredMessages] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showInputEmojiPicker, setShowInputEmojiPicker] = useState(false);
  const [isForwardSelectMode, setIsForwardSelectMode] = useState(false);
  const [selectedForwardPostIds, setSelectedForwardPostIds] = useState<
    string[]
  >([]);
  const [showForwardDialog, setShowForwardDialog] = useState(false);
  const [forwardSearch, setForwardSearch] = useState("");
  const [selectedForwardWorkgroupIds, setSelectedForwardWorkgroupIds] =
    useState<string[]>([]);
  const [isForwardingMessages, setIsForwardingMessages] = useState(false);
  const [isDeleteSelectMode, setIsDeleteSelectMode] = useState(false);
  const [isDeletedPlaceholderMode, setIsDeletedPlaceholderMode] = useState(false);
  const [selectedDeletePostIds, setSelectedDeletePostIds] = useState<string[]>(
    [],
  );
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeletingMessages, setIsDeletingMessages] = useState(false);
  const [deleteFilters, setDeleteFilters] = useState({
    image: true,
    video: true,
    document: true,
    text: true,
    call: true,
  });
  const [, setLastSeenTick] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [starredMessages, setStarredMessages] = useState<Set<string>>(() => {
    const saved = localStorage.getItem(`starred_messages_${workgroupId}`);
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  useEffect(() => {
    localStorage.setItem(
      `starred_messages_${workgroupId}`,
      JSON.stringify(Array.from(starredMessages)),
    );
  }, [starredMessages, workgroupId]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const membersScrollRef = useRef<HTMLDivElement>(null);
  const composerEmojiRef = useRef<HTMLDivElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const mentionStartRef = useRef<number | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isSendingFile, setIsSendingFile] = useState(false);
  const dragCounterRef = useRef(0);

  const flatPosts = useMemo(() => {
    const all: WorkgroupPost[] = [];
    const currentUserId = user?.id;

    const isHidden = (p: any) => {
      const deletedForUsers = Array.isArray(p.deleted_for_users)
        ? p.deleted_for_users
        : [];
      const isDeletedForMe =
        currentUserId && deletedForUsers.includes(currentUserId);
      // is_deleted = true means "deleted for everyone" — show placeholder, don't hide
      // isDeletedForMe = "deleted for me only" — hide completely
      return Boolean(isDeletedForMe);
    };

    posts.forEach((p) => {
      if (!isHidden(p)) {
        all.push(p);
      }
      if (p.replies) {
        p.replies.forEach((r) => {
          if (!isHidden(r)) {
            all.push({ ...r, parent_id: r.parent_id || p.id });
          }
        });
      }
    });
    // Sort chronologically (oldest to newest)
    return all.sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  }, [posts, user?.id]);

  const starredMessagesList = useMemo(() => {
    return flatPosts.filter((p) => starredMessages.has(p.id));
  }, [flatPosts, starredMessages]);

  // Auto-cleanup: remove starred IDs that no longer exist in flatPosts (deleted messages)
  useEffect(() => {
    if (starredMessages.size === 0) return;
    const existingIds = new Set(flatPosts.map((p) => p.id));
    const toRemove = [...starredMessages].filter((id) => !existingIds.has(id));
    if (toRemove.length > 0) {
      setStarredMessages((prev) => {
        const next = new Set(prev);
        toRemove.forEach((id) => next.delete(id));
        return next;
      });
    }
  }, [flatPosts]);

  // Filter posts based on search query
  const filteredPosts = useMemo(() => {
    if (!searchQuery.trim()) return flatPosts;

    const query = searchQuery.toLowerCase().trim();
    return flatPosts.filter((post) => {
      // Search in message content
      if (post.content?.toLowerCase().includes(query)) return true;

      // Search in author name
      if (post.author_name?.toLowerCase().includes(query)) return true;

      // Search in attachments
      if (
        post.attachments?.some(
          (att) =>
            att.original_name?.toLowerCase().includes(query) ||
            att.file_type?.toLowerCase().includes(query),
        )
      )
        return true;

      return false;
    });
  }, [flatPosts, searchQuery]);

  // Auto-scroll to bottom on new posts
  useEffect(() => {
    if (!scrollRef.current || !filteredPosts.length) return;
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  }, [filteredPosts]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setLastSeenTick((prev) => prev + 1);
    }, 15000);
    return () => window.clearInterval(interval);
  }, []);

  // Scroll to bottom when entering a chat
  useEffect(() => {
    if (!scrollRef.current || postsLoading) return;
    // Use setTimeout to ensure DOM is fully rendered after data load
    const timer = setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [workgroupId, postsLoading]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isAtBottom =
      target.scrollHeight - target.scrollTop <= target.clientHeight + 150;
    setShowScrollBottom(!isAtBottom);
  };

  const handleToggleStarMessage = (postId: string) => {
    setStarredMessages((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
        toast.success("Removed from starred");
      } else {
        next.add(postId);
        toast.success("Added to starred");
      }
      return next;
    });
  };

  const scrollToMessage = (postId: string) => {
    const el = document.getElementById(`msg-${postId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-yellow-400", "ring-offset-2");
      setTimeout(() => {
        el.classList.remove("ring-2", "ring-yellow-400", "ring-offset-2");
      }, 3000);
    } else {
      toast.error("Message not found");
    }
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  // Real API data
  const { data: files = [], refetch: refetchFiles } = useQuery({
    queryKey: ["workgroup-files", workgroupId],
    queryFn: () => workgroupsApi.getFiles(workgroupId),
    enabled: !!workgroupId,
  });

  const { data: wikiPages = [], refetch: refetchWiki } = useQuery({
    queryKey: ["workgroup-wiki", workgroupId],
    queryFn: () => workgroupsApi.getWikiPages(workgroupId),
    enabled: !!workgroupId,
  });

  const { data: notificationsData, refetch: refetchNotifications } = useQuery({
    queryKey: ["workgroup-notifications", workgroupId],
    queryFn: () => workgroupsApi.getNotifications(workgroupId),
    enabled: !!workgroupId,
  });

  const notifications = notificationsData?.notifications || [];
  const unreadCount = notificationsData?.unread_count || 0;

  // Flatten posts for WhatsApp-style stream

  const forwardTargetWorkgroups = useMemo(
    () =>
      allWorkgroups.filter(
        (wg: any) =>
          wg?.id !== workgroupId &&
          wg?.is_member &&
          wg?.name?.toLowerCase().includes(forwardSearch.toLowerCase()),
      ),
    [allWorkgroups, workgroupId, forwardSearch],
  );

  const selectedForwardPosts = useMemo(() => {
    const selectedSet = new Set(selectedForwardPostIds);
    return flatPosts.filter((post) => selectedSet.has(post.id));
  }, [flatPosts, selectedForwardPostIds]);

  const selectedDeletePosts = useMemo(() => {
    const selectedSet = new Set(selectedDeletePostIds);
    return flatPosts.filter((post) => selectedSet.has(post.id));
  }, [flatPosts, selectedDeletePostIds]);

  const isMember = members.some((m) => m.user_id === user?.id);
  const currentUserMembership = members.find((m) => m.user_id === user?.id);
  const isOwner = currentUserMembership?.role === "owner";
  const isTeamCreator = workgroup?.created_by === user?.id;
  const workgroupSettings = useMemo(() => {
    const rawSettings = (workgroup as any)?.settings;
    if (!rawSettings) return {};
    if (typeof rawSettings === "object") return rawSettings;
    try {
      return JSON.parse(rawSettings);
    } catch (e) {
      return {};
    }
  }, [workgroup]);

  const isDirectChat = Boolean(workgroupSettings?.is_direct_chat);
  const isBroadcast =
    Boolean(workgroupSettings?.is_broadcast) ||
    workgroup?.type === "broadcast" ||
    (workgroup as any)?.is_broadcast === true;

  const assignedMemberManagerId =
    workgroupSettings?.member_manager_user_id ||
    workgroupSettings?.manage_member_user_id ||
    (workgroup as any)?.member_manager_user_id ||
    (workgroup as any)?.manage_member_user_id ||
    null;

  const isAssignedMemberManager =
    assignedMemberManagerId &&
    String(assignedMemberManagerId) === String(user?.id);
  const isChatLocked = !!workgroupSettings?.is_chat_locked;
  const isReactionsLocked = !!workgroupSettings?.is_reactions_locked;
  const modPerms = workgroupSettings?.moderator_permissions || {
    edit_group: true,
    delete_group: false,
    lock_chat: true,
    lock_reactions: true,
    add_members: true,
    delete_members: true,
  };

  const canAddMembers = useMemo(() => {
    if (isDirectChat) return false;
    if (isOwner || isTeamCreator) return true;
    if (isAssignedMemberManager) {
      return !!modPerms.add_members;
    }
    return false;
  }, [
    isDirectChat,
    isOwner,
    isTeamCreator,
    isAssignedMemberManager,
    modPerms.add_members,
  ]);

  const canRemoveMembers = useMemo(() => {
    if (isDirectChat) return false;
    if (isOwner || isTeamCreator) return true;
    if (isAssignedMemberManager) {
      return !!modPerms.delete_members;
    }
    return false;
  }, [
    isDirectChat,
    isOwner,
    isTeamCreator,
    isAssignedMemberManager,
    modPerms.delete_members,
  ]);

  const canManageMembers = canAddMembers || canRemoveMembers;

  const canSendMessages = useMemo(() => {
    // If chat is locked, only owner/creator or moderator can send
    if (isChatLocked) {
      if (isOwner || isTeamCreator || isAssignedMemberManager) return true;
      return false;
    }

    // Broadcast logic
    if (isBroadcast) {
      if (isOwner || isTeamCreator || isAssignedMemberManager) return true;
      return false;
    }

    return true;
  }, [
    isChatLocked,
    isBroadcast,
    isOwner,
    isTeamCreator,
    isAssignedMemberManager,
  ]);

  const canEditTeam = useMemo(() => {
    if (isOwner || isTeamCreator) return true;
    if (isAssignedMemberManager) return !!modPerms.edit_group;
    return false;
  }, [isOwner, isTeamCreator, isAssignedMemberManager, modPerms.edit_group]);

  const canDeleteTeam = useMemo(() => {
    if (isOwner || isTeamCreator) return true;
    if (isAssignedMemberManager) return !!modPerms.delete_group;
    return false;
  }, [isOwner, isTeamCreator, isAssignedMemberManager, modPerms.delete_group]);
  const canDeleteEveryoneForSelection = useMemo(() => {
    const hasElevatedRole = ["owner", "admin"].includes(
      currentUserMembership?.role || "",
    );
    // Only allow "delete for everyone" if user is the author of ALL selected posts
    // OR if user is owner/admin (elevated role)
    if (hasElevatedRole) return true;
    return selectedDeletePosts.every((post) => post.user_id === user?.id);
  }, [
    currentUserMembership?.role,
    selectedDeletePosts,
    user?.id,
  ]);
  const canStartConversation = members.length > 1;
  const memberUserIds = new Set(members.map((m) => m.user_id));
  const availableUsers = orgUsers.filter((u) => !memberUserIds.has(u.id));
  const handlePost = () => {
    if (!newPost.trim() || !canStartConversation) return;
    let mentionsToSend = selectedMentions
      .filter((m) => newPost.includes(`@${m.label}`))
      .map((m) => m.id);

    // Expand "all" mention to actual member UUIDs
    if (mentionsToSend.includes("all")) {
      const allMemberIds = members
        .map((m) => m.user_id)
        .filter((id) => id !== user?.id);
      mentionsToSend = Array.from(
        new Set([...mentionsToSend, ...allMemberIds]),
      ).filter((id) => id !== "all");
    }

    if (replyTo) {
      // Send as reply
      createPost.mutate(
        {
          workgroupId,
          content: newPost,
          parentId: replyTo,
          mentions: mentionsToSend,
        },
        {
          onSuccess: () => {
            setNewPost("");
            setReplyTo(null);
            setSelectedMentions([]);
            setShowMentionSuggestions(false);
            // Reset textarea height
            if (messageInputRef.current) {
              messageInputRef.current.style.height = 'auto';
            }
          },
        },
      );
    } else {
      // Send as normal message
      createPost.mutate(
        { workgroupId, content: newPost, mentions: mentionsToSend },
        {
          onSuccess: () => {
            setNewPost("");
            setSelectedMentions([]);
            setShowMentionSuggestions(false);
            // Reset textarea height
            if (messageInputRef.current) {
              messageInputRef.current.style.height = 'auto';
            }
          },
        },
      );
    }
  };

  const filteredMentionMembers = useMemo(() => {
    const q = mentionQuery.trim().toLowerCase();
    const list = members.filter((m) => m.user_id !== user?.id);

    const filtered = list.filter((m) => {
      if (!q) return true;
      return (
        (m.full_name || "").toLowerCase().includes(q) ||
        (m.email || "").toLowerCase().includes(q)
      );
    });

    // Add "Select All" as the first option if query is empty or matches
    if (
      !q ||
      "everyone".includes(q) ||
      "all".includes(q) ||
      "select".includes(q)
    ) {
      const selectAll = {
        user_id: "all",
        full_name: "Select All (Everyone)",
        email: "Notify all members",
        is_special: true,
      };
      return [selectAll, ...filtered.slice(0, 7)];
    }

    return filtered.slice(0, 8);
  }, [members, mentionQuery, user?.id]);

  const handleComposerChange = (value: string, cursorPos: number) => {
    setNewPost(value);
    const textBeforeCursor = value.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/(?:^|\s)@([^\s@]*)$/);
    if (mentionMatch) {
      const query = mentionMatch[1] || "";
      mentionStartRef.current = cursorPos - query.length - 1;
      setMentionQuery(query);
      setShowMentionSuggestions(true);

      // Auto-insert Select All if query is "all" or "everyone"
      if (query.toLowerCase() === "all" || query.toLowerCase() === "everyone") {
        insertMention({
          user_id: "all",
          full_name: "Select All (Everyone)",
          email: "all members",
        });
      }
    } else {
      mentionStartRef.current = null;
      setShowMentionSuggestions(false);
      setMentionQuery("");
    }
  };

  const insertMention = (member: any) => {
    const label = member.full_name || member.email || "User";
    const input = messageInputRef.current;
    if (!input) return;

    const alreadySelected = selectedMentions.some(
      (m) => m.id === member.user_id,
    );

    if (member.user_id === "all") {
      // Toggle Select All
      if (alreadySelected) {
        // Deselect all
        const label = "Everyone";
        const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const mentionRegex = new RegExp(`@${escapedLabel}\\s?`, "g");
        const cleaned = newPost.replace(mentionRegex, "").trimStart();
        setNewPost(cleaned);
        setSelectedMentions([]);
      } else {
        // Select all members
        const allLabels = members
          .filter((m) => m.user_id !== user?.id)
          .map((m) => ({ id: m.user_id, label: m.full_name || m.email }));

        setSelectedMentions([...allLabels, { id: "all", label: "Everyone" }]);

        // Update input text if needed, but usually just replace the @query with @Everyone
        const cursorPos = input.selectionStart ?? newPost.length;
        const mentionStart = mentionStartRef.current;
        const canReplaceTypedQuery =
          mentionStart !== null &&
          mentionStart >= 0 &&
          mentionStart <= cursorPos;
        const insertStart = canReplaceTypedQuery ? mentionStart : cursorPos;
        const before = newPost.slice(0, insertStart);
        const after = newPost.slice(cursorPos);
        const mentionToken = `@Everyone `;
        const updated = `${before}${mentionToken}${after}`;
        setNewPost(updated);
      }
      setShowMentionSuggestions(false);
      setMentionQuery("");
      mentionStartRef.current = null;
      return;
    }

    if (alreadySelected) {
      const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const mentionRegex = new RegExp(`@${escapedLabel}\\s?`, "g");
      const cleaned = newPost
        .replace(mentionRegex, "")
        .replace(/\s{2,}/g, " ")
        .trimStart();
      setNewPost(cleaned);
      setSelectedMentions((prev) =>
        prev.filter((m) => m.id !== member.user_id),
      );
      setShowMentionSuggestions(true);
      setMentionQuery("");
      mentionStartRef.current = null;
      requestAnimationFrame(() => {
        input.focus();
        const pos = cleaned.length;
        input.setSelectionRange(pos, pos);
      });
      return;
    }

    const cursorPos = input.selectionStart ?? newPost.length;
    const mentionStart = mentionStartRef.current;
    const canReplaceTypedQuery =
      mentionStart !== null && mentionStart >= 0 && mentionStart <= cursorPos;
    const insertStart = canReplaceTypedQuery ? mentionStart : cursorPos;
    const before = newPost.slice(0, insertStart);
    const after = canReplaceTypedQuery
      ? newPost.slice(cursorPos)
      : newPost.slice(cursorPos);
    const mentionToken = `@${label} `;
    const updated = `${before}${mentionToken}${after}`;
    const nextCursor = (before + mentionToken).length;

    setNewPost(updated);
    setSelectedMentions((prev) => {
      if (prev.some((m) => m.id === member.user_id)) return prev;
      return [...prev, { id: member.user_id, label }];
    });
    setShowMentionSuggestions(true);
    setMentionQuery("");
    mentionStartRef.current = null;

    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const handleToggleForwardPost = (postId: string, checked: boolean) => {
    setSelectedForwardPostIds((prev) => {
      if (checked) return Array.from(new Set([...prev, postId]));
      return prev.filter((id) => id !== postId);
    });
  };

  const startForwardSelection = (postId: string) => {
    setIsForwardSelectMode(true);
    setSelectedForwardPostIds([postId]);
  };

  const clearForwardSelection = () => {
    setIsForwardSelectMode(false);
    setSelectedForwardPostIds([]);
    setSelectedForwardWorkgroupIds([]);
    setShowForwardDialog(false);
  };

  const toggleForwardTarget = (targetWorkgroupId: string, checked: boolean) => {
    setSelectedForwardWorkgroupIds((prev) => {
      if (checked) return Array.from(new Set([...prev, targetWorkgroupId]));
      return prev.filter((id) => id !== targetWorkgroupId);
    });
  };

  const handleForwardSelectedMessages = async () => {
    if (selectedForwardPosts.length === 0) {
      toast.error("Please select at least one message");
      return;
    }
    if (selectedForwardWorkgroupIds.length === 0) {
      toast.error("Please select at least one chat");
      return;
    }

    setIsForwardingMessages(true);
    try {
      const forwardedBy =
        profile?.full_name?.trim() ||
        user?.full_name?.trim() ||
        (user as any)?.name?.trim() ||
        "User";
      for (const targetWorkgroupId of selectedForwardWorkgroupIds) {
        for (const post of selectedForwardPosts) {
          const cleanedContent = (post.content || "").replace(
            /^(\[Forwarded from [^\]]+\]\s*\n)+/g,
            "",
          );
          await workgroupsApi.createPost(targetWorkgroupId, {
            content: `[Forwarded from ${forwardedBy}]\n${cleanedContent}`,
          });
        }
      }

      toast.success("Messages forwarded successfully");
      clearForwardSelection();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Failed to forward messages");
    } finally {
      setIsForwardingMessages(false);
    }
  };

  const handleToggleDeletePost = (postId: string, checked: boolean) => {
    setSelectedDeletePostIds((prev) => {
      if (checked) return Array.from(new Set([...prev, postId]));
      return prev.filter((id) => id !== postId);
    });
  };

  const startDeleteSelection = (postId: string) => {
    setIsDeleteSelectMode(true);
    setSelectedDeletePostIds([postId]);
    // Check if this is a deleted placeholder
    const targetPost = flatPosts.find(p => p.id === postId);
    setIsDeletedPlaceholderMode(Boolean(targetPost?.is_deleted));
  };

  const clearDeleteSelection = () => {
    setIsDeleteSelectMode(false);
    setIsDeletedPlaceholderMode(false);
    setSelectedDeletePostIds([]);
    setShowDeleteDialog(false);
  };

  const handleDeleteSelectedMessages = async (mode: "me" | "everyone") => {
    if (selectedDeletePostIds.length === 0) return;
    setIsDeletingMessages(true);
    try {
      // Filter post IDs based on selected categories
      const filteredPostIds = selectedDeletePostIds.filter((postId) => {
        const post = flatPosts.find((p) => p.id === postId) || posts.find((p) => p.id === postId);
        if (!post) return true; // include if not found (already deleted placeholder)

        // Explicitly handle call logs first
        if (post.content_type === "call") {
          return deleteFilters.call;
        }

        const hasAttachments =
          Array.isArray(post.attachments) && post.attachments.length > 0;
        if (!hasAttachments) {
          return deleteFilters.text;
        }

        const types = post.attachments.map((a: any) =>
          (a.file_type || "").toLowerCase(),
        );
        const isImage = types.some((t: string) => t.startsWith("image/"));
        const isVideo = types.some((t: string) => t.startsWith("video/"));
        const isDoc = types.some(
          (t: string) => !t.startsWith("image/") && !t.startsWith("video/"),
        );

        if (isImage && !deleteFilters.image) return false;
        if (isVideo && !deleteFilters.video) return false;
        if (isDoc && !deleteFilters.document) return false;

        return true;
      });

      if (filteredPostIds.length === 0) {
        toast.info("No messages match the selected filters");
        setIsDeletingMessages(false);
        return;
      }

      if (mode === "everyone") {
        await Promise.all(
          filteredPostIds.map((id) =>
            deletePost.mutateAsync({ postId: id, workgroupId }),
          ),
        );
      } else {
        await Promise.all(
          filteredPostIds.map((id) =>
            deletePostForMe.mutateAsync({ postId: id, workgroupId }),
          ),
        );
      }
      toast.success("Messages deleted successfully");
      // Remove deleted messages from starred list
      setStarredMessages((prev) => {
        const next = new Set(prev);
        filteredPostIds.forEach((id) => next.delete(id));
        return next;
      });
      clearDeleteSelection();
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete messages");
    } finally {
      setIsDeletingMessages(false);
    }
  };

  const handleSelectAllForDelete = (checked: boolean) => {
    if (checked) {
      setSelectedDeletePostIds(posts.map((p) => p.id));
    } else {
      setSelectedDeletePostIds([]);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
  };

  const getAuthedFileUrl = (
    fileId: string,
    mode: "view" | "download" = "download",
  ) => {
    const token = api.getToken();
    const baseUrl = `${API_BASE_URL}/workgroups/${workgroupId}/files/${fileId}/${mode}`;
    return token ? `${baseUrl}?token=${encodeURIComponent(token)}` : baseUrl;
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        composerEmojiRef.current &&
        !composerEmojiRef.current.contains(event.target as Node)
      ) {
        setShowInputEmojiPicker(false);
        setShowMentionSuggestions(false);
      }
    };

    if (showInputEmojiPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showInputEmojiPicker]);

  const handleComposerEmojiSelect = (emojiData: EmojiClickData) => {
    setNewPost((prev) => `${prev}${emojiData.emoji}`);
    setShowInputEmojiPicker(false);
  };

  const handleAttachFromComposer = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file || !canStartConversation) return;
    await sendFile(file);
    if (attachmentInputRef.current) attachmentInputRef.current.value = "";
  };

  const sendFile = async (file: File) => {
    if (!canStartConversation) return;
    setIsSendingFile(true);
    try {
      const uploadedFile = await workgroupsApi.uploadFile(workgroupId, file);
      await createPost.mutateAsync({
        workgroupId,
        content: newPost.trim() || `📎 ${uploadedFile.original_name}`,
        parentId: replyTo || undefined,
        mentions: selectedMentions
          .filter((m) => (newPost.trim() || "").includes(`@${m.label}`))
          .map((m) => m.id),
        files: [
          {
            id: uploadedFile.id,
            original_name: uploadedFile.original_name,
            file_type: uploadedFile.file_type,
            file_size: uploadedFile.file_size,
            download_url: `/api/workgroups/${workgroupId}/files/${uploadedFile.id}/download`,
          },
        ],
      });
      setNewPost("");
      setReplyTo(null);
      setSelectedMentions([]);
      setShowMentionSuggestions(false);
      toast.success("File sent successfully");
    } catch (error: any) {
      toast.error(
        error?.response?.data?.error || error?.message || "Failed to send file",
      );
    } finally {
      setIsSendingFile(false);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes("Files")) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (!files.length || !canStartConversation) return;
    for (const file of files) {
      await sendFile(file);
    }
  };

  const findMessageById = (id: string) => {
    // Search in top-level posts
    const found = posts.find((p) => p.id === id);
    if (found) return found;

    // Search in replies
    for (const p of posts) {
      if (p.replies) {
        const reply = p.replies.find((r) => r.id === id);
        if (reply) return reply;
      }
    }
    return null;
  };

  const handleStartMeeting = () => {
    if (callState !== "idle") {
      toast.error("You are already in a call");
      return;
    }

    const isGroup = workgroup?.type !== "direct";
    const otherMembers = members.filter((m) => m.user_id !== user?.id);

    if (otherMembers.length === 0) {
      toast.error("No other members to call");
      return;
    }

    if (isGroup) {
      // Group Call: Signal all members
      startVideoCall(
        "", // No specific target, broadcast to room
        workgroupDisplayName,
        workgroup?.avatar_url || null,
        "video",
        workgroupId,
        true, // forceGroupCall
        isAssignedMemberManager,
      );
    } else {
      // 1-on-1 Call: Target the specific member
      const otherMember = otherMembers[0];
      startVideoCall(
        otherMember.user_id,
        otherMember.full_name || otherMember.email || "Unknown",
        otherMember.avatar_url || null,
        "video",
        workgroupId,
        false, // forceGroupCall
        isAssignedMemberManager,
      );
    }
  };

  const handleStartCall = () => {
    if (callState !== "idle") {
      toast.error("You are already in a call");
      return;
    }

    const isGroup = workgroup?.type !== "direct";
    const otherMembers = members.filter((m) => m.user_id !== user?.id);

    if (otherMembers.length === 0) {
      toast.error("No other members to call");
      return;
    }

    if (isGroup) {
      // Group Call: Signal all members
      startVideoCall(
        "",
        workgroupDisplayName,
        workgroup?.avatar_url || null,
        "audio",
        workgroupId,
        true, // forceGroupCall
        isAssignedMemberManager,
      );
    } else {
      // 1-on-1 Call: Target the specific member
      const otherMember = otherMembers[0];
      startVideoCall(
        otherMember.user_id,
        otherMember.full_name || otherMember.email || "Unknown",
        otherMember.avatar_url || null,
        "audio",
        workgroupId,
        false, // forceGroupCall
        isAssignedMemberManager,
      );
    }
  };

  const handleUploadFile = () => {
    // Create file input
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.onchange = async (e: any) => {
      const files = Array.from(e.target.files);

      try {
        for (const file of files) {
          await workgroupsApi.uploadFile(workgroupId, file as File);
        }
        refetchFiles();
        toast.success(`${files.length} file(s) uploaded successfully!`);
      } catch (error: any) {
        toast.error(error.response?.data?.error || "Failed to upload files");
      }
    };
    input.click();
  };

  const handleCreateWikiPage = async () => {
    setShowCreateWikiPage(true);
  };

  const handleCreateWikiPageSubmit = async () => {
    if (!newWikiPageTitle.trim()) return;

    try {
      await workgroupsApi.createWikiPage(workgroupId, {
        title: newWikiPageTitle,
        content:
          newWikiPageContent || "This is a new wiki page. Click to edit...",
      });
      refetchWiki();
      toast.success(`Wiki page "${newWikiPageTitle}" created!`);
      setShowCreateWikiPage(false);
      setNewWikiPageTitle("");
      setNewWikiPageContent("");
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to create wiki page");
    }
  };

  const markNotificationAsRead = async (notificationId: string) => {
    try {
      await workgroupsApi.markNotificationAsRead(workgroupId, notificationId);
      refetchNotifications();
    } catch (error: any) {
      toast.error(
        error.response?.data?.error || "Failed to mark notification as read",
      );
    }
  };

  const markAllNotificationsAsRead = async () => {
    try {
      await workgroupsApi.markAllNotificationsAsRead(workgroupId);
      refetchNotifications();
      setShowNotifications(false);
      toast.success("All notifications marked as read");
    } catch (error: any) {
      toast.error(
        error.response?.data?.error || "Failed to mark notifications as read",
      );
    }
  };

  const handleAddMember = () => {
    if (!selectedUserId) return;
    addMember.mutate(
      { workgroupId, userId: selectedUserId, role: "member" },
      {
        onSuccess: () => {
          setShowAddMember(false);
          setSelectedUserId("");
          setAddMemberSearch("");
          toast.success("Team member added successfully!");
        },
        onError: (error: any) => {
          toast.error(error.response?.data?.error || "Failed to add member");
        },
      },
    );
  };

  const handleRemoveTeam = async () => {
    const shouldRemove = await confirm(
      "Are you sure you want to remove this team? This action cannot be undone.",
      {
        title: "Remove Team",
        variant: "destructive",
      },
    );
    if (!shouldRemove) return;
    deleteWorkgroup.mutate();
  };

  const handleRemoveMemberFromChat = async (memberUserId: string) => {
    const memberToRemove = members.find((m) => m.user_id === memberUserId);
    if (!memberToRemove) return;
    if (
      memberToRemove.role === "owner" ||
      memberToRemove.user_id === user?.id
    ) {
      return;
    }

    const shouldRemove = await confirm(
      `Remove ${memberToRemove.full_name || memberToRemove.email} from this team?`,
      {
        title: "Remove Team Member",
        variant: "destructive",
      },
    );
    if (!shouldRemove) return;

    removeMember.mutate({
      memberId: memberToRemove.id,
      workgroupId,
    });
  };

  const handleLeaveTeam = async (memberId: string) => {
    const shouldLeave = await confirm(
      "Are you sure you want to leave this team?",
      {
        title: "Leave Team",
        variant: "destructive",
      },
    );
    if (!shouldLeave) return;

    removeMember.mutate(
      {
        memberId,
        workgroupId,
      },
      {
        onSuccess: () => {
          toast.success("You left the team");
          onBack();
        },
      },
    );
  };

  const sortedMembers = useMemo(() => {
    if (!members || !Array.isArray(members)) return [];

    return [...members].sort((a, b) => {
      const isMeA = a.user_id === user?.id;
      const isMeB = b.user_id === user?.id;
      const isModA =
        assignedMemberManagerId &&
        String(a.user_id) === String(assignedMemberManagerId);
      const isModB =
        assignedMemberManagerId &&
        String(b.user_id) === String(assignedMemberManagerId);

      // Helper function to get priority
      // 100: Owner, 90: Moderator, 80: Current User (Me), 70: Admin, 0: Others
      const getPriority = (m: any, isMe: boolean, isMod: boolean) => {
        if (isMe) return 1000; // Always top priority
        if (m.role === "owner") return 100;
        if (isMod) return 90;
        if (m.role === "admin") return 70;
        return 0;
      };

      const pA = getPriority(a, isMeA, isModA);
      const pB = getPriority(b, isMeB, isModB);

      if (pA !== pB) return pB - pA;

      // Default alphabetical
      return (a.full_name || "").localeCompare(b.full_name || "");
    });
  }, [members, user?.id, assignedMemberManagerId]);

  if (!workgroup) {
    return (
      <div className="min-h-full bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading team...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-background flex overflow-hidden">
      {/* Left Sidebar - Team Info & Members */}
      <div className="w-80 bg-card border-r border-border flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Avatar className="h-10 w-10">
              <AvatarImage
                src={getAvatarUrl(
                  (workgroup as any).avatar_url ||
                  (workgroup as any).direct_peer_avatar_url,
                )}
              />
              <AvatarFallback
                className={`${workgroup.avatar_color} text-white font-semibold`}
              >
                {workgroupDisplayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-gray-900 dark:text-white truncate">
                {workgroupDisplayName}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {!isDirectChat && `${members.length} members`}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={async () => {
                    // Find another member to start direct chat with
                    const otherMember = members.find(
                      (m) => m.user_id !== user?.id,
                    );
                    if (otherMember) {
                      try {
                        console.log(
                          "Opening direct chat with user:",
                          otherMember.user_id,
                        );
                        const direct = await workgroupsApi.openDirectChat(
                          otherMember.user_id,
                        );
                        console.log("Direct chat response:", direct);
                        if (direct?.id) {
                          navigate(
                            `/collaboration/workgroups?team=${direct.id}`,
                          );
                        } else {
                          toast.error("No direct chat ID returned from server");
                        }
                      } catch (error: any) {
                        console.error("Direct chat error:", error);
                        const serverMessage = error?.response?.data?.error;
                        const fallbackMessage = error?.message;
                        toast.error(
                          serverMessage ||
                          fallbackMessage ||
                          "Failed to open direct chat",
                        );
                      }
                    } else {
                      toast.error("No other members available for direct chat");
                    }
                  }}
                >
                  <MessageCircle className="h-4 w-4 mr-2" /> Direct Chat
                </DropdownMenuItem>
                {!isDirectChat && canManageMembers && (
                  <DropdownMenuItem onClick={() => setShowMembersList(true)}>
                    <Users className="h-4 w-4 mr-2" /> Manage Members
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setShowNotifications(true)}>
                  <Bell className="h-4 w-4 mr-2" />
                  Notifications
                  {unreadCount > 0 && (
                    <Badge
                      variant="destructive"
                      className="ml-2 h-5 w-5 p-0 text-xs"
                    >
                      {unreadCount}
                    </Badge>
                  )}
                </DropdownMenuItem>
                {/* {!isDirectChat && canEditTeam && (
                  <DropdownMenuItem>
                    <Settings className="h-4 w-4 mr-2" /> Team Settings
                  </DropdownMenuItem>
                )} */}
                {!isDirectChat && canDeleteTeam && (
                  <DropdownMenuItem
                    onClick={handleRemoveTeam}
                    className="text-red-600 dark:text-red-400"
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Remove Team
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {workgroup.description && (
            <div className="mb-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-gray-600 dark:text-gray-400 truncate flex-1">
                  {workgroup.description}
                </p>
                <button
                  onClick={() => setShowAboutModal(true)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap"
                >
                  Read more
                </button>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white gap-2"
              onClick={handleStartMeeting}
            >
              <Video className="h-4 w-4" />
              Meet
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 gap-2"
              onClick={handleStartCall}
            >
              <Phone className="h-4 w-4" />
              Call
            </Button>
          </div>
        </div>

        {/* Channels */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => {
              const newState = !showChannels;
              setShowChannels(newState);
              if (newState) {
                setActiveTab("posts");
              }
            }}
            className="flex items-center justify-between w-full text-sm font-semibold text-gray-900 dark:text-white mb-1 group"
          >
            <span className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-gray-500" />
              Channels
            </span>
            <ChevronDown
              className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${showChannels ? "" : "-rotate-90"
                }`}
            />
          </button>

          {showChannels && (
            <div className="space-y-1 mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <div
                className={`flex items-center gap-2 px-3  py-2 rounded-lg cursor-pointer transition-colors ${activeTab === "posts"
                  ? "bg-blue-50 dark:bg-blue-900/20 text-primary dark:text-blue-300"
                  : "hover:bg-primary hover:text-white"
                  }`}
                onClick={() => setActiveTab("posts")}
              >
                <Hash className="h-4 w-4" />
                <span className="text-sm font-medium">General</span>
                <Badge variant="secondary" className="ml-auto text-xs">
                  {posts.length}
                </Badge>
              </div>
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${activeTab === "files"
                  ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                  : "hover:bg-primary hover:text-white dark:hover:bg-primary"
                  }`}
                onClick={() => setActiveTab("files")}
              >
                <Files className="h-4 w-4" />
                <span className="text-sm font-medium">Files</span>
                <Badge variant="secondary" className="ml-auto text-xs">
                  {files.length}
                </Badge>
              </div>
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${activeTab === "wiki"
                  ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                  : "hover:bg-primary hover:text-white dark:hover:bg-primary"
                  }`}
                onClick={() => setActiveTab("wiki")}
              >
                <MessageSquare className="h-4 w-4" />
                <span className="text-sm font-medium">Wiki</span>
                <Badge variant="secondary" className="ml-auto text-xs">
                  {wikiPages.length}
                </Badge>
              </div>
            </div>
          )}
        </div>

        {/* Members Preview */}
        <div className="p-4 flex-1 min-h-0 flex flex-col">
          <div className="sticky top-0 z-10 bg-card pb-2">
            <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              {isDirectChat
                ? "Chat participants"
                : `Members (${members.length})`}
            </h3>
            {canAddMembers && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowAddMember(true)}
                className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600"
                title="Add Member"
              >
                <UserPlus className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Add Member Quick Button */}
          {canAddMembers && (
            <div className="mb-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAddMember(true)}
                className="w-full gap-2 border-dashed border-blue-300 text-primary hover:text-white hover:bg-primary"
              >
                <UserPlus className="h-4 w-4" />
                Add Team Member
              </Button>
            </div>
          )}
          </div>

          <div
            ref={membersScrollRef}
            className="space-y-2 flex-1 overflow-y-auto pr-1 custom-scrollbar"
          >
            {sortedMembers.map((member) => (
              <div
                key={member.id}
                className="group flex items-start gap-2 p-2.5 rounded-xl border border-border bg-background/60 hover:border-primary/30 hover:bg-primary/5 transition-colors"
              >
                <div className="relative">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={getAvatarUrl(member.avatar_url)} />
                    <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                      {(member.full_name || "?").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background ${member.is_online ? "bg-emerald-500" : "bg-gray-400"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {member.full_name || member.email || "Unknown"}
                    </p>
                    {assignedMemberManagerId &&
                      String(member.user_id || (member as any).id) ===
                      String(assignedMemberManagerId) && (
                        <Badge className="bg-indigo-600 hover:bg-indigo-600 text-white font-bold px-2 py-0.5 ml-8 text-[9px]">
                          Moderator
                        </Badge>
                      )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                    {!isDirectChat && member.role === "owner" && (
                      <Crown className="h-3 w-3 text-yellow-500" />
                    )}
                    {!isDirectChat && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {member.role}
                      </span>
                    )}
                    <span
                      className={`text-xs font-medium ml-1 ${member.is_online
                        ? "text-primary"
                        : "text-red-500 dark:text-red-400"
                        }`}
                    >
                      {member.is_online ? "Online" : "Offline"}
                    </span>
                  </div>
                  {!isDirectChat && !member.is_online && (
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                      {member.last_seen_at ? (
                        <>
                          Last seen{" "}
                          {formatDistanceToNow(new Date(member.last_seen_at), {
                            addSuffix: true,
                          })}
                        </>
                      ) : (
                        <>Last seen recently</>
                      )}
                    </p>
                  )}
                </div>
                {!isDirectChat &&
                  ((member.user_id === user?.id && member.role !== "owner") ||
                    member.user_id !== user?.id) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-gray-600 dark:text-gray-300 transition-colors group-hover:bg-primary group-hover:text-white hover:bg-primary hover:text-white"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {member.user_id !== user?.id && (
                          <DropdownMenuItem
                            onClick={async () => {
                              try {
                                console.log(
                                  "Opening direct chat with user:",
                                  member.user_id,
                                );
                                const direct = await workgroupsApi.openDirectChat(
                                  member.user_id,
                                );
                                console.log("Direct chat response:", direct);
                                if (direct?.id) {
                                  navigate(
                                    `/collaboration/workgroups?team=${direct.id}`,
                                  );
                                } else {
                                  toast.error(
                                    "No direct chat ID returned from server",
                                  );
                                }
                              } catch (error: any) {
                                console.error("Direct chat error:", error);
                                const serverMessage =
                                  error?.response?.data?.error;
                                const fallbackMessage = error?.message;
                                toast.error(
                                  serverMessage ||
                                  fallbackMessage ||
                                  "Failed to open direct chat",
                                );
                              }
                            }}
                          >
                            <MessageCircle className="h-4 w-4 mr-2" /> Direct Chat
                          </DropdownMenuItem>
                        )}
                        {member.user_id === user?.id ? (
                          <DropdownMenuItem
                            className="text-red-600 dark:text-red-400"
                            onClick={() => handleLeaveTeam(member.id)}
                          >
                            <UserMinus className="h-4 w-4 mr-2" />
                            Leave Team
                          </DropdownMenuItem>
                        ) : (
                          canRemoveMembers && (
                            <DropdownMenuItem
                              className="text-red-600 dark:text-red-400"
                              onClick={() =>
                                removeMember.mutate({
                                  memberId: member.id,
                                  workgroupId,
                                })
                              }
                            >
                              <UserMinus className="h-4 w-4 mr-2" />
                              Remove Team Member
                            </DropdownMenuItem>
                          )
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="bg-card border-b border-border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                {activeTab === "posts"
                  ? "General"
                  : activeTab === "files"
                    ? "Files"
                    : activeTab === "wiki"
                      ? "Wiki"
                      : "Settings"}
              </h1>
              <Badge variant="secondary" className="text-xs">
                {activeTab === "posts"
                  ? `${posts.length} messages`
                  : activeTab === "files"
                    ? "0 files"
                    : ""}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search in this channel..."
                  className="pl-10 w-64 bg-muted/40"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                    onClick={clearSearch}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowStarredMessages(true)}
                className={starredMessagesList.length > 0 ? "text-yellow-500" : "text-white/60 hover:text-white"}
              >
                <Star
                  className={`h-4 w-4 ${starredMessagesList.length > 0 ? "fill-current" : ""}`}
                />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowNotifications(true)}
                className="relative group"
              >
                <Bell className="h-4 w-4" />

                {unreadCount > 0 && (
                  <div className="absolute top-1 -right-1 flex items-center justify-center min-w-[14px] h-[14px] px-1 rounded-full bg-transparent">
                    <span className="text-xs text-primary font-bold group-hover:text-white transition-colors">
                      {unreadCount}
                    </span>
                  </div>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeTab === "posts" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {!isMember ? (
                <div className="flex-1 flex items-center justify-center p-6">
                  <div className="text-center max-w-md">
                    <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      Access restricted
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      You are not a member of this team. Join this team to view
                      and send chat messages.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Messages Area - WhatsApp style background */}
                  <div
                    ref={scrollRef}
                    onScroll={handleScroll}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    className="flex-1 overflow-y-auto p-4 space-y-2 relative"
                    style={{
                      backgroundImage:
                        "url(\"data:image/svg+xml,%3Csvg width='200' height='200' viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%239C92AC' fill-opacity='0.03'%3E%3Cpath d='M100 0L200 100L100 200L0 100Z'/%3E%3C/g%3E%3C/svg%3E\")",
                    }}
                  >
                    {/* Drag overlay */}
                    {isDragging && (
                      <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-primary/10 border-4 border-dashed border-primary rounded-xl backdrop-blur-sm pointer-events-none">
                        <Paperclip className="h-12 w-12 text-primary mb-3" />
                        <p className="text-lg font-bold text-primary">
                          Drop files to send
                        </p>
                        <p className="text-sm text-primary/70 mt-1">
                          Release to upload and send
                        </p>
                      </div>
                    )}
                    {postsLoading ? (
                      <div className="text-center py-8">
                        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                        <p className="text-gray-500">Loading messages...</p>
                      </div>
                    ) : posts.length === 0 ? (
                      <div className="text-center py-12">
                        <MessageSquare className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                          {canStartConversation
                            ? "Start a conversation"
                            : isDirectChat
                              ? "Conversation unavailable"
                              : "Add team member first"}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                          {canStartConversation
                            ? "Be the first to share something with your team!"
                            : isDirectChat
                              ? "This direct chat is not ready yet."
                              : "Conversation will start after you add at least one team member."}
                        </p>
                        {canAddMembers && (
                          <div className="mb-3 pt-20">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setShowAddMember(true)}
                              className="w-2xl gap-2 p-7 text-lg border-dashed border-blue-300 text-white bg-primary hover:text-white hover:bg-primary hover:shadow-xl"
                            >
                              <UserPlus className="h-13 w-13" />
                              Add Team Member
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        {/* Search Results Indicator */}
                        {searchQuery.trim() && (
                          <div className="flex justify-center mb-4">
                            <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                              <p className="text-sm text-blue-700 dark:text-blue-300">
                                {filteredPosts.length === 0
                                  ? `No messages found for "${searchQuery}"`
                                  : `Found ${filteredPosts.length} message${filteredPosts.length !== 1 ? "s" : ""} for "${searchQuery}"`}
                              </p>
                            </div>
                          </div>
                        )}

                        {filteredPosts.length === 0 && searchQuery.trim() ? (
                          <div className="text-center py-12">
                            <Search className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                              No messages found
                            </h3>
                            <p className="text-gray-600 dark:text-gray-400 mb-6">
                              Try searching with different keywords or clear the
                              search to see all messages.
                            </p>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={clearSearch}
                              className="gap-2"
                            >
                              <X className="h-4 w-4" />
                              Clear Search
                            </Button>
                          </div>
                        ) : (
                          filteredPosts.map((post, index) => {
                            const prevPost =
                              index > 0 ? filteredPosts[index - 1] : null;
                            const currentDate = new Date(
                              post.created_at,
                            ).toDateString();
                            const prevDate = prevPost
                              ? new Date(prevPost.created_at).toDateString()
                              : null;
                            const showDateSeparator = currentDate !== prevDate;

                            const dateLabel = () => {
                              const today = new Date().toDateString();
                              const yesterday = new Date(
                                Date.now() - 86400000,
                              ).toDateString();
                              if (currentDate === today) return "Today";
                              if (currentDate === yesterday) return "Yesterday";
                              return new Date(
                                post.created_at,
                              ).toLocaleDateString(undefined, {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              });
                            };

                            return (
                              <div key={post.id}>
                                {showDateSeparator && (
                                  <div className="flex justify-center my-6">
                                    <span className="px-3 py-1 bg-card/80 backdrop-blur-sm rounded-lg text-[11px] font-bold text-muted-foreground shadow-sm border border-border uppercase tracking-wider">
                                      {dateLabel()}
                                    </span>
                                  </div>
                                )}
                <PostCard
                                  post={post}
                                  allPosts={flatPosts}
                                  workgroupId={workgroupId}
                                  isGroupAdmin={canRemoveMembers}
                                  isMember={isMember}
                                  canSendMessages={canSendMessages}
                                  isBroadcast={workgroup?.type === "private" && Boolean(workgroup?.settings?.is_broadcast)}
                                  currentUserId={user?.id}
                                  memberDirectory={members}
                                  postAuthorRole={
                                    members.find(
                                      (m) => m.user_id === post.user_id,
                                    )?.role
                                  }
                                  onSetReplyTo={setReplyTo}
                                  onScrollToMessage={scrollToMessage}
                                  onRemoveMemberFromChat={
                                    handleRemoveMemberFromChat
                                  }
                                  isForwardSelectMode={isForwardSelectMode}
                                  isSelectedForForward={selectedForwardPostIds.includes(
                                    post.id,
                                  )}
                                  onToggleForwardSelection={
                                    handleToggleForwardPost
                                  }
                                  onStartForwardSelection={
                                    startForwardSelection
                                  }
                                  isDeleteSelectMode={isDeleteSelectMode}
                                  isSelectedForDelete={selectedDeletePostIds.includes(
                                    post.id,
                                  )}
                                  onToggleDeleteSelection={
                                    handleToggleDeletePost
                                  }
                                  onStartDeleteSelection={startDeleteSelection}
                                  onDelete={(postId) => {
                                    const targetPost = flatPosts.find(p => p.id === postId);
                                    if (targetPost?.is_deleted) {
                                      // Already deleted for everyone — remove placeholder for ALL members
                                      deletePost.mutate({ postId, workgroupId });
                                    } else {
                                      deletePost.mutate({ postId, workgroupId });
                                    }
                                  }}
                                  onDeleteForMe={(postId) =>
                                    deletePostForMe.mutate({ postId, workgroupId })
                                  }
                                  onTogglePin={(postId, isPinned) =>
                                    togglePin.mutate({
                                      postId,
                                      isPinned,
                                      workgroupId,
                                    })
                                  }
                                  isStarred={starredMessages.has(post.id)}
                                  onToggleStar={handleToggleStarMessage}
                                  searchQuery={searchQuery}
                                  onReaction={async (postId, emoji) => {
                                    if (isReactionsLocked && !isOwner && !isTeamCreator && !isAssignedMemberManager) {
                                      toast.error("Reactions are locked for this group");
                                      return;
                                    }
                                    try {
                                      const response = await fetch(
                                        `${import.meta.env.VITE_API_URL || "http://localhost:3001/api"}/workgroups/${workgroupId}/posts/${postId}/reactions`,
                                        {
                                          method: "POST",
                                          headers: {
                                            "Content-Type": "application/json",
                                            Authorization: `Bearer ${localStorage.getItem("token")}`,
                                          },
                                          body: JSON.stringify({
                                            reaction: emoji,
                                          }),
                                        },
                                      );
                                      if (response.ok) {
                                        queryClient.invalidateQueries({
                                          queryKey: [
                                            "workgroup-posts",
                                            workgroupId,
                                          ],
                                        });
                                      }
                                    } catch (err) {
                                      console.error("Reaction failed:", err);
                                    }
                                  }}
                                />
                              </div>
                            );
                          })
                        )}
                      </>
                    )}

                    {/* Scroll to Bottom Button */}
                    {showScrollBottom && (
                      <button
                        onClick={scrollToBottom}
                        className="fixed bottom-24 right-8 z-50 bg-card p-2.5 rounded-full shadow-lg border border-border text-muted-foreground hover:text-primary transition-all hover:scale-110 active:scale-95 animate-in fade-in zoom-in duration-200"
                      >
                        <ChevronDown className="h-5 w-5" />
                      </button>
                    )}
                  </div>

                  {/* Message Input - Fixed at Bottom */}
                  {isMember && canStartConversation && (
                    <div className="flex-shrink-0 border-t border-border p-3 bg-card">
                      <div className="max-w-5xl mx-auto w-full flex flex-col gap-2">
                        {!canSendMessages ? (
                          <div className="flex items-center justify-center p-3 bg-muted/30 rounded-xl border border-dashed border-border">
                            <p className="text-sm text-muted-foreground flex items-center gap-2">
                              <Shield className="h-4 w-4 text-indigo-500" />
                              Only{" "}
                              <span className="font-bold text-red-500">
                                admins
                              </span>{" "}
                              can send messages to this broadcast channel.
                            </p>
                          </div>
                        ) : (
                          <>
                            {/* File uploading indicator */}
                            {isSendingFile && (
                              <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-lg border border-primary/20 animate-in slide-in-from-bottom-2 duration-200">
                                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
                                <span className="text-xs font-medium text-primary">
                                  Uploading file...
                                </span>
                              </div>
                            )}
                            {/* Reply Preview (WhatsApp style) */}
                            {replyTo && (
                              <div className="flex animate-in slide-in-from-bottom-2 duration-200">
                                <div className="flex-1 flex gap-3 p-2 bg-muted/50 rounded-lg border-l-4 border-primary shadow-sm">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-bold text-primary uppercase tracking-tight">
                                      Replying to{" "}
                                      {findMessageById(replyTo)?.author_name}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-300 truncate mt-0.5">
                                      {findMessageById(replyTo)?.content}
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => setReplyTo(null)}
                                    className="h-6 w-6 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
                                  >
                                    <span className="text-gray-400 text-sm">
                                      ✕
                                    </span>
                                  </button>
                                </div>
                              </div>
                            )}

                            <div className="flex items-center gap-2">
                              <input
                                ref={attachmentInputRef}
                                type="file"
                                className="hidden"
                                onChange={handleAttachFromComposer}
                              />
                              <div
                                ref={composerEmojiRef}
                                className="flex-1 relative"
                              >
                                <Textarea
                                  ref={messageInputRef}
                                  value={newPost}
                                  onChange={(e) =>
                                    handleComposerChange(
                                      e.target.value,
                                      e.target.selectionStart ??
                                      e.target.value.length,
                                    )
                                  }
                                  placeholder={
                                    !canSendMessages
                                      ? "This chat has been locked by an administrator"
                                      : replyTo
                                        ? "Type a reply..."
                                        : "Type a message..."
                                  }
                                  disabled={!canSendMessages}
                                  rows={1}
                                  className="w-full pl-4 pr-32 bg-muted border-none rounded-2xl min-h-[44px] max-h-[160px] focus-visible:ring-1 focus-visible:ring-primary shadow-inner resize-none overflow-y-auto py-2.5 leading-6"
                                  style={{ height: 'auto' }}
                                  onInput={(e) => {
                                    const el = e.currentTarget;
                                    el.style.height = 'auto';
                                    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                      e.preventDefault();
                                      handlePost();
                                    }
                                    // Shift+Enter: allow default (new line)
                                  }}
                                />
                                {showMentionSuggestions &&
                                  filteredMentionMembers.length > 0 && (
                                    <div className="absolute bottom-12 left-0 z-30 w-[60%] max-w-[92vw] rounded-xl border border-border bg-card shadow-lg max-h-56 overflow-y-auto">
                                      {filteredMentionMembers.map((member) => (
                                        <button
                                          key={member.user_id}
                                          type="button"
                                          onClick={() => insertMention(member)}
                                          className="w-full px-3 py-2 text-left hover:bg-muted/50 flex items-center gap-2"
                                        >
                                          <Checkbox
                                            checked={selectedMentions.some(
                                              (m) => m.id === member.user_id,
                                            )}
                                            className="pointer-events-none"
                                          />
                                          <Avatar className="h-7 w-7">
                                            <AvatarFallback className="text-[10px]">
                                              {(
                                                member.full_name ||
                                                member.email ||
                                                "?"
                                              )
                                                .slice(0, 2)
                                                .toUpperCase()}
                                            </AvatarFallback>
                                          </Avatar>
                                          <div className="min-w-0">
                                            <p className="text-sm font-medium truncate">
                                              {member.full_name || member.email}
                                            </p>
                                          </div>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-gray-400 hover:text-blue-500 hover:bg-transparent"
                                    disabled={!canSendMessages}
                                    onClick={() =>
                                      setShowInputEmojiPicker((prev) => !prev)
                                    }
                                  >
                                    <Smile className="h-5 w-5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-gray-400 hover:text-blue-500 hover:bg-transparent"
                                    disabled={isSendingFile}
                                    onClick={() =>
                                      attachmentInputRef.current?.click()
                                    }
                                  >
                                    {isSendingFile ? (
                                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                      <Paperclip className="h-5 w-5" />
                                    )}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-gray-400 hover:text-blue-500 hover:bg-transparent"
                                    disabled={!canSendMessages}
                                    onClick={() => setShowEventDialog(true)}
                                    title="Schedule Meeting"
                                  >
                                    <Calendar className="h-5 w-5" />
                                  </Button>
                                  <button
                                    onClick={handlePost}
                                    disabled={
                                      !canSendMessages ||
                                      !newPost.trim() ||
                                      createPost.isPending
                                    }
                                    className={`h-8 w-8 flex items-center justify-center rounded-full transition-all ${newPost.trim()
                                      ? "bg-blue-600 text-white shadow-md hover:scale-105 active:scale-95"
                                      : "bg-muted text-muted-foreground pointer-events-none"
                                      }`}
                                  >
                                    <Send className="h-4 w-4" />
                                  </button>
                                </div>
                                {showInputEmojiPicker && (
                                  <div className="absolute bottom-12 left-2 z-20 shadow-xl rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                                    <EmojiPicker
                                      onEmojiClick={handleComposerEmojiSelect}
                                      width={280}
                                      height={360}
                                      theme={Theme.AUTO}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                  {isForwardSelectMode && (
                    <div className="flex-shrink-0 border-t border-border p-3 bg-card">
                      <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
                        <p className="text-sm text-foreground">
                          {selectedForwardPostIds.length} message(s) selected
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={clearForwardSelection}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            disabled={selectedForwardPostIds.length === 0}
                            onClick={() => setShowForwardDialog(true)}
                          >
                            <Forward className="h-4 w-4 mr-2" />
                            Forward
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  {isDeleteSelectMode && (
                    <div className="flex-shrink-0 border-t border-border p-3 bg-card">
                      <div className="max-w-5xl mx-auto flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {/* Select All — hide in placeholder mode */}
                            {!isDeletedPlaceholderMode && (
                              <div className="flex items-center gap-1.5">
                                <Checkbox
                                  id="selectAllDelete"
                                  checked={
                                    selectedDeletePostIds.length ===
                                    posts.length && posts.length > 0
                                  }
                                  onCheckedChange={(val) =>
                                    handleSelectAllForDelete(Boolean(val))
                                  }
                                />
                                <label
                                  htmlFor="selectAllDelete"
                                  className="text-xs font-medium cursor-pointer"
                                >
                                  Select All
                                </label>
                              </div>
                            )}
                            <span className="text-xs text-muted-foreground border-l pl-3">
                              {selectedDeletePostIds.length} message(s) selected
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={clearDeleteSelection}
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={selectedDeletePostIds.length === 0}
                              onClick={() => setShowDeleteDialog(true)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </Button>
                          </div>
                        </div>

                        {/* Filters Row — hide in placeholder mode */}
                        {!isDeletedPlaceholderMode && (
                          <div className="flex items-center gap-4 py-1.5 px-1 bg-muted/30 rounded-md border border-border/50">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground ml-2">
                              Include:
                            </span>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1.5">
                                <Checkbox
                                  id="filterText"
                                  checked={deleteFilters.text}
                                  onCheckedChange={(v) =>
                                    setDeleteFilters((f) => ({ ...f, text: !!v }))
                                  }
                                />
                                <label
                                  htmlFor="filterText"
                                  className="text-[11px] cursor-pointer"
                                >
                                  Text
                                </label>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Checkbox
                                  id="filterImage"
                                  checked={deleteFilters.image}
                                  onCheckedChange={(v) =>
                                    setDeleteFilters((f) => ({
                                      ...f,
                                      image: !!v,
                                    }))
                                  }
                                />
                                <label
                                  htmlFor="filterImage"
                                  className="text-[11px] cursor-pointer"
                                >
                                  Images
                                </label>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Checkbox
                                  id="filterVideo"
                                  checked={deleteFilters.video}
                                  onCheckedChange={(v) =>
                                    setDeleteFilters((f) => ({
                                      ...f,
                                      video: !!v,
                                    }))
                                  }
                                />
                                <label
                                  htmlFor="filterVideo"
                                  className="text-[11px] cursor-pointer"
                                >
                                  Videos
                                </label>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Checkbox
                                  id="filterDoc"
                                  checked={deleteFilters.document}
                                  onCheckedChange={(v) =>
                                    setDeleteFilters((f) => ({
                                      ...f,
                                      document: !!v,
                                    }))
                                  }
                                />
                                <label
                                  htmlFor="filterDoc"
                                  className="text-[11px] cursor-pointer"
                                >
                                  Documents
                                </label>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Checkbox
                                  id="filterCall"
                                  checked={deleteFilters.call}
                                  onCheckedChange={(v) =>
                                    setDeleteFilters((f) => ({ ...f, call: !!v }))
                                  }
                                />
                                <label
                                  htmlFor="filterCall"
                                  className="text-[11px] cursor-pointer"
                                >
                                  Calls
                                </label>
                              </div>
                            </div>
                            <p className="text-[10px] text-muted-foreground italic ml-auto mr-2">
                              * Uncheck to keep these items
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === "files" && (
            <div className="h-full flex flex-col">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <Button
                  onClick={handleUploadFile}
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
                >
                  <Paperclip className="h-4 w-4" />
                  Upload Files
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {files.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <Files className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        No files yet
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 mb-6">
                        Share files with your team to get started
                      </p>
                      <Button
                        onClick={handleUploadFile}
                        className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
                      >
                        <Paperclip className="h-4 w-4" />
                        Upload Files
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {files.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border hover:shadow-sm transition-shadow"
                      >
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                          <Files className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white truncate">
                            {file.original_name}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {(file.file_size / 1024 / 1024).toFixed(2)} MB •
                            Uploaded by {file.uploaded_by_name} •{" "}
                            {new Date(file.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                // Download file
                                const link = document.createElement("a");
                                link.href = getAuthedFileUrl(file.id);
                                link.download = file.original_name;
                                link.click();
                              }}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                navigator.clipboard.writeText(
                                  file.original_name,
                                );
                                toast.success("File name copied to clipboard");
                              }}
                            >
                              <Copy className="h-4 w-4 mr-2" />
                              Copy Name
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={async () => {
                                try {
                                  await workgroupsApi.deleteFile(
                                    workgroupId,
                                    file.id,
                                  );
                                  refetchFiles();
                                  toast.success("File deleted successfully");
                                } catch (error) {
                                  toast.error("Failed to delete file");
                                }
                              }}
                              className="text-red-600 dark:text-red-400"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "wiki" && (
            <div className="h-full flex flex-col">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <Button
                  onClick={handleCreateWikiPage}
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
                >
                  <MessageSquare className="h-4 w-4" />
                  Create Page
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {wikiPages.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <MessageSquare className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        Team Wiki
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 mb-6">
                        Create and share knowledge with your team
                      </p>
                      <Button
                        onClick={handleCreateWikiPage}
                        className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
                      >
                        <MessageSquare className="h-4 w-4" />
                        Create Page
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {wikiPages.map((page) => (
                      <div
                        key={page.id}
                        className="p-4 bg-card rounded-lg border border-border hover:shadow-sm transition-shadow cursor-pointer"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                              {page.title}
                            </h3>
                            <p className="text-gray-600 dark:text-gray-400 text-sm mb-3 line-clamp-2">
                              {page.content}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                              <span>Created by {page.created_by_name}</span>
                              <span>
                                Last modified{" "}
                                {new Date(page.updated_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={async () => {
                                  // Edit wiki page
                                  const newContent = await prompt(
                                    "Edit page content:",
                                    page.content || "",
                                    {
                                      title: "Edit Wiki Page",
                                    },
                                  );
                                  if (newContent !== null) {
                                    workgroupsApi
                                      .updateWikiPage(workgroupId, page.id, {
                                        content: newContent,
                                      })
                                      .then(() => {
                                        refetchWiki();
                                        toast.success(
                                          "Wiki page updated successfully",
                                        );
                                      })
                                      .catch(() => {
                                        toast.error(
                                          "Failed to update wiki page",
                                        );
                                      });
                                  }
                                }}
                              >
                                <MessageSquare className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  navigator.clipboard.writeText(
                                    page.content || "",
                                  );
                                  toast.success(
                                    "Page content copied to clipboard",
                                  );
                                }}
                              >
                                <Copy className="h-4 w-4 mr-2" />
                                Copy Content
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={async () => {
                                  if (
                                    !(await confirm(
                                      "Are you sure you want to delete this wiki page?",
                                      {
                                        variant: "destructive",
                                        title: "Delete Wiki Page",
                                      },
                                    ))
                                  )
                                    return;

                                  try {
                                    await workgroupsApi.deleteWikiPage(
                                      workgroupId,
                                      page.id,
                                    );
                                    refetchWiki();
                                    toast.success(
                                      "Wiki page deleted successfully",
                                    );
                                  } catch (error) {
                                    toast.error("Failed to delete wiki page");
                                  }
                                }}
                                className="text-red-600 dark:text-red-400"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <Dialog open={showForwardDialog} onOpenChange={setShowForwardDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Forward message to chats</DialogTitle>
            <DialogDescription>
              Select one or more chats to forward selected messages.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Input
              value={forwardSearch}
              onChange={(e) => setForwardSearch(e.target.value)}
              placeholder="Search chats..."
            />
            <div className="max-h-72 overflow-y-auto border rounded-md p-2 space-y-2">
              {forwardTargetWorkgroups.length === 0 ? (
                <p className="text-sm text-gray-500 p-2">No chats found.</p>
              ) : (
                forwardTargetWorkgroups.map((target: any) => {
                  const checked = selectedForwardWorkgroupIds.includes(
                    target.id,
                  );
                  return (
                    <label
                      key={target.id}
                      className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) =>
                          toggleForwardTarget(target.id, Boolean(value))
                        }
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {target.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {target.member_count || 0} members
                        </p>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowForwardDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleForwardSelectedMessages}
              disabled={
                isForwardingMessages || selectedForwardWorkgroupIds.length === 0
              }
            >
              {isForwardingMessages ? "Forwarding..." : "Forward"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete selected messages</DialogTitle>
            <DialogDescription>
              Choose how you want to delete the selected messages.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleDeleteSelectedMessages("me")}
              disabled={isDeletingMessages}
            >
              Delete for me
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleDeleteSelectedMessages("everyone")}
              disabled={isDeletingMessages}
              className={!canDeleteEveryoneForSelection ? "hidden" : ""}
            >
              Delete for everyone
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Add Member Dialog */}
      {/* About Workgroup Dialog */}
      <Dialog open={showAboutModal} onOpenChange={setShowAboutModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              About {workgroupDisplayName}
            </DialogTitle>
            <DialogDescription>
              Group information and description
            </DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Description</h4>
            <div className="p-4 bg-muted/30 rounded-lg border border-border">
              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap leading-relaxed">
                {workgroup.description || "No description available for this group."}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowAboutModal(false)} className="bg-blue-600 hover:bg-blue-700 text-white">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddMember} onOpenChange={setShowAddMember}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-blue-600" />
              Add Team Member
            </DialogTitle>
            <DialogDescription>
              Add a colleague from your organization to this team.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {orgUsersLoading || membersLoading ? (
              <div className="text-center py-6">
                <div className="h-8 w-8 mx-auto mb-3 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Loading users...
                </p>
              </div>
            ) : availableUsers.length === 0 ? (
              <div className="text-center py-6">
                <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                  No available users
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  All users in your organization are already members of this
                  team.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white dark:text-white">
                    Select User ({availableUsers.length} available)
                  </label>

                  {/* Inline search + avatar list — same style as other dropdowns */}
                  <div className="rounded-md border border-input bg-background overflow-hidden">
                    {/* Search input */}
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground shrink-0"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                      <input
                        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                        placeholder="Search by name or email..."
                        value={addMemberSearch}
                        onChange={e => setAddMemberSearch(e.target.value)}
                      />
                      {addMemberSearch && (
                        <button type="button" onClick={() => setAddMemberSearch("")} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
                      )}
                    </div>

                    {/* Scrollable user list */}
                    <div className="max-h-48 overflow-y-auto">
                      {availableUsers
                        .filter(u => {
                          const q = addMemberSearch.toLowerCase();
                          return !q || u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
                        })
                        .map((u) => {
                          const initials = (u.full_name || u.email || "?").split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
                          const isSelected = selectedUserId === u.id;
                          return (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => setSelectedUserId(isSelected ? "" : u.id)}
                              className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/50 transition-colors ${isSelected ? "bg-primary/10" : ""}`}
                            >
                              <Avatar className="h-8 w-8 shrink-0">
                                <AvatarImage src={getAvatarUrl((u as any).avatar_url)} />
                                <AvatarFallback className="bg-blue-100 text-blue-700 text-xs font-bold">
                                  {initials}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium truncate ${isSelected ? "text-primary" : "text-foreground"}`}>
                                  {u.full_name || "Unknown"}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                              </div>
                              {isSelected && <span className="text-primary text-xs shrink-0">✓</span>}
                            </button>
                          );
                        })}
                      {availableUsers.filter(u => {
                        const q = addMemberSearch.toLowerCase();
                        return !q || u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
                      }).length === 0 && (
                          <p className="px-3 py-3 text-sm text-muted-foreground text-center">No users found.</p>
                        )}
                    </div>
                  </div>
                </div>

                {selectedUserId && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={getAvatarUrl((availableUsers.find((u) => u.id === selectedUserId) as any)?.avatar_url)} />
                        <AvatarFallback className="bg-blue-100 text-blue-700">
                          {(
                            availableUsers.find((u) => u.id === selectedUserId)
                              ?.full_name || "?"
                          )
                            .slice(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {availableUsers.find((u) => u.id === selectedUserId)
                            ?.full_name || "Unknown"}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {availableUsers.find((u) => u.id === selectedUserId)?.email}
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-400">
                          Will be added as Member
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddMember(false);
                setSelectedUserId("");
              }}
            >
              Cancel
            </Button>
            {availableUsers.length > 0 && (
              <Button
                onClick={handleAddMember}
                disabled={!selectedUserId || addMember.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
              >
                {addMember.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Add to Team
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Wiki Page Dialog */}
      <Dialog open={showCreateWikiPage} onOpenChange={setShowCreateWikiPage}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-600" />
              Create Wiki Page
            </DialogTitle>
            <DialogDescription>
              Create a new wiki page to share knowledge with your team.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900 dark:text-white">
                Page Title *
              </label>
              <Input
                value={newWikiPageTitle}
                onChange={(e) => setNewWikiPageTitle(e.target.value)}
                placeholder="Enter wiki page title..."
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900 dark:text-white">
                Initial Content (Optional)
              </label>
              <Textarea
                value={newWikiPageContent}
                onChange={(e) => setNewWikiPageContent(e.target.value)}
                placeholder="Enter initial content for the wiki page..."
                className="w-full min-h-[120px] resize-none"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                You can edit and add more content after creating the page.
              </p>
            </div>

            {newWikiPageTitle && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                    <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {newWikiPageTitle}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {newWikiPageContent ||
                        "This is a new wiki page. Click to edit..."}
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                      Created by {user?.full_name || user?.email || "You"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateWikiPage(false);
                setNewWikiPageTitle("");
                setNewWikiPageContent("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateWikiPageSubmit}
              disabled={!newWikiPageTitle.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
            >
              <MessageSquare className="h-4 w-4" />
              Create Page
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Members List Dialog */}
      <Dialog open={showMembersList} onOpenChange={setShowMembersList}>
        <DialogContent className="sm:max-w-[500px] max-h-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Members ({members.length})
            </DialogTitle>
            <DialogDescription>
              Manage your team members and their roles.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-96 overflow-y-auto py-4">
            {membersLoading ? (
              <div className="text-center py-8">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-gray-500">Loading members...</p>
              </div>
            ) : (
              sortedMembers.map((member) => (
                <div
                  key={member.id}
                  className="group flex items-start gap-3 p-3 rounded-xl border border-border bg-card/70 hover:border-primary/30 hover:bg-primary/5 transition-colors"
                >
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={getAvatarUrl(member.avatar_url)} />
                    <AvatarFallback className="bg-muted text-muted-foreground">
                      {(member.full_name || "?").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {member.full_name || member.email || "Unknown User"}
                      </p>
                      {assignedMemberManagerId &&
                        String(member.user_id || (member as any).id) ===
                        String(assignedMemberManagerId) && (
                          <Badge className="bg-indigo-600 text-white font-bold px-2 py-0.5 ml-1 text-[10px]">
                            Moderator
                          </Badge>
                        )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {member.email}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Joined{" "}
                      {member.joined_at
                        ? formatDistanceToNow(new Date(member.joined_at), {
                          addSuffix: true,
                        })
                        : "recently"}
                    </p>
                    <p
                      className={`text-xs font-medium ${member.is_online
                        ? "text-primary"
                        : "text-red-500 dark:text-red-400"
                        }`}
                    >
                      {member.is_online ? "Online" : "Offline"}
                    </p>
                    {!member.is_online && (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        {member.last_seen_at ? (
                          <>
                            Last seen{" "}
                            {formatDistanceToNow(
                              new Date(member.last_seen_at),
                              {
                                addSuffix: true,
                              },
                            )}
                          </>
                        ) : (
                          <>Last seen recently</>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant={
                        member.role === "owner" ? "default" : "secondary"
                      }
                      className="gap-1"
                    >
                      {member.role === "owner" && <Crown className="h-3 w-3" />}
                      {member.role}
                    </Badge>
                    {((member.user_id === user?.id &&
                      member.role !== "owner") ||
                      member.user_id !== user?.id) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-600 dark:text-gray-300 transition-colors group-hover:bg-primary group-hover:text-white hover:bg-primary hover:text-white"
                          onClick={async () => {
                            if (member.user_id === user?.id) {
                              handleLeaveTeam(member.id);
                            } else {
                              try {
                                console.log(
                                  "Opening direct chat with user:",
                                  member.user_id,
                                );
                                const direct = await workgroupsApi.openDirectChat(
                                  member.user_id,
                                );
                                console.log("Direct chat response:", direct);
                                if (direct?.id) {
                                  setShowMembersList(false);
                                  navigate(
                                    `/collaboration/workgroups?team=${direct.id}`,
                                  );
                                } else {
                                  toast.error(
                                    "No direct chat ID returned from server",
                                  );
                                }
                              } catch (error: any) {
                                console.error("Direct chat error:", error);
                                const serverMessage =
                                  error?.response?.data?.error;
                                const fallbackMessage = error?.message;
                                toast.error(
                                  serverMessage ||
                                  fallbackMessage ||
                                  "Failed to open direct chat",
                                );
                              }
                            }
                          }}
                        >
                          {member.user_id === user?.id ? (
                            <UserMinus className="h-4 w-4" />
                          ) : (
                            <MessageCircle className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            {canAddMembers && (
              <Button
                onClick={() => {
                  setShowMembersList(false);
                  setShowAddMember(true);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
              >
                <UserPlus className="h-4 w-4" />
                Add Member
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowMembersList(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notifications Dialog */}
      <Dialog open={showNotifications} onOpenChange={setShowNotifications}>
        <DialogContent className="sm:max-w-[500px] max-h-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Team Notifications
            </DialogTitle>
            <DialogDescription>
              Stay updated with team activities and mentions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-96 overflow-y-auto py-4">
            {notifications.filter((n: any) => !n.is_read).length === 0 ? (
              <div className="text-center py-8">
                <Bell className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500">No new notifications</p>
              </div>
            ) : (
              notifications.filter((n: any) => !n.is_read).map((notification: any) => (
                <div
                  key={notification.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${notification.is_read
                    ? "border-border bg-card"
                    : "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20"
                    }`}
                  onClick={() => markNotificationAsRead(notification.id)}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-2 h-2 rounded-full mt-2 ${notification.is_read ? "bg-gray-300" : "bg-blue-500"}`}
                    ></div>
                    <div className="flex-1">
                      <p
                        className={`text-sm ${notification.is_read ? "text-gray-600 dark:text-gray-400" : "text-gray-900 dark:text-white font-medium"}`}
                      >
                        {(() => {
                          const msg = notification.message || '';
                          try {
                            const parsed = JSON.parse(msg);
                            if (parsed && parsed.type && parsed.status) {
                              const isVideo = parsed.type === 'video';
                              const isMissed = parsed.status === 'missed' || parsed.status === 'rejected';
                              if (isMissed) return isVideo ? '📵 Missed video call' : '📵 Missed voice call';
                              if (parsed.status === 'completed') {
                                const dur = parsed.duration || 0;
                                const m = Math.floor(dur / 60);
                                const s = dur % 60;
                                const durStr = dur > 0 ? ` (${m}:${s.toString().padStart(2, '0')})` : '';
                                return isVideo ? `📹 Video call${durStr}` : `📞 Voice call${durStr}`;
                              }
                            }
                          } catch (_) { }
                          return msg;
                        })()}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {new Date(notification.created_at).toLocaleString()}
                      </p>
                    </div>
                    <Badge
                      variant={
                        notification.notification_type === "member_added"
                          ? "default"
                          : notification.notification_type === "message"
                            ? "secondary"
                            : "outline"
                      }
                      className="text-xs"
                    >
                      {notification.notification_type.replace("_", " ")}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={markAllNotificationsAsRead}>
              Mark All Read
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowNotifications(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Starred Messages Dialog */}
      <Dialog open={showStarredMessages} onOpenChange={setShowStarredMessages}>
        <DialogContent className="sm:max-w-[500px] max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500 fill-current" />
              Starred Messages
            </DialogTitle>
            <DialogDescription>
              Your saved and important messages.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-3 py-4">
            {starredMessagesList.length === 0 ? (
              <div className="text-center py-12">
                <Star className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500">No starred messages</p>
              </div>
            ) : (
              starredMessagesList.map((msg) => (
                <div
                  key={`starred-${msg.id}`}
                  className="p-3 rounded-lg border border-border bg-card/50 hover:bg-card transition-colors group"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={getAvatarUrl(msg.author_avatar)} />
                        <AvatarFallback className="text-[8px]">
                          {(msg.author_name || "?").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-xs font-bold text-gray-900 dark:text-white">
                          {msg.author_name}
                        </p>
                        <p className="text-[10px] text-gray-500">
                          {new Date(msg.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-yellow-500 hover:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleToggleStarMessage(msg.id)}
                    >
                      <Star className="h-4 w-4 fill-current" />
                    </Button>
                  </div>
                  <div className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3">
                    {(() => {
                      const content = msg.content || '';
                      try {
                        const parsed = JSON.parse(content);
                        if (parsed && parsed.type && parsed.status) {
                          const isVideo = parsed.type === 'video';
                          const isMissed = parsed.status === 'missed' || parsed.status === 'rejected';
                          if (isMissed) return isVideo ? '📵 Missed video call' : '📵 Missed voice call';
                          if (parsed.status === 'completed') {
                            const dur = parsed.duration || 0;
                            const m = Math.floor(dur / 60);
                            const s = dur % 60;
                            const durStr = dur > 0 ? ` (${m}:${s.toString().padStart(2, '0')})` : '';
                            return isVideo ? `📹 Video call${durStr}` : `📞 Voice call${durStr}`;
                          }
                        }
                      } catch (_) { }
                      return content;
                    })()}
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-[11px] text-primary"
                      onClick={() => {
                        setShowStarredMessages(false);
                        scrollToMessage(msg.id);
                      }}
                    >
                      Jump to message
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowStarredMessages(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CreateEventDialog 
        open={showEventDialog} 
        onOpenChange={setShowEventDialog} 
        onSuccess={onEventCreated}
      />
    </div >
  );
}
// ─── Quick Emojis ────────────────────────────────────────────────────────────────────
const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "🙏"];

// Distinct bubble colors for group chat members (light bg + dark text + dark mode variant)
const MEMBER_BUBBLE_COLORS = [
  {
    bg: "bg-emerald-100 dark:bg-emerald-900/40",
    text: "text-emerald-900 dark:text-emerald-100",
    name: "text-emerald-600 dark:text-emerald-400",
  },
  {
    bg: "bg-violet-100 dark:bg-violet-900/40",
    text: "text-violet-900 dark:text-violet-100",
    name: "text-violet-600 dark:text-violet-400",
  },
  {
    bg: "bg-amber-100 dark:bg-amber-900/40",
    text: "text-amber-900 dark:text-amber-100",
    name: "text-amber-600 dark:text-amber-400",
  },
  {
    bg: "bg-sky-100 dark:bg-sky-900/40",
    text: "text-sky-900 dark:text-sky-100",
    name: "text-sky-600 dark:text-sky-400",
  },
  {
    bg: "bg-rose-100 dark:bg-rose-900/40",
    text: "text-rose-900 dark:text-rose-100",
    name: "text-rose-600 dark:text-rose-400",
  },
  {
    bg: "bg-teal-100 dark:bg-teal-900/40",
    text: "text-teal-900 dark:text-teal-100",
    name: "text-teal-600 dark:text-teal-400",
  },
  {
    bg: "bg-orange-100 dark:bg-orange-900/40",
    text: "text-orange-900 dark:text-orange-100",
    name: "text-orange-600 dark:text-orange-400",
  },
  {
    bg: "bg-pink-100 dark:bg-pink-900/40",
    text: "text-pink-900 dark:text-pink-100",
    name: "text-pink-600 dark:text-pink-400",
  },
];

function getMemberColor(userId: string) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++)
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return MEMBER_BUBBLE_COLORS[Math.abs(hash) % MEMBER_BUBBLE_COLORS.length];
}

interface PostCardProps {
  post: WorkgroupPost;
  allPosts: WorkgroupPost[];
  workgroupId: string;
  isGroupAdmin: boolean;
  isMember: boolean;
  currentUserId?: string;
  postAuthorRole?: "owner" | "admin" | "member" | "guest";
  onSetReplyTo: (id: string | null) => void;
  onDelete: (postId: string) => void;
  onDeleteForMe?: (postId: string) => void;
  onTogglePin: (postId: string, isPinned: boolean) => void;
  onReaction?: (postId: string, emoji: string) => void;
  onScrollToMessage?: (id: string) => void;
  onRemoveMemberFromChat?: (memberUserId: string) => void;
  memberDirectory?: Array<{
    user_id: string;
    full_name?: string;
    email?: string;
  }>;
  isForwardSelectMode?: boolean;
  isSelectedForForward?: boolean;
  onToggleForwardSelection?: (postId: string, checked: boolean) => void;
  onStartForwardSelection?: (postId: string) => void;
  isDeleteSelectMode?: boolean;
  isSelectedForDelete?: boolean;
  onToggleDeleteSelection?: (postId: string, checked: boolean) => void;
  onStartDeleteSelection?: (postId: string) => void;
  isStarred?: boolean;
  onToggleStar?: (postId: string) => void;
  searchQuery?: string;
  canSendMessages?: boolean;
  isBroadcast?: boolean;
}

function PostCard({
  post,
  allPosts,
  workgroupId,
  isGroupAdmin,
  isMember,
  currentUserId,
  postAuthorRole,
  onSetReplyTo,
  onDelete,
  onDeleteForMe,
  onTogglePin,
  onReaction,
  onScrollToMessage,
  onRemoveMemberFromChat,
  memberDirectory = [],
  isForwardSelectMode = false,
  isSelectedForForward = false,
  onToggleForwardSelection,
  onStartForwardSelection,
  isDeleteSelectMode = false,
  isSelectedForDelete = false,
  onToggleDeleteSelection,
  onStartDeleteSelection,
  isStarred = false,
  onToggleStar,
  searchQuery = "",
  canSendMessages = true,
  isBroadcast = false,
}: PostCardProps) {
  const navigate = useNavigate();
  if ((post.content || "").startsWith("[SYSTEM] ")) {
    return (
      <div className="flex justify-center my-3">
        <span className="px-3 py-1 rounded-full bg-muted text-[11px] font-medium text-muted-foreground border border-border">
          {post.content.replace("[SYSTEM] ", "")}
        </span>
      </div>
    );
  }

  const isAuthor = post.user_id === currentUserId;

  let isCallLog = post.content_type === "call";
  let callData: any = {};
  
  // Auto-detect call log JSON if it wasn't marked correctly (historical data or mobile)
  if (!isCallLog && (post.content || "").trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(post.content);
      if (parsed && (parsed.type === 'video' || parsed.type === 'voice' || parsed.type === 'call') && parsed.status) {
        isCallLog = true;
        callData = parsed;
      }
    } catch (e) {
      // Not a call log JSON
    }
  } else if (isCallLog) {
    try {
      callData = JSON.parse(post.content);
    } catch (e) {
      callData = {
        type: "voice",
        status: "missed",
        duration: 0,
        callerId: post.user_id,
      };
    }
  }

  const isEventMessage = (post.content || "").startsWith("📅 **Meeting Scheduled**");
  let eventData: any = null;
  if (isEventMessage) {
    try {
      const content = post.content || "";
      const titleMatch = content.match(/\*\*Title:\*\* (.*)/);
      const timeMatch = content.match(/\*\*Time:\*\* (.*)/);
      const locationMatch = content.match(/\*\*Location:\*\* (.*)/);
      
      eventData = {
        title: titleMatch ? titleMatch[1] : "Meeting",
        time: timeMatch ? timeMatch[1] : "",
        location: locationMatch ? locationMatch[1] : "Online",
      };
    } catch (e) {
      console.error("Failed to parse event message:", e);
    }
  }

  const isMissedCall =
    isCallLog &&
    (callData.status === "missed" || callData.status === "rejected") &&
    callData.duration === 0;
  const isVideoCall = isCallLog && callData.type === "video";
  const isOutgoingCall = isCallLog && callData.callerId === currentUserId;

  const formatCallDuration = (s: number) => {
    if (s === 0) return isOutgoingCall ? "No answer" : "Tap to call back";
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    if (mins > 0) return `${mins} min ${secs} sec`;
    return `${secs} sec`;
  };

  const CallIcon = isVideoCall ? Video : Phone;
  const CallStatusIcon = isMissedCall
    ? PhoneMissed
    : isOutgoingCall
      ? ArrowUpRight
      : ArrowDownLeft;
  const callStatusColor = isMissedCall
    ? "text-red-500"
    : isOutgoingCall
      ? "text-gray-500"
      : "text-emerald-500";

  const memberColor = isAuthor ? null : getMemberColor(post.user_id);
  const deletedForUsers = Array.isArray((post as any).deleted_for_users)
    ? ((post as any).deleted_for_users as string[])
    : [];
  const isDeletedForMe = Boolean(
    currentUserId && deletedForUsers.includes(currentUserId),
  );
  const isDeletedMessage = Boolean(post.is_deleted || isDeletedForMe);
  const deletedPlaceholder =
    isAuthor
      ? "You deleted this message"
      : "This message was deleted";
  const [visibleLinesCount, setVisibleLinesCount] = useState(10);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showReactionsDialog, setShowReactionsDialog] = useState(false);
  const [showSeenByDialog, setShowSeenByDialog] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const reactions: Record<string, string[]> = post.reactions || {};
  const reactionEntries = Object.entries(reactions);
  const totalReactionCount = reactionEntries.reduce(
    (sum, [, users]) => sum + users.length,
    0,
  );

  const sortedReactionEntries = useMemo(() => {
    return [...reactionEntries].sort((a, b) => {
      const aHasMe = a[1].includes(currentUserId || "");
      const bHasMe = b[1].includes(currentUserId || "");
      if (aHasMe && !bHasMe) return -1;
      if (!aHasMe && bHasMe) return 1;
      return 0;
    });
  }, [reactionEntries, currentUserId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    };
    if (showEmojiPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showEmojiPicker]);

  // Function to highlight search terms
  const highlightSearchTerm = (text: string, searchTerm: string) => {
    if (!searchTerm.trim()) return text;

    const regex = new RegExp(
      `(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
      "gi",
    );
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark
          key={index}
          className="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded"
        >
          {part}
        </mark>
      ) : (
        part
      ),
    );
  };

  const handleEmojiClick = (emoji: string) => {
    onReaction?.(post.id, emoji);
    setShowEmojiPicker(false);
  };

  const resolveUserName = (userId: string) => {
    if (userId === currentUserId) return "You";
    const member = memberDirectory.find((m) => m.user_id === userId);
    return member?.full_name?.trim() || member?.email || "Unknown user";
  };
  const mentionEntries = useMemo(() => {
    const baseMentions = (memberDirectory || [])
      .map((member) => ({
        userId: member.user_id,
        label: (member.full_name || member.email || "").trim(),
      }))
      .filter((entry) => entry.label.length > 0);

    // Add virtual entry for "@Everyone" highlighting
    baseMentions.push({ userId: "all", label: "Everyone" });

    return baseMentions.sort((a, b) => b.label.length - a.label.length);
  }, [memberDirectory]);
  const mentionLookup = useMemo(() => {
    const map = new Map<string, string>();
    mentionEntries.forEach((entry) => {
      map.set(`@${entry.label}`.toLowerCase(), entry.userId);
    });
    return map;
  }, [mentionEntries]);
  const escapeRegex = (value: string) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const renderMessageWithMentions = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/gi;

    // First, split by URL
    const urlParts = text.split(urlRegex);

    return urlParts.map((urlPart, urlIdx) => {
      if (urlPart.match(urlRegex)) {
        return (
          <a
            key={`link-${urlIdx}`}
            href={urlPart}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 underline hover:no-underline break-all"
            onClick={(e) => e.stopPropagation()}
          >
            {urlPart}
          </a>
        );
      }

      // For non-URL parts, apply mentions and search highlighting
      // (This is the existing logic moved inside)
      const mentionPattern = mentionEntries.length
        ? mentionEntries
          .map((entry) => escapeRegex(`@${entry.label}`))
          .join("|")
        : "";

      if (!mentionPattern || !urlPart.includes("@")) {
        // Just search highlighting
        if (searchQuery.trim()) {
          const searchRegex = new RegExp(`(${escapeRegex(searchQuery)})`, "gi");
          const searchParts = urlPart.split(searchRegex);
          return searchParts.map((p, i) =>
            searchRegex.test(p) ? (
              <mark
                key={i}
                className="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded"
              >
                {p}
              </mark>
            ) : (
              p
            ),
          );
        }
        return urlPart;
      }

      const mentionRegex = new RegExp(`(${mentionPattern})`, "gi");
      const mentionParts = urlPart.split(mentionRegex);

      return mentionParts.map((mPart, mIdx) => {
        const targetUserId = mentionLookup.get(mPart.toLowerCase());
        if (!targetUserId) {
          // Search highlight in non-mention text
          if (searchQuery.trim()) {
            const sRegex = new RegExp(`(${escapeRegex(searchQuery)})`, "gi");
            const sParts = mPart.split(sRegex);
            return sParts.map((sp, si) =>
              sRegex.test(sp) ? (
                <mark
                  key={si}
                  className="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded"
                >
                  {sp}
                </mark>
              ) : (
                sp
              ),
            );
          }
          return mPart;
        }

        return (
          <button
            key={`mention-${urlIdx}-${mIdx}`}
            type="button"
            onClick={async (e) => {
              e.stopPropagation();
              if (targetUserId === "all") return;
              try {
                const direct = await workgroupsApi.openDirectChat(targetUserId);
                if (direct?.id) {
                  navigate(`/collaboration/workgroups?team=${direct.id}`);
                }
              } catch (error: any) {
                toast.error(
                  error?.response?.data?.error || "Failed to open direct chat",
                );
              }
            }}
            className={`font-semibold hover:underline ${isAuthor
              ? "text-emerald-700 dark:text-emerald-300"
              : "text-primary"
              }`}
          >
            {mPart}
          </button>
        );
      });
    });
  };

  const timeString = post.created_at
    ? new Date(post.created_at).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })
    : "";

  const attachments = Array.isArray(post.attachments) ? post.attachments : [];
  const isImageAttachment = (fileType = "") => fileType.startsWith("image/");
  const formatFileSize = (size = 0) => `${(size / 1024 / 1024).toFixed(2)} MB`;
  const getAuthedFileUrlForPost = (
    fileId: string,
    mode: "view" | "download" = "download",
  ) => {
    const token = api.getToken();
    const baseUrl = `${API_BASE_URL}/workgroups/${workgroupId}/files/${fileId}/${mode}`;
    return token ? `${baseUrl}?token=${encodeURIComponent(token)}` : baseUrl;
  };

  return (
    <div
      className="group relative px-2 mb-2 transition-all"
      id={`msg-${post.id}`}
    >
      {/* Pinned indicator */}
      {post.is_pinned && (
        <div className="flex items-center justify-center mb-1">
          <span className="text-[10px] bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 px-2 py-0.5 rounded-full border border-yellow-200 dark:border-yellow-800 inline-flex items-center gap-1">
            <Pin className="h-2.5 w-2.5" /> Pinned Message
          </span>
        </div>
      )}

      {/* Bubble row */}
      <div
        className={`flex ${isAuthor ? "justify-end" : "justify-start"} items-end gap-2 mb-0.5`}
      >
        {/* Checkbox — always on left side for both sender and receiver */}
        {(isForwardSelectMode || isDeleteSelectMode) && (
          <Checkbox
            checked={isForwardSelectMode ? isSelectedForForward : isSelectedForDelete}
            onCheckedChange={(value) => {
              if (isForwardSelectMode) onToggleForwardSelection?.(post.id, Boolean(value));
              else onToggleDeleteSelection?.(post.id, Boolean(value));
            }}
            className="shrink-0"
          />
        )}
        {/* Avatar — only for received */}
        {!isAuthor && (
          <Avatar className="h-7 w-7 flex-shrink-0 mb-0.5">
            <AvatarImage src={getAvatarUrl(post.author_avatar)} />
            <AvatarFallback className="bg-emerald-100 text-emerald-700 text-[10px] font-bold">
              {(post.author_name || "?").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        )}

        {/* The bubble container */}
        <div
          className={`relative flex items-center gap-2 max-w-[90%] ${isAuthor ? "flex-row" : "flex-row-reverse"} justify-end w-full`}
        >
          {/* Action buttons - placed according to user request */}
          {!isDeletedMessage && (
            <div
              className={`flex items-center opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 order-${isAuthor ? "2" : "0"} ${isAuthor ? "ml-1" : "mr-1"}`}
            >
              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5"
                title="React with emoji"
              >
                <Smile className="h-4.5 w-4.5" />
              </button>
            </div>
          )}

          {/* The Actual Bubble */}
          <div
            className={`relative min-w-[120px] order-1 ${isAuthor
              ? "bg-primary/10 text-foreground dark:bg-primary/20 rounded-2xl rounded-tr-sm"
              : `${memberColor!.bg} ${memberColor!.text} rounded-2xl rounded-tl-sm`
              } px-3 py-2 shadow-sm group/bubble border border-black/5`}
          >
            {/* Dropdown Chevron - Inside Bubble top-right */}
            <div
              className={`absolute top-1 right-1 z-[20] opacity-0 group-hover/bubble:opacity-100 transition-opacity`}
            >
              {isDeletedMessage ? (
                /* Deleted message: show delete options via selection mode */
                !isDeletedForMe && isMember && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="transition-colors p-0.5 rounded text-gray-400 hover:text-gray-600 dark:text-white/70 dark:hover:text-white"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align={isAuthor ? "end" : "start"}
                      className="w-48"
                    >
                      <DropdownMenuItem
                        onClick={() => onStartDeleteSelection?.(post.id)}
                        className="text-red-600 dark:text-red-400 focus:text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={`transition-colors p-0.5 rounded ${isAuthor
                        ? "text-gray-400 hover:text-gray-600 dark:text-white/70 dark:hover:text-white"
                        : "text-gray-400 hover:text-gray-600 dark:text-white/70 dark:hover:text-white"
                        }`}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align={isAuthor ? "end" : "start"}
                    className="w-48"
                  >
                    {isMember && canSendMessages && (
                      <DropdownMenuItem onClick={() => onSetReplyTo(post.id)}>
                        <Reply className="h-4 w-4 mr-2" /> Reply
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => onToggleStar?.(post.id)}>
                      <Star
                        className={`h-4 w-4 mr-2 ${isStarred ? "fill-current text-yellow-500" : ""}`}
                      />
                      {isStarred ? "Unstar" : "Star"} Message
                    </DropdownMenuItem>
                    {isGroupAdmin && (
                      <DropdownMenuItem
                        onClick={() => onTogglePin(post.id, post.is_pinned)}
                      >
                        <Pin className="h-4 w-4 mr-2" />{" "}
                        {post.is_pinned ? "Unpin" : "Pin"}
                      </DropdownMenuItem>
                    )}
                    {isGroupAdmin &&
                      onRemoveMemberFromChat &&
                      !isAuthor &&
                      postAuthorRole !== "owner" && (
                        <DropdownMenuItem
                          onClick={() => onRemoveMemberFromChat(post.user_id)}
                          className="text-red-600 dark:text-red-400"
                        >
                          <UserMinus className="h-4 w-4 mr-2" /> Remove Team
                          Member
                        </DropdownMenuItem>
                      )}
                    <DropdownMenuItem
                      onClick={() => onStartForwardSelection?.(post.id)}
                    >
                      <Forward className="h-4 w-4 mr-2" /> Forward Message
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        navigator.clipboard.writeText(post.content);
                        toast.success("Copied to clipboard");
                      }}
                    >
                      <Copy className="h-4 w-4 mr-2" />{" "}
                      {/(https?:\/\/[^\s]+)/gi.test(post.content || "")
                        ? "Copy Link"
                        : "Copy Text"}
                    </DropdownMenuItem>
                    {/* Quick emoji row inside dropdown */}
                    <div className="px-2 py-1.5 border-t border-gray-100 dark:border-gray-700">
                      <div className="flex gap-1.5">
                        {QUICK_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => handleEmojiClick(emoji)}
                            className="text-lg hover:scale-125 transition-transform"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                    {isMember && (
                      <>
                        {/* Delete — opens selection mode with dialog for everyone/me choice */}
                        <DropdownMenuItem
                          onClick={() => onStartDeleteSelection?.(post.id)}
                          className="text-red-600 dark:text-red-400 focus:text-red-600 border-t border-gray-100 dark:border-gray-700"
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {/* Quoted Message (WhatsApp style) */}
            {post.parent_id && !isDeletedMessage && (
              <div
                className="mb-1.5 p-2 bg-black/5 dark:bg-black/10 rounded border-l-[3px] border-primary cursor-pointer hover:bg-black/10 transition-colors overflow-hidden"
                onClick={() => onScrollToMessage?.(post.parent_id!)}
              >
                <p className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 uppercase tracking-tight">
                  {allPosts.find((p) => p.id === post.parent_id)?.author_name ||
                    "Original Message"}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-300 truncate mt-0.5 whitespace-nowrap overflow-hidden">
                  {allPosts.find((p) => p.id === post.parent_id)?.content ||
                    "Message deleted or missing"}
                </p>
              </div>
            )}

            {/* Full Emoji Picker (floating) */}
            {!isDeletedMessage &&
              showEmojiPicker &&
              createPortal(
                <div
                  ref={emojiPickerRef}
                  className={`fixed z-[999] ${isAuthor ? "right-[700px]" : "left-[1250px]"
                    } top-40 shadow-xl bg-card/80 backdrop-blur-md border border-border rounded-xl shadow-2xl`}
                >
                  <button
                    onClick={() => setShowEmojiPicker(false)}
                    className="absolute top-1 right-2 h-4 w-4 bg-primary rounded-full shadow-lg flex items-center justify-center text-white hover:text-white border border-border z-[1000] transition-all hover:scale-110 active:scale-95"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  <EmojiPicker
                    onEmojiClick={(emojiData) =>
                      handleEmojiClick(emojiData.emoji)
                    }
                    width={280}
                    height={360}
                    theme={Theme.AUTO}
                    style={
                      {
                        background: "rgba(255,255,255,0.1)",
                        "--epr-bg-color": "rgba(255,255,255,0.1)",
                        "--epr-category-label-bg-color":
                          "rgba(255,255,255,0.1)",
                      } as any
                    }
                  />
                </div>,
                document.body,
              )}

            {/* Author name for received */}
            {!isAuthor && (
              <p
                className={`text-[11px] font-bold mb-0.5 ${memberColor!.name}`}
              >
                {post.author_name || "Unknown"}
              </p>
            )}

            {/* Message content or Call Log */}
            {isCallLog && !isDeletedMessage ? (
              <div className="flex items-center gap-3 py-1 pr-8">
                <div
                  className={`flex items-center justify-center h-10 w-10 rounded-full shrink-0 ${isMissedCall
                    ? "bg-red-50 dark:bg-red-900/20"
                    : "bg-emerald-50 dark:bg-emerald-900/20"
                    }`}
                >
                  <CallIcon
                    className={`h-5 w-5 ${isMissedCall ? "text-red-500" : "text-emerald-600"}`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-semibold truncate ${isMissedCall ? "text-red-500" : "text-foreground"
                      }`}
                  >
                    {isMissedCall
                      ? isVideoCall
                        ? "Missed video call"
                        : "Missed voice call"
                      : isVideoCall
                        ? "Video call"
                        : "Voice call"}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <CallStatusIcon className={`h-3 w-3 ${callStatusColor}`} />
                    <p className="text-xs text-muted-foreground truncate">
                      {formatCallDuration(callData.duration || 0)}
                    </p>
                  </div>
                </div>
              </div>
            ) : isEventMessage && !isDeletedMessage ? (
              <div className="py-1 pr-8 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 shrink-0">
                    <Calendar className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">
                      {eventData?.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground font-medium">
                      Meeting Invitation
                    </p>
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-[11px] text-gray-600 dark:text-gray-300">
                    <Clock className="h-3.5 w-3.5 text-blue-500" />
                    <span>{eventData?.time}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-gray-600 dark:text-gray-300">
                    <MapPin className="h-3.5 w-3.5 text-blue-500" />
                    <span>{eventData?.location}</span>
                  </div>
                </div>

                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full h-8 text-[11px] font-bold border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 gap-2"
                  onClick={() => navigate('/collaboration/calendar')}
                >
                  View in Calendar
                  <ArrowUpRight className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <p
                className={`text-[13px] leading-relaxed whitespace-pre-wrap break-words pr-6 text-gray-800 ${isAuthor ? "dark:text-white" : "dark:text-gray-200"
                  }`}
              >
                {isDeletedMessage ? (
                  <span className="italic text-gray-500 dark:text-gray-400">
                    🚫 {deletedPlaceholder}
                  </span>
                ) : (
                  <>
                    {(() => {
                      const content = post.content || "";
                      const lines = content.split("\n");
                      const isLong = lines.length > 10;
                      const hasMore = visibleLinesCount < lines.length;
                      const displayedContent = !isLong ? content : lines.slice(0, visibleLinesCount).join("\n");
                      
                      return (
                        <>
                          {renderMessageWithMentions(displayedContent)}
                          {isLong && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (hasMore) {
                                  setVisibleLinesCount(prev => prev + 10);
                                } else {
                                  setVisibleLinesCount(10);
                                }
                              }}
                              className="text-[11px] font-bold text-primary hover:underline mt-1 block w-fit"
                            >
                              {hasMore ? "Read More" : "Show Less"}
                            </button>
                          )}
                        </>
                      );
                    })()}
                  </>
                )}
              </p>
            )}

            {!isDeletedMessage && attachments.length > 0 && (
              <div className="mt-2 space-y-2">
                {attachments.map((attachment: any, idx: number) => {
                  const downloadUrl = attachment.id
                    ? getAuthedFileUrlForPost(attachment.id, "download")
                    : attachment.download_url || "#";
                  const previewUrl = attachment.id
                    ? getAuthedFileUrlForPost(attachment.id, "view")
                    : attachment.download_url || "#";
                  return (
                    <div
                      key={attachment.id || `${post.id}-attachment-${idx}`}
                      className="rounded-lg border border-black/10 bg-black/5 p-2"
                    >
                      {isImageAttachment(attachment.file_type) ? (
                        <img
                          src={previewUrl}
                          alt={attachment.original_name || "attachment"}
                          className="w-full max-h-56 object-cover rounded-md cursor-pointer"
                          onClick={() => window.open(previewUrl, "_blank")}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => window.open(previewUrl, "_blank")}
                          className="w-full text-left text-sm font-medium hover:underline"
                        >
                          {attachment.original_name || "Attachment"}
                        </button>
                      )}
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">
                            {attachment.original_name || "Attachment"}
                          </p>
                          <p className="text-[11px] text-gray-500">
                            {formatFileSize(attachment.file_size || 0)}
                          </p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => window.open(previewUrl, "_blank")}
                            >
                              Open
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                const link = document.createElement("a");
                                link.href = downloadUrl;
                                link.download =
                                  attachment.original_name || "attachment";
                                link.click();
                              }}
                            >
                              Download
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Time + read status */}
            <div className="flex items-center gap-1 justify-end mt-1 -mr-1">
              <span className="text-[9px] text-gray-400 font-medium uppercase">
                {timeString}
              </span>
              {isAuthor && (
                <span
                  className={`text-[9px] ${(post.seen_count || 0) > 0
                    ? "text-primary"
                    : "text-gray-400"
                    }`}
                >
                  ✓✓
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Avatar — only for sent */}
        {isAuthor && (
          <Avatar className="h-7 w-7 flex-shrink-0 mb-0.5">
            <AvatarImage src={getAvatarUrl(post.author_avatar)} />
            <AvatarFallback className="bg-blue-100 text-blue-700 text-[10px] font-bold">
              {(post.author_name || "?").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        )}
      </div>

      {/* Reaction pills */}
      {!isDeletedMessage && reactionEntries.length > 0 && (
        <div
          className={`flex flex-wrap gap-1 mt-0.5 mb-1 ${isAuthor ? "justify-end mr-9" : "justify-start ml-9"}`}
        >
          {(() => {
            // Pick the last emoji type added to the object as a proxy for "latest"
            const lastEmoji = reactionEntries[reactionEntries.length - 1][0];
            const isMyReaction = reactionEntries.some(([, users]) =>
              users.includes(currentUserId || ""),
            );

            return (
              <button
                onClick={() => setShowReactionsDialog(true)}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium shadow-sm transition-all ${isMyReaction
                  ? "bg-blue-100 border border-blue-300 text-blue-700"
                  : "bg-card border border-border text-foreground hover:bg-muted/50"
                  }`}
                title="View reactions"
              >
                <span className="text-sm">{lastEmoji}</span>
                <span className="font-bold">{totalReactionCount}</span>
              </button>
            );
          })()}
        </div>
      )}

      {/* Small reactions dialog for this message */}
      {!isDeletedMessage && showReactionsDialog && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/25 px-4">
          <div className="w-full max-w-xs rounded-xl border border-border bg-card p-3 shadow-2xl">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                Message Reactions ({totalReactionCount})
              </p>
              <button
                onClick={() => setShowReactionsDialog(false)}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
              {reactionEntries.map(([emoji, users]) => {
                const isActive = users.includes(currentUserId || "");
                return (
                  <button
                    key={`dialog-${post.id}-${emoji}`}
                    onClick={() => handleEmojiClick(emoji)}
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium transition-colors ${isActive
                      ? "border-blue-300 bg-blue-100 text-blue-700"
                      : "border-border bg-muted/50 text-foreground hover:bg-muted"
                      }`}
                    title={
                      isActive
                        ? "Click to remove your reaction"
                        : "Click to add your reaction"
                    }
                  >
                    <span>{emoji}</span>
                    <span>{users.length}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-2 max-h-44 space-y-2 overflow-y-auto border-t border-gray-100 pt-2 dark:border-gray-700">
              {sortedReactionEntries.map(([emoji, users]) => {
                const isMyReaction = users.includes(currentUserId || "");
                return (
                  <div
                    key={`names-${post.id}-${emoji}`}
                    className={`rounded-md px-2 py-1.5 ${isMyReaction ? "bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30" : "bg-muted/50"}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                        {emoji} {users.length}
                      </p>
                      {isMyReaction && (
                        <button
                          onClick={() => handleEmojiClick(emoji)}
                          className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                          title="Remove your reaction"
                        >
                          <Trash2 className="h-3 w-3 text-red-500" />
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed">
                      {users.map((uid) => resolveUserName(uid)).join(", ")}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 border-t border-gray-100 pt-2 dark:border-gray-700">
              <p className="mb-1 text-[11px] text-gray-500">
                Tap any emoji to add/remove your own reaction only.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={`dialog-quick-${post.id}-${emoji}`}
                    onClick={() => handleEmojiClick(emoji)}
                    className="rounded-full border border-border bg-card px-2 py-1 text-sm hover:bg-muted"
                  >
                    {emoji}
                  </button>
                ))}
                <button
                  onClick={() => {
                    setShowReactionsDialog(false);
                    setShowEmojiPicker(true);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  title="More emojis"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Seen By tracking - Restricted to Author within Broadcasts only */}
      {isAuthor && isBroadcast && post.seen_by && post.seen_by.length > 0 && (
        <div 
          className={`flex items-center gap-1.5 mt-1 px-1 mb-2 cursor-pointer hover:opacity-80 transition-opacity ${isAuthor ? "justify-end mr-9" : "justify-start ml-9"}`}
          onClick={() => setShowSeenByDialog(true)}
        >
          <div className="flex -space-x-1 overflow-hidden">
            {post.seen_by.slice(0, 6).map((u: any) => (
              <Avatar key={u.user_id} className="h-4 w-4 border border-background ring-0">
                <AvatarImage src={getAvatarUrl(u.avatar_url)} />
                <AvatarFallback className="text-[6px] bg-muted">
                  {u.full_name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
          {post.seen_by.length > 6 && (
            <button
              onClick={() => setShowSeenByDialog(true)}
              className="text-[10px] font-bold text-muted-foreground hover:text-primary transition-colors flex items-center gap-0.5"
            >
              +{post.seen_by.length - 6}
            </button>
          )}
        </div>
      )}

      {/* Seen By Full List Dialog */}
      <Dialog open={showSeenByDialog} onOpenChange={setShowSeenByDialog}>
        <DialogContent className="max-w-[320px] p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-4 border-b bg-muted/30">
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Message Seen By
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[350px] overflow-y-auto py-2">
            {post.seen_by?.map((u: any) => (
              <div key={u.user_id} className="flex items-center gap-3 px-4 py-2 hover:bg-muted/50 transition-colors">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={getAvatarUrl(u.avatar_url)} />
                  <AvatarFallback className="text-xs">{u.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate text-foreground">{u.full_name}</p>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
