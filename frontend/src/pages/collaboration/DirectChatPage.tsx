import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, MessageCircle, Search, UserRound, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarUrl } from "@/lib/utils";
import WorkgroupDetailView from "@/components/workgroups/WorkgroupDetailView";
import { useWorkgroups } from "@/hooks/useWorkgroups";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtime } from "@/hooks/useRealtime";
import { workgroupsApi } from "@/lib/api";
import { toast } from "sonner";

export default function DirectChatPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    on: onRealtime,
    off: offRealtime,
    subscribeToWorkgroup,
    unsubscribeFromWorkgroup,
  } = useRealtime();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { data: workgroups = [], isLoading } = useWorkgroups();
  const { users: orgUsers = [] } = useAdminUsers();
  const [friendSearch, setFriendSearch] = useState("");
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [, setLastSeenTick] = useState(0);
  const selectedId = searchParams.get("chat");
  const searchBoxRef = useRef<HTMLDivElement>(null);

  const directChats = useMemo(
    () =>
      workgroups
        .filter(
          (wg) =>
            wg.type === "private" &&
            Boolean((wg.settings as any)?.is_direct_chat) &&
            Number(wg.message_count || 0) > 0,
        )
        .sort((a, b) => {
          const ta = new Date(
            a.last_message_at || a.updated_at || a.created_at,
          ).getTime();
          const tb = new Date(
            b.last_message_at || b.updated_at || b.created_at,
          ).getTime();
          return tb - ta;
        }),
    [workgroups],
  );

  const filteredFriends = useMemo(
    () => {
      const normalize = (value: string) =>
        value
          .toLowerCase()
          .replace(/[_-]+/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      const q = normalize(friendSearch);
      const qParts = q ? q.split(" ") : [];

      return orgUsers
        .filter((u) => u.id !== user?.id)
        .filter((u) => {
          if (!q) return true;
          const fullName = normalize(u.full_name || "");
          const email = normalize(u.email || "");
          const searchable = `${fullName} ${email}`.trim();
          return qParts.every((part) => searchable.includes(part));
        })
        .slice(0, 30);
    },
    [orgUsers, user?.id, friendSearch],
  );
  const dropdownUsers = useMemo(() => {
    return filteredFriends.slice(0, 50);
  }, [filteredFriends]);
  const openChat = (id: string) => {
    queryClient.setQueriesData(
      { queryKey: ["workgroups"] },
      (prev: any[] | undefined) => {
        if (!Array.isArray(prev)) return prev;
        return prev.map((wg) =>
          wg?.id === id
            ? {
                ...wg,
                unread_count: 0,
              }
            : wg,
        );
      },
    );
    const next = new URLSearchParams(searchParams);
    next.set("chat", id);
    setSearchParams(next);
  };

  const closeChat = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("chat");
    setSearchParams(next);
  };

  const openDirectChatWithUser = async (targetUserId: string) => {
    try {
      const direct = await workgroupsApi.openDirectChat(targetUserId);
      if (!direct?.id) return;
      openChat(direct.id);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Failed to open direct chat");
    }
  };

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!searchBoxRef.current) return;
      if (!searchBoxRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setLastSeenTick((prev) => prev + 1);
    }, 15000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const handlePresenceUpdate = (payload: {
      userId?: string;
      is_online?: boolean;
      last_seen_at?: string | null;
    }) => {
      if (!payload?.userId) return;
      queryClient.setQueriesData(
        { queryKey: ["workgroups"] },
        (prev: any[] | undefined) => {
          if (!Array.isArray(prev)) return prev;
          return prev.map((wg) =>
            wg?.direct_peer_user_id === payload.userId
              ? {
                  ...wg,
                  is_online: payload.is_online ?? wg.is_online,
                  last_seen_at:
                    payload.last_seen_at !== undefined
                      ? payload.last_seen_at
                      : wg.last_seen_at,
                }
              : wg,
          );
        },
      );
    };

    onRealtime("presence:update", handlePresenceUpdate);
    return () => {
      offRealtime("presence:update", handlePresenceUpdate);
    };
  }, [onRealtime, offRealtime, queryClient]);

  useEffect(() => {
    if (!selectedId) return;
    queryClient.setQueriesData(
      { queryKey: ["workgroups"] },
      (prev: any[] | undefined) => {
        if (!Array.isArray(prev)) return prev;
        return prev.map((wg) =>
          wg?.id === selectedId
            ? {
                ...wg,
                unread_count: 0,
              }
            : wg,
        );
      },
    );
  }, [selectedId, queryClient]);

  useEffect(() => {
    const handleWorkgroupPost = (payload: { workgroup_id?: string; user_id?: string }) => {
      if (!payload?.workgroup_id) return;
      let found = false;
      queryClient.setQueriesData(
        { queryKey: ["workgroups"] },
        (prev: any[] | undefined) => {
          if (!Array.isArray(prev)) return prev;
          return prev.map((wg) => {
            if (wg?.id !== payload.workgroup_id) return wg;
            found = true;
            if (payload.user_id === user?.id || selectedId === payload.workgroup_id) {
              return { ...wg, unread_count: 0 };
            }
            return {
              ...wg,
              unread_count: Number(wg.unread_count || 0) + 1,
            };
          });
        },
      );
      if (!found) {
        queryClient.invalidateQueries({ queryKey: ["workgroups"] });
      }
    };
    onRealtime("workgroup_post:new", handleWorkgroupPost);
    return () => {
      offRealtime("workgroup_post:new", handleWorkgroupPost);
    };
  }, [onRealtime, offRealtime, queryClient, selectedId, user?.id]);

  useEffect(() => {
    const chatIds = directChats.map((chat) => chat.id);
    chatIds.forEach((chatId) => subscribeToWorkgroup(chatId));
    return () => {
      chatIds.forEach((chatId) => unsubscribeFromWorkgroup(chatId));
    };
  }, [directChats, subscribeToWorkgroup, unsubscribeFromWorkgroup]);

  if (selectedId) {
    return <WorkgroupDetailView workgroupId={selectedId} onBack={closeChat} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5 mb-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Direct Chats
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Select a person and start one-to-one conversation
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate("/collaboration/workgroups")}
            >
             <ArrowLeft className="h-4 w-4" /> Back to Workgroups
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-5">
          <aside className="rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3">
            <p className="text-sm font-semibold mb-2 text-gray-900 dark:text-white">
              Friends
            </p>
            <div className="relative mb-4" ref={searchBoxRef}>
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                value={friendSearch}
                onChange={(e) => setFriendSearch(e.target.value)}
                onFocus={() => setShowSearchDropdown(true)}
                placeholder="Search chats or users..."
                className="pl-9"
              />
              {showSearchDropdown && (
                <div className="absolute top-11 left-0 z-30 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg max-h-64 overflow-y-auto">
                  {dropdownUsers.map((friend) => (
                    <button
                      key={`dropdown-user-${friend.id}`}
                      onClick={() => {
                        openDirectChatWithUser(friend.id);
                        setShowSearchDropdown(false);
                      }}
                      className="w-full px-2 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {friend.full_name || "Unknown"}
                      </p>
                    </button>
                  ))}
                  {dropdownUsers.length === 0 && (
                    <p className="px-2 py-2 text-xs text-gray-500 dark:text-gray-400">
                      No users found.
                    </p>
                  )}
                </div>
              )}
            </div>

            <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">
              Recent chats
            </p>
            <div className="space-y-1 max-h-[320px] overflow-y-auto">
              {directChats.map((chat) => {
                const isActive = selectedId === chat.id;
                const isOnline = Boolean(chat.is_online);
                const unreadCount = isActive ? 0 : Number(chat.unread_count || 0);
                const chatDisplayName = chat.display_name || chat.name;
                const lastSeenLabel =
                  !isOnline && chat.last_seen_at
                    ? formatDistanceToNow(new Date(chat.last_seen_at), {
                        addSuffix: true,
                      })
                    : null;
                return (
                  <button
                    key={`chat-${chat.id}`}
                    onClick={() => openChat(chat.id)}
                    className={`w-full rounded-md px-2 py-2 text-left transition-colors ${
                      isActive
                        ? "bg-primary text-white"
                        : "hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback
                            className={`${chat.avatar_color} text-white text-xs`}
                          >
                            {chatDisplayName.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span
                          className={`absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border border-white dark:border-gray-800 ${
                            isOnline ? "bg-green-500" : "bg-gray-400"
                          }`}
                          title={isOnline ? "Online" : "Offline"}
                        />
                      </div>
                      <div className="min-w-0">
                        <p
                          className={`text-sm font-medium truncate ${
                            isActive
                              ? "text-white"
                              : "text-gray-900 dark:text-white"
                          }`}
                        >
                          {chatDisplayName}
                        </p>
                        <p
                          className={`text-[11px] ${
                            isActive ? "text-white/90" : "text-gray-500 dark:text-gray-400"
                          }`}
                        >
                          <span>member </span>
                          <span
                            className={
                              isOnline
                                ? isActive
                                  ? "text-white"
                                  : "text-primary"
                                : "text-red-500"
                            }
                          >
                            {isOnline ? "Online" : "Offline"}
                          </span>
                        </p>
                        {lastSeenLabel && (
                          <p
                            className={`text-[11px] ${
                              isActive ? "text-white/90" : "text-gray-500 dark:text-gray-400"
                            }`}
                          >
                            Last seen {lastSeenLabel}
                          </p>
                        )}
                        {/* {unreadCount > 0 ? (
                          <p
                            className={`text-xs ${
                              isActive ? "text-white/90" : "text-primary"
                            }`}
                          >
                            {unreadCount} unread message{unreadCount > 1 ? "s" : ""}
                          </p>
                        ) : (
                          <p
                            className={`text-xs ${
                              isActive ? "text-white/90" : "text-gray-500 dark:text-gray-400"
                            }`}
                          >
                            No unread messages
                          </p>
                        )} */}
                      </div>
                      {unreadCount > 0 && (
                        <div className="ml-auto self-start">
                          <span
                            className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold ${
                              isActive
                                ? "bg-white/20 text-white"
                                : "bg-primary text-white"
                            }`}
                          >
                            {unreadCount}
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
              {directChats.length === 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 px-2 py-2">
                  No chats yet. Search a user and send first message.
                </p>
              )}
            </div>
          </aside>

          <section className="rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 min-h-[520px] flex items-center justify-center">
            {isLoading ? (
              <div className="text-center text-gray-500">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p>Loading direct chats...</p>
              </div>
            ) : (
              <div className="text-center px-6">
                <UserRound className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Choose a chat
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Sidebar se friend ya recent chat select karein.
                </p>
                <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 inline-flex items-center gap-2">
                  <Users className="h-3.5 w-3.5" />
                  {directChats.length} active direct chats
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
