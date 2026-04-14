import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { useAuth } from "@/contexts/AuthContext";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useCustomDialog } from "@/contexts/DialogContext";
import { useRealtime, useWorkgroupRealtime } from "@/hooks/useRealtime";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  workgroupId: string;
  onBack: () => void;
}

export default function WorkgroupDetailView({ workgroupId, onBack }: Props) {
  const { user, profile } = useAuth();
  const { prompt, confirm } = useCustomDialog();
  const { data: workgroup } = useWorkgroup(workgroupId);
  const { data: allWorkgroups = [] } = useWorkgroups();
  const { data: members = [], isLoading: membersLoading } =
    useWorkgroupMembers(workgroupId);
  const queryClient = useQueryClient();
  const { on: onRealtime, off: offRealtime } = useRealtime();
  const {
    data: posts = [],
    isLoading: postsLoading,
    refetch: refetchPosts,
  } = useWorkgroupPosts(workgroupId);
  const { users: orgUsers = [] } = useAdminUsers();
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
  const workgroupDisplayName = workgroup?.display_name || workgroup?.name || "Direct chat";

  // Listen to Socket.io real-time chat updates
  useWorkgroupRealtime(
    workgroupId,
    (newMessage) => {
      // Invalidate the cache to trigger a fast refetch when a new post arrives
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
      if (!payload?.workgroup_id || payload.workgroup_id !== workgroupId) return;
      if (!payload.workgroup) return;

      queryClient.setQueryData(["workgroup", workgroupId], payload.workgroup);
      // Keep workgroup list server-authoritative for privacy/member visibility.
      queryClient.invalidateQueries({ queryKey: ["workgroups"] });
    };

    onRealtime("workgroup:updated", handleWorkgroupUpdated);
    return () => {
      offRealtime("workgroup:updated", handleWorkgroupUpdated);
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
  const [showCreateWikiPage, setShowCreateWikiPage] = useState(false);
  const [newWikiPageTitle, setNewWikiPageTitle] = useState("");
  const [newWikiPageContent, setNewWikiPageContent] = useState("");
  const [showMembersList, setShowMembersList] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showInputEmojiPicker, setShowInputEmojiPicker] = useState(false);
  const [isForwardSelectMode, setIsForwardSelectMode] = useState(false);
  const [selectedForwardPostIds, setSelectedForwardPostIds] = useState<string[]>(
    [],
  );
  const [showForwardDialog, setShowForwardDialog] = useState(false);
  const [forwardSearch, setForwardSearch] = useState("");
  const [selectedForwardWorkgroupIds, setSelectedForwardWorkgroupIds] =
    useState<string[]>([]);
  const [isForwardingMessages, setIsForwardingMessages] = useState(false);
  const [isDeleteSelectMode, setIsDeleteSelectMode] = useState(false);
  const [selectedDeletePostIds, setSelectedDeletePostIds] = useState<string[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeletingMessages, setIsDeletingMessages] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const membersScrollRef = useRef<HTMLDivElement>(null);
  const composerEmojiRef = useRef<HTMLDivElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const mentionStartRef = useRef<number | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Auto-scroll to bottom on new posts
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [posts]);

  // Refresh teams list unread badge after opening/reading messages.
  useEffect(() => {
    if (!workgroupId) return;
    queryClient.invalidateQueries({ queryKey: ["workgroups"] });
  }, [workgroupId, posts.length, queryClient]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isAtBottom =
      target.scrollHeight - target.scrollTop <= target.clientHeight + 150;
    setShowScrollBottom(!isAtBottom);
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
  const flatPosts = useMemo(() => {
    const all: WorkgroupPost[] = [];
    posts.forEach((p) => {
      all.push(p);
      if (p.replies) {
        p.replies.forEach((r) => {
          all.push({ ...r, parent_id: r.parent_id || p.id });
        });
      }
    });
    // Sort chronologically (oldest to newest)
    return all.sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  }, [posts]);

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
  const workgroupSettings =
    workgroup && typeof (workgroup as any).settings === "object"
      ? (workgroup as any).settings
      : {};
  const isDirectChat = Boolean(workgroupSettings?.is_direct_chat);
  const assignedMemberManagerId =
    workgroupSettings?.member_manager_user_id || null;
  const isAssignedMemberManager = assignedMemberManagerId === user?.id;
  const canManageMembers = Boolean(
    !isDirectChat && (isOwner || isTeamCreator || isAssignedMemberManager),
  );
  const canDeleteTeam =
    Boolean(isOwner || isTeamCreator);
  const canDeleteEveryoneForSelection = useMemo(() => {
    const hasElevatedRole = ["owner", "admin"].includes(
      currentUserMembership?.role || "",
    );
    if (hasElevatedRole) return true;
    return selectedDeletePosts.every((post) => post.user_id === user?.id);
  }, [currentUserMembership?.role, selectedDeletePosts, user?.id]);
  const canStartConversation = members.length > 1;
  const memberUserIds = new Set(members.map((m) => m.user_id));
  const availableUsers = orgUsers.filter((u) => !memberUserIds.has(u.id));
  const handlePost = () => {
    if (!newPost.trim() || !canStartConversation) return;
    const mentionsToSend = selectedMentions
      .filter((m) => newPost.includes(`@${m.label}`))
      .map((m) => m.id);

    if (replyTo) {
      // Send as reply
      createPost.mutate(
        { workgroupId, content: newPost, parentId: replyTo, mentions: mentionsToSend },
        {
          onSuccess: () => {
            setNewPost("");
            setReplyTo(null);
            setSelectedMentions([]);
            setShowMentionSuggestions(false);
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
          },
        },
      );
    }
  };

  const filteredMentionMembers = members
    .filter((m) => m.user_id !== user?.id)
    .filter((m) => {
      const q = mentionQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        (m.full_name || "").toLowerCase().includes(q) ||
        (m.email || "").toLowerCase().includes(q)
      );
    })
    .slice(0, 8);

  const handleComposerChange = (value: string, cursorPos: number) => {
    setNewPost(value);
    const textBeforeCursor = value.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/(?:^|\s)@([^\s@]*)$/);
    if (mentionMatch) {
      mentionStartRef.current = cursorPos - mentionMatch[1].length - 1;
      setMentionQuery(mentionMatch[1] || "");
      setShowMentionSuggestions(true);
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

    const alreadySelected = selectedMentions.some((m) => m.id === member.user_id);
    if (alreadySelected) {
      const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const mentionRegex = new RegExp(`@${escapedLabel}\\s?`, "g");
      const cleaned = newPost.replace(mentionRegex, "").replace(/\s{2,}/g, " ").trimStart();
      setNewPost(cleaned);
      setSelectedMentions((prev) => prev.filter((m) => m.id !== member.user_id));
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
    const after = canReplaceTypedQuery ? newPost.slice(cursorPos) : newPost.slice(cursorPos);
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
  };

  const clearDeleteSelection = () => {
    setIsDeleteSelectMode(false);
    setSelectedDeletePostIds([]);
    setShowDeleteDialog(false);
  };

  const handleDeleteSelectedMessages = async (
    mode: "me" | "everyone",
  ) => {
    if (selectedDeletePosts.length === 0) {
      toast.error("Please select at least one message");
      return;
    }

    setIsDeletingMessages(true);
    try {
      for (const post of selectedDeletePosts) {
        if (mode === "me") {
          await deletePostForMe.mutateAsync({ postId: post.id, workgroupId });
        } else {
          await deletePost.mutateAsync({ postId: post.id, workgroupId });
        }
      }

      toast.success(
        mode === "me"
          ? "Selected messages deleted for you"
          : "Selected messages deleted for everyone",
      );
      clearDeleteSelection();
    } catch (error: any) {
      toast.error(
        error?.response?.data?.error || "Failed to delete selected messages",
      );
    } finally {
      setIsDeletingMessages(false);
    }
  };

  const getAuthedFileUrl = (fileId: string, mode: "view" | "download" = "download") => {
    const token = api.getToken();
    const baseUrl = `${API_BASE_URL}/workgroups/${workgroupId}/files/${fileId}/${mode}`;
    return token
      ? `${baseUrl}?token=${encodeURIComponent(token)}`
      : baseUrl;
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
      toast.error(error?.response?.data?.error || "Failed to send file");
    } finally {
      if (attachmentInputRef.current) {
        attachmentInputRef.current.value = "";
      }
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

  const scrollToMessage = (id: string) => {
    const element = document.getElementById(`msg-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.classList.add("ring-2", "ring-blue-400", "ring-offset-2");
      setTimeout(() => {
        element.classList.remove("ring-2", "ring-blue-400", "ring-offset-2");
      }, 2000);
    }
  };

  const handleStartMeeting = () => {
    // In a real app, this would integrate with Teams/Zoom/Google Meet
    toast.success(`Starting video meeting for ${workgroupDisplayName}...`);
    // Simulate opening meeting
    window.open(`https://meet.google.com/new`, "_blank");
  };

  const handleStartCall = () => {
    // In a real app, this would start an audio call
    toast.success(`Starting audio call for ${workgroupDisplayName}...`);
    // Simulate starting call
    console.log("Starting audio call...");
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
    if (memberToRemove.role === "owner" || memberToRemove.user_id === user?.id) {
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
    const shouldLeave = await confirm("Are you sure you want to leave this team?", {
      title: "Leave Team",
      variant: "destructive",
    });
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

  if (!workgroup) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading team...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 flex overflow-hidden">
      {/* Left Sidebar - Team Info & Members */}
      <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
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
                {isDirectChat ? "Direct chat" : `${members.length} members`}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!isDirectChat && (
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
                {!isDirectChat && (
                  <DropdownMenuItem>
                    <Settings className="h-4 w-4 mr-2" /> Team Settings
                  </DropdownMenuItem>
                )}
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
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {workgroup.description}
            </p>
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
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Channels
          </h3>
          <div className="space-y-1">
            <div
              className={`flex items-center gap-2 px-3  py-2 rounded-lg cursor-pointer transition-colors ${activeTab === "posts"
                ? "bg-blue-50 dark:bg-blue-900/20 text-primary dark:text-blue-300"
                : "hover:bg-primary hover:text-white dark:hover:bg-gray-700"
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
        </div>

        {/* Members Preview */}
        <div className="p-4 flex-1 min-h-0 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              {isDirectChat ? "Chat participants" : `Members (${members.length})`}
            </h3>
            {canManageMembers && (
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
          {canManageMembers && (
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

          <div
            ref={membersScrollRef}
            className="space-y-2 flex-1 overflow-y-auto pr-1"
          >
            {members.map((member) => (
              <div
                key={member.id}
                className="group flex items-start gap-2 p-2.5 rounded-xl border border-gray-200/70 dark:border-gray-700 bg-white/60 dark:bg-gray-800/50 hover:border-primary/30 hover:bg-primary/5 transition-colors"
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs">
                    {(member.full_name || "?").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {member.full_name || member.email || "Unknown"}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                    {member.role === "owner" && (
                      <Crown className="h-3 w-3 text-yellow-500" />
                    )}
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {member.role}
                    </span>
                    <span
                      className={`text-xs font-medium ml-1 ${member.is_online
                        ? "text-primary"
                        : "text-red-500 dark:text-red-400"
                        }`}
                    >
                      {member.is_online ? "Online" : "Offline"}
                    </span>
                    {!member.is_online && member.last_seen_at && (
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">
                        Last seen{" "}
                        {formatDistanceToNow(new Date(member.last_seen_at), {
                          addSuffix: true,
                        })}
                      </span>
                    )}
                  </div>
                </div>
                {((member.user_id === user?.id && member.role !== "owner") ||
                  (canManageMembers &&
                    member.user_id !== user?.id &&
                    member.role !== "owner")) && (
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
                        {member.user_id === user?.id ? (
                          <DropdownMenuItem
                            className="text-red-600 dark:text-red-400"
                            onClick={() => handleLeaveTeam(member.id)}
                          >
                            <UserMinus className="h-4 w-4 mr-2" />
                            Leave Team
                          </DropdownMenuItem>
                        ) : (
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
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Hash className="h-5 w-5 text-gray-600 dark:text-gray-400" />
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
                  className="pl-10 w-64 bg-gray-50 dark:bg-gray-700"
                />
              </div>
              <Button variant="ghost" size="icon">
                <Star className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowNotifications(true)}
                className="relative"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-xs text-white font-bold">
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
                    className="flex-1 overflow-y-auto p-4 space-y-2 relative"
                    style={{
                      backgroundImage:
                        "url(\"data:image/svg+xml,%3Csvg width='200' height='200' viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%239C92AC' fill-opacity='0.03'%3E%3Cpath d='M100 0L200 100L100 200L0 100Z'/%3E%3C/g%3E%3C/svg%3E\")",
                    }}
                  >
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
                        {canManageMembers && (
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
                      flatPosts.map((post, index) => {
                        const prevPost = index > 0 ? flatPosts[index - 1] : null;
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
                          return new Date(post.created_at).toLocaleDateString(
                            undefined,
                            {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            },
                          );
                        };

                        return (
                          <div key={post.id}>
                            {showDateSeparator && (
                              <div className="flex justify-center my-6">
                                <span className="px-3 py-1 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg text-[11px] font-bold text-gray-500 shadow-sm border border-gray-100 dark:border-gray-700 uppercase tracking-wider">
                                  {dateLabel()}
                                </span>
                              </div>
                            )}
                            <PostCard
                              post={post}
                              allPosts={flatPosts}
                              workgroupId={workgroupId}
                              isGroupAdmin={canManageMembers}
                              isMember={isMember}
                              currentUserId={user?.id}
                              memberDirectory={members}
                              postAuthorRole={
                                members.find((m) => m.user_id === post.user_id)?.role
                              }
                              onSetReplyTo={setReplyTo}
                              onScrollToMessage={scrollToMessage}
                              onRemoveMemberFromChat={handleRemoveMemberFromChat}
                              isForwardSelectMode={isForwardSelectMode}
                              isSelectedForForward={selectedForwardPostIds.includes(
                                post.id,
                              )}
                              onToggleForwardSelection={handleToggleForwardPost}
                              onStartForwardSelection={startForwardSelection}
                              isDeleteSelectMode={isDeleteSelectMode}
                              isSelectedForDelete={selectedDeletePostIds.includes(
                                post.id,
                              )}
                              onToggleDeleteSelection={handleToggleDeletePost}
                              onStartDeleteSelection={startDeleteSelection}
                              onDelete={(postId) =>
                                deletePost.mutate({ postId, workgroupId })
                              }
                              onTogglePin={(postId, isPinned) =>
                                togglePin.mutate({ postId, isPinned, workgroupId })
                              }
                              onReaction={async (postId, emoji) => {
                                try {
                                  const response = await fetch(
                                    `${import.meta.env.VITE_API_URL || "http://localhost:3001/api"}/workgroups/${workgroupId}/posts/${postId}/reactions`,
                                    {
                                      method: "POST",
                                      headers: {
                                        "Content-Type": "application/json",
                                        Authorization: `Bearer ${localStorage.getItem("token")}`,
                                      },
                                      body: JSON.stringify({ reaction: emoji }),
                                    },
                                  );
                                  if (response.ok) {
                                    queryClient.invalidateQueries({
                                      queryKey: ["workgroup-posts", workgroupId],
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

                    {/* Scroll to Bottom Button */}
                    {showScrollBottom && (
                      <button
                        onClick={scrollToBottom}
                        className="fixed bottom-24 right-8 z-50 bg-white dark:bg-gray-800 p-2.5 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-blue-600 transition-all hover:scale-110 active:scale-95 animate-in fade-in zoom-in duration-200"
                      >
                        <ChevronDown className="h-5 w-5" />
                      </button>
                    )}
                  </div>

                  {/* Message Input - Fixed at Bottom */}
                  {isMember && canStartConversation && (
                    <div className="flex-shrink-0 border-t border-gray-100 dark:border-gray-800 p-3 bg-white dark:bg-gray-900">
                      <div className="max-w-5xl mx-auto w-full flex flex-col gap-2">
                        {/* Reply Preview (WhatsApp style) */}
                        {replyTo && (
                          <div className="flex animate-in slide-in-from-bottom-2 duration-200">
                            <div className="flex-1 flex gap-3 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-l-4 border-blue-500 shadow-sm">
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-bold text-blue-600 uppercase tracking-tight">
                                  Replying to{" "}
                                  {findMessageById(replyTo)?.author_name}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                  {findMessageById(replyTo)?.content}
                                </p>
                              </div>
                              <button
                                onClick={() => setReplyTo(null)}
                                className="h-6 w-6 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                              >
                                <span className="text-gray-400 text-sm">✕</span>
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
                          <div ref={composerEmojiRef} className="flex-1 relative">
                            <Input
                              ref={messageInputRef}
                              value={newPost}
                              onChange={(e) =>
                                handleComposerChange(
                                  e.target.value,
                                  e.target.selectionStart ?? e.target.value.length,
                                )
                              }
                              placeholder={
                                replyTo ? "Type a reply..." : "Type a message..."
                              }
                              className="w-full pl-4 pr-32 bg-gray-100 dark:bg-gray-800 border-none rounded-full h-11 focus-visible:ring-1 focus-visible:ring-blue-500 shadow-inner"
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  handlePost();
                                }
                              }}
                            />
                            {showMentionSuggestions &&
                              filteredMentionMembers.length > 0 && (
                                <div className="absolute bottom-12 left-0 z-30 w-[60%] max-w-[92vw] rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900 max-h-56 overflow-y-auto">
                                  {filteredMentionMembers.map((member) => (
                                    <button
                                      key={member.user_id}
                                      type="button"
                                      onClick={() => insertMention(member)}
                                      className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2"
                                    >
                                      <Checkbox
                                        checked={selectedMentions.some(
                                          (m) => m.id === member.user_id,
                                        )}
                                        className="pointer-events-none"
                                      />
                                      <Avatar className="h-7 w-7">
                                        <AvatarFallback className="text-[10px]">
                                          {(member.full_name || member.email || "?")
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
                                onClick={() => attachmentInputRef.current?.click()}
                              >
                                <Paperclip className="h-5 w-5" />
                              </Button>
                              <button
                                onClick={handlePost}
                                disabled={!newPost.trim() || createPost.isPending}
                                className={`h-8 w-8 flex items-center justify-center rounded-full transition-all ${newPost.trim()
                                  ? "bg-blue-600 text-white shadow-md hover:scale-105 active:scale-95"
                                  : "bg-gray-200 text-gray-400 dark:bg-gray-700 pointer-events-none"
                                  }`}
                              >
                                <Send className="h-4 w-4" />
                              </button>
                            </div>
                            {showInputEmojiPicker && (
                              <div className="absolute bottom-12 right-2 z-20 shadow-xl rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
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
                      </div>
                    </div>
                  )}
                  {isForwardSelectMode && (
                    <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-800 p-3 bg-white dark:bg-gray-900">
                      <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
                        <p className="text-sm text-gray-700 dark:text-gray-300">
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
                    <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-800 p-3 bg-white dark:bg-gray-900">
                      <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          {selectedDeletePostIds.length} message(s) selected
                        </p>
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
                        className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-sm transition-shadow"
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
                        className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-sm transition-shadow cursor-pointer"
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
                  const checked = selectedForwardWorkgroupIds.includes(target.id);
                  return (
                    <label
                      key={target.id}
                      className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) =>
                          toggleForwardTarget(target.id, Boolean(value))
                        }
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{target.name}</p>
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
            <Button variant="outline" onClick={() => setShowForwardDialog(false)}>
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
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
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
            {availableUsers.length === 0 ? (
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
                  <label className="text-sm font-medium text-gray-900 dark:text-white">
                    Select User ({availableUsers.length} available)
                  </label>
                  <Select
                    value={selectedUserId}
                    onValueChange={setSelectedUserId}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose a team member to add..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-64 overflow-y-auto">
                      {availableUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          <div className="flex items-center gap-3 py-1">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">
                                {(u.full_name || u.email || "?")
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900">
                                {u.full_name || "Unknown"}
                              </p>
                              <p className="text-sm text-gray-600">{u.email}</p>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedUserId && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
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
                          {
                            availableUsers.find((u) => u.id === selectedUserId)
                              ?.email
                          }
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
              members.map((member) => (
                <div
                  key={member.id}
                  className="group flex items-start gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/40 hover:border-primary/30 hover:bg-primary/5 transition-colors"
                >
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className="bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300">
                      {(member.full_name || "?").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {member.full_name || member.email || "Unknown User"}
                    </p>
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
                    {!member.is_online && member.last_seen_at && (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        Last seen{" "}
                        {formatDistanceToNow(new Date(member.last_seen_at), {
                          addSuffix: true,
                        })}
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
                    {((member.user_id === user?.id && member.role !== "owner") ||
                      (canManageMembers &&
                        member.user_id !== user?.id &&
                        member.role !== "owner")) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-600 dark:text-gray-300 transition-colors group-hover:bg-primary group-hover:text-white hover:bg-primary hover:text-white"
                          onClick={() =>
                            member.user_id === user?.id
                              ? handleLeaveTeam(member.id)
                              : removeMember.mutate({
                                memberId: member.id,
                                workgroupId,
                              })
                          }
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      )}
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            {canManageMembers && (
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
            {notifications.length === 0 ? (
              <div className="text-center py-8">
                <Bell className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${notification.is_read
                    ? "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
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
                        {notification.message}
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
    </div>
  );
}
// ─── Quick Emojis ────────────────────────────────────────────────────────────────────
const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "🙏"];

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
  onTogglePin: (postId: string, isPinned: boolean) => void;
  onReaction?: (postId: string, emoji: string) => void;
  onScrollToMessage?: (id: string) => void;
  onRemoveMemberFromChat?: (memberUserId: string) => void;
  memberDirectory?: Array<{ user_id: string; full_name?: string; email?: string }>;
  isForwardSelectMode?: boolean;
  isSelectedForForward?: boolean;
  onToggleForwardSelection?: (postId: string, checked: boolean) => void;
  onStartForwardSelection?: (postId: string) => void;
  isDeleteSelectMode?: boolean;
  isSelectedForDelete?: boolean;
  onToggleDeleteSelection?: (postId: string, checked: boolean) => void;
  onStartDeleteSelection?: (postId: string) => void;
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
}: PostCardProps) {
  const navigate = useNavigate();
  if ((post.content || "").startsWith("[SYSTEM] ")) {
    return (
      <div className="flex justify-center my-3">
        <span className="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-[11px] font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
          {post.content.replace("[SYSTEM] ", "")}
        </span>
      </div>
    );
  }

  const isAuthor = post.user_id === currentUserId;
  const deletedForUsers = Array.isArray((post as any).deleted_for_users)
    ? ((post as any).deleted_for_users as string[])
    : [];
  const isDeletedForMe = Boolean(
    currentUserId && deletedForUsers.includes(currentUserId),
  );
  const isDeletedMessage = Boolean(post.is_deleted || isDeletedForMe);
  const deletedPlaceholder = isDeletedForMe || (isDeletedMessage && isAuthor)
    ? "You deleted this message"
    : "This message was deleted";
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showReactionsDialog, setShowReactionsDialog] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const reactions: Record<string, string[]> = post.reactions || {};
  const reactionEntries = Object.entries(reactions);
  const totalReactionCount = reactionEntries.reduce(
    (sum, [, users]) => sum + users.length,
    0,
  );

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

  const handleEmojiClick = (emoji: string) => {
    onReaction?.(post.id, emoji);
    setShowEmojiPicker(false);
  };
  const resolveUserName = (userId: string) => {
    if (userId === currentUserId) return "You";
    const member = memberDirectory.find((m) => m.user_id === userId);
    return member?.full_name?.trim() || member?.email || "Unknown user";
  };
  const mentionEntries = useMemo(
    () =>
      (memberDirectory || [])
        .map((member) => ({
          userId: member.user_id,
          label: (member.full_name || member.email || "").trim(),
        }))
        .filter((entry) => entry.label.length > 0)
        .sort((a, b) => b.label.length - a.label.length),
    [memberDirectory],
  );
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
    if (!mentionEntries.length || !text.includes("@")) return text;
    const pattern = mentionEntries
      .map((entry) => escapeRegex(`@${entry.label}`))
      .join("|");
    if (!pattern) return text;
    const mentionRegex = new RegExp(`(${pattern})`, "gi");
    const parts = text.split(mentionRegex);
    return parts.map((part, idx) => {
      const targetUserId = mentionLookup.get(part.toLowerCase());
      if (!targetUserId) return <span key={`txt-${idx}`}>{part}</span>;
      return (
        <button
          key={`mention-${idx}`}
          type="button"
          onClick={async () => {
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
          className="font-semibold text-emerald-700 hover:underline"
        >
          {part}
        </button>
      );
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
    return token
      ? `${baseUrl}?token=${encodeURIComponent(token)}`
      : baseUrl;
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
        {isForwardSelectMode && (
          <Checkbox
            checked={isSelectedForForward}
            onCheckedChange={(value) =>
              onToggleForwardSelection?.(post.id, Boolean(value))
            }
          />
        )}
        {isDeleteSelectMode && (
          <Checkbox
            checked={isSelectedForDelete}
            onCheckedChange={(value) =>
              onToggleDeleteSelection?.(post.id, Boolean(value))
            }
          />
        )}
        {/* Avatar — only for received */}
        {!isAuthor && (
          <Avatar className="h-7 w-7 flex-shrink-0 mb-0.5">
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
            className={`relative min-w-[85px] order-1 ${isAuthor
              ? "bg-white text-gray-800 rounded-2xl rounded-tr-sm shadow-sm"
              : "bg-[#d9fdd3] text-gray-800 rounded-2xl rounded-tl-sm"
              } px-3 py-2 shadow-sm group/bubble border border-black/5`}
          >
            {/* Dropdown Chevron - Inside Bubble top-right */}
            <div
              className={`absolute top-1 right-1 z-10 opacity-0 group-hover/bubble:opacity-100 transition-opacity`}
            >
              {!isDeletedMessage && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="text-gray-400 hover:text-gray-600 transition-colors p-0.5 rounded">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align={isAuthor ? "end" : "start"}
                    className="w-48"
                  >
                    {isMember && (
                      <DropdownMenuItem onClick={() => onSetReplyTo(post.id)}>
                        <Reply className="h-4 w-4 mr-2" /> Reply
                      </DropdownMenuItem>
                    )}
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
                          <UserMinus className="h-4 w-4 mr-2" /> Remove Team Member
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
                      <Copy className="h-4 w-4 mr-2" /> Copy Text
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
                      <DropdownMenuItem
                        onClick={() => onStartDeleteSelection?.(post.id)}
                        className="text-red-600 dark:text-red-400 focus:text-red-600 border-t border-gray-100 dark:border-gray-700"
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {/* Quoted Message (WhatsApp style) */}
            {post.parent_id && !isDeletedMessage && (
              <div
                className="mb-1.5 p-2 bg-black/5 dark:bg-black/10 rounded border-l-[3px] border-emerald-500 cursor-pointer hover:bg-black/10 transition-colors overflow-hidden"
                onClick={() => onScrollToMessage?.(post.parent_id!)}
              >
                <p className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 uppercase tracking-tight">
                  {allPosts.find((p) => p.id === post.parent_id)?.author_name ||
                    "Original Message"}
                </p>
                <p className="text-[11px] text-gray-500 truncate mt-0.5 whitespace-nowrap overflow-hidden">
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
                  className={`fixed z-[999] ${isAuthor ? "right-20" : "left-4"
                    } top-20 shadow-xl bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border border-white/20 rounded-xl shadow-2xl`}
                >
                  <button
                    onClick={() => setShowEmojiPicker(false)}
                    className="absolute top-1 right-2 h-4 w-4 bg-primary dark:bg-gray-800 rounded-full shadow-lg flex items-center justify-center text-white hover:text-white border border-gray-200 dark:border-gray-700 z-[1000] transition-all hover:scale-110 active:scale-95"
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
              <p className="text-[11px] font-bold text-emerald-600 mb-0.5">
                {post.author_name || "Unknown"}
              </p>
            )}

            {/* Message content */}
            <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words pr-6 text-gray-800 dark:text-gray-200">
              {isDeletedMessage ? (
                <span className="italic text-gray-500 dark:text-gray-400">
                  🚫 {deletedPlaceholder}
                </span>
              ) : (
                renderMessageWithMentions(post.content)
              )}
            </p>

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
                  className={`text-[9px] ${(post.seen_count || 0) > 0 ? "text-primary" : "text-gray-400"
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
          <button
            onClick={() => setShowReactionsDialog(true)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200 transition-colors"
            title="Open reactions"
          >
            <Smile className="h-3 w-3" />
            <span>{totalReactionCount}</span>
          </button>
          {reactionEntries.map(([emoji, users]) => {
            const isActive = users.includes(currentUserId || "");
            return (
              <button
                key={emoji}
                onClick={() => setShowReactionsDialog(true)}
                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-medium shadow-sm transition-all ${isActive
                  ? "bg-blue-100 border border-blue-300 text-blue-700"
                  : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50"
                  }`}
              >
                <span>{emoji}</span>
                <span>{users.length}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Small reactions dialog for this message */}
      {!isDeletedMessage && showReactionsDialog && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/25 px-4">
          <div className="w-full max-w-xs rounded-xl border border-gray-200 bg-white p-3 shadow-2xl dark:border-gray-700 dark:bg-gray-900">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                Message Reactions ({totalReactionCount})
              </p>
              <button
                onClick={() => setShowReactionsDialog(false)}
                className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
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
                      : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
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
              {reactionEntries.map(([emoji, users]) => (
                <div key={`names-${post.id}-${emoji}`} className="rounded-md bg-gray-50 px-2 py-1.5 dark:bg-gray-800">
                  <p className="mb-1 text-xs font-semibold text-gray-700 dark:text-gray-200">
                    {emoji} {users.length}
                  </p>
                  <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed">
                    {users.map((uid) => resolveUserName(uid)).join(", ")}
                  </p>
                </div>
              ))}
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
                    className="rounded-full border border-gray-200 bg-white px-2 py-1 text-sm hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
