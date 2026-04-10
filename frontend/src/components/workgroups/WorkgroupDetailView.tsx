import { useState, useRef, useEffect, useMemo } from "react";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  useWorkgroupMembers,
  useWorkgroupPosts,
  useAddWorkgroupMember,
  useRemoveWorkgroupMember,
  useCreatePost,
  useDeletePost,
  useTogglePinPost,
  type WorkgroupPost,
} from "@/hooks/useWorkgroups";
import { workgroupsApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useCustomDialog } from "@/contexts/DialogContext";
import { useWorkgroupRealtime } from "@/hooks/useRealtime";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  workgroupId: string;
  onBack: () => void;
}

export default function WorkgroupDetailView({ workgroupId, onBack }: Props) {
  const { user } = useAuth();
  const { prompt, confirm } = useCustomDialog();
  const { data: workgroup } = useWorkgroup(workgroupId);
  const { data: members = [], isLoading: membersLoading } =
    useWorkgroupMembers(workgroupId);
  const queryClient = useQueryClient();
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
  const togglePin = useTogglePinPost();

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

  const [activeTab, setActiveTab] = useState<
    "posts" | "files" | "wiki" | "settings"
  >("posts");
  const [newPost, setNewPost] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [showCreateWikiPage, setShowCreateWikiPage] = useState(false);
  const [newWikiPageTitle, setNewWikiPageTitle] = useState("");
  const [newWikiPageContent, setNewWikiPageContent] = useState("");
  const [showMembersList, setShowMembersList] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Auto-scroll to bottom on new posts
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [posts]);

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

  const isMember = members.some((m) => m.user_id === user?.id);
  const isGroupAdmin = members.some(
    (m) => m.user_id === user?.id && ["owner", "admin"].includes(m.role),
  );
  const memberUserIds = new Set(members.map((m) => m.user_id));
  const availableUsers = orgUsers.filter((u) => !memberUserIds.has(u.id));
  const handlePost = () => {
    if (!newPost.trim()) return;

    if (replyTo) {
      // Send as reply
      createPost.mutate(
        { workgroupId, content: newPost, parentId: replyTo },
        {
          onSuccess: () => {
            setNewPost("");
            setReplyTo(null);
          },
        },
      );
    } else {
      // Send as normal message
      createPost.mutate(
        { workgroupId, content: newPost },
        { onSuccess: () => setNewPost("") },
      );
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
    toast.success(`Starting video meeting for ${workgroup.name}...`);
    // Simulate opening meeting
    window.open(`https://meet.google.com/new`, "_blank");
  };

  const handleStartCall = () => {
    // In a real app, this would start an audio call
    toast.success(`Starting audio call for ${workgroup.name}...`);
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
                {workgroup.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-gray-900 dark:text-white truncate">
                {workgroup.name}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {members.length} members
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowMembersList(true)}>
                  <Users className="h-4 w-4 mr-2" /> Manage Members
                </DropdownMenuItem>
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
                <DropdownMenuItem>
                  <Settings className="h-4 w-4 mr-2" /> Team Settings
                </DropdownMenuItem>
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
              className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                activeTab === "posts"
                  ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                  : "hover:bg-gray-100 dark:hover:bg-gray-700"
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
              className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                activeTab === "files"
                  ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                  : "hover:bg-gray-100 dark:hover:bg-gray-700"
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
              className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                activeTab === "wiki"
                  ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                  : "hover:bg-gray-100 dark:hover:bg-gray-700"
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
        <div className="p-4 flex-1">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Members ({members.length})
            </h3>
            {isGroupAdmin && (
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
          {isGroupAdmin && (
            <div className="mb-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAddMember(true)}
                className="w-full gap-2 border-dashed border-blue-300 text-blue-600 hover:bg-blue-50"
              >
                <UserPlus className="h-4 w-4" />
                Add Team Member
              </Button>
            </div>
          )}

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {members.slice(0, 8).map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs">
                    {(member.full_name || "?").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {member.full_name || member.email || "Unknown"}
                  </p>
                  <div className="flex items-center gap-1">
                    {member.role === "owner" && (
                      <Crown className="h-3 w-3 text-yellow-500" />
                    )}
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {member.role}
                    </span>
                  </div>
                </div>
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              </div>
            ))}
            {members.length > 8 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-blue-600 hover:text-blue-700"
                onClick={() => setShowMembersList(true)}
              >
                +{members.length - 8} more members
              </Button>
            )}
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
                      Start a conversation
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                      Be the first to share something with your team!
                    </p>
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
                          isGroupAdmin={isGroupAdmin}
                          isMember={isMember}
                          currentUserId={user?.id}
                          onSetReplyTo={setReplyTo}
                          onScrollToMessage={scrollToMessage}
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
              {isMember && (
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
                      <div className="flex-1 relative">
                        <Input
                          value={newPost}
                          onChange={(e) => setNewPost(e.target.value)}
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
                        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-400 hover:text-blue-500 hover:bg-transparent"
                          >
                            <Smile className="h-5 w-5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-400 hover:text-blue-500 hover:bg-transparent"
                          >
                            <Paperclip className="h-5 w-5" />
                          </Button>
                          <button
                            onClick={handlePost}
                            disabled={!newPost.trim() || createPost.isPending}
                            className={`h-8 w-8 flex items-center justify-center rounded-full transition-all ${
                              newPost.trim()
                                ? "bg-blue-600 text-white shadow-md hover:scale-105 active:scale-95"
                                : "bg-gray-200 text-gray-400 dark:bg-gray-700 pointer-events-none"
                            }`}
                          >
                            <Send className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
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
                                link.href = `/api/workgroups/${workgroupId}/files/${file.id}/download`;
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
                    <SelectContent>
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
                  className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <Avatar className="h-10 w-10">
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
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        member.role === "owner" ? "default" : "secondary"
                      }
                      className="gap-1"
                    >
                      {member.role === "owner" && <Crown className="h-3 w-3" />}
                      {member.role}
                    </Badge>
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    {isGroupAdmin &&
                      member.user_id !== user?.id &&
                      member.role !== "owner" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() =>
                            removeMember.mutate({
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
            {isGroupAdmin && (
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
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    notification.is_read
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
  onSetReplyTo: (id: string | null) => void;
  onDelete: (postId: string) => void;
  onTogglePin: (postId: string, isPinned: boolean) => void;
  onReaction?: (postId: string, emoji: string) => void;
  onScrollToMessage?: (id: string) => void;
}

function PostCard({
  post,
  allPosts,
  workgroupId,
  isGroupAdmin,
  isMember,
  currentUserId,
  onSetReplyTo,
  onDelete,
  onTogglePin,
  onReaction,
  onScrollToMessage,
}: PostCardProps) {
  const isAuthor = post.user_id === currentUserId;
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const reactions: Record<string, string[]> = post.reactions || {};

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

  const timeString = post.created_at
    ? new Date(post.created_at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

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

          {/* The Actual Bubble */}
          <div
            className={`relative min-w-[85px] order-1 ${
              isAuthor
                ? "bg-[#d9fdd3] text-gray-800 rounded-2xl rounded-tr-sm"
                : "bg-white text-gray-800 rounded-2xl rounded-tl-sm shadow-sm"
            } px-3 py-2 shadow-sm group/bubble border border-black/5`}
          >
            {/* Dropdown Chevron - Inside Bubble top-right */}
            <div
              className={`absolute top-1 right-1 z-10 opacity-0 group-hover/bubble:opacity-100 transition-opacity`}
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="text-gray-400 hover:text-gray-600 transition-colors p-0.5 rounded">
                    <ChevronDown className="h-4 w-4" />
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
                  <DropdownMenuItem
                    onClick={() => {
                      navigator.clipboard.writeText(post.content);
                      toast.success("Message copied — ready to forward!");
                    }}
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
                  {(isAuthor || isGroupAdmin) && (
                    <DropdownMenuItem
                      onClick={() => onDelete(post.id)}
                      className="text-red-600 dark:text-red-400 focus:text-red-600 border-t border-gray-100 dark:border-gray-700"
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Quoted Message (WhatsApp style) */}
            {post.parent_id && (
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
            {showEmojiPicker &&
              createPortal(
                <div
                  ref={emojiPickerRef}
                  className={`fixed z-[999] ${
                    isAuthor ? "right-20" : "left-4"
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
              {post.content}
            </p>

            {/* Time + read status */}
            <div className="flex items-center gap-1 justify-end mt-1 -mr-1">
              <span className="text-[9px] text-gray-400 font-medium uppercase">
                {timeString}
              </span>
              {isAuthor && <span className="text-[9px] text-blue-500">✓✓</span>}
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
      {Object.keys(reactions).length > 0 && (
        <div
          className={`flex flex-wrap gap-1 mt-0.5 mb-1 ${isAuthor ? "justify-end mr-9" : "justify-start ml-9"}`}
        >
          {Object.entries(reactions).map(([emoji, users]) => {
            const isActive = users.includes(currentUserId || "");
            return (
              <button
                key={emoji}
                onClick={() => handleEmojiClick(emoji)}
                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-medium shadow-sm transition-all ${
                  isActive
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
    </div>
  );
}
