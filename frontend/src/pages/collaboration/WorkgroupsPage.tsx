import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Users,
  Plus,
  MessageSquare,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Video,
  Phone,
  Calendar,
  Files,
  Bell,
  Hash,
  Lock,
  Building2,
  UserPlus,
  Star,
  ChevronDown,
  LayoutGrid,
  List,
  MessageCircle,
} from "lucide-react";
import {
  useWorkgroups,
  useCreateWorkgroup,
  useUpdateWorkgroup,
  useDeleteWorkgroup,
  useWorkgroupMembers,
  type WorkgroupMember,
  type Workgroup,
} from "@/hooks/useWorkgroups";
import WorkgroupDetailView from "@/components/workgroups/WorkgroupDetailView";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtime } from "@/hooks/useRealtime";
import { useAdminUsers } from "@/hooks/useAdminUsers";

const WORKGROUP_TYPES = [
  {
    value: "team" as const,
    label: "Team",
    icon: Users,
    description: "For project teams",
  },
  {
    value: "department" as const,
    label: "Department",
    icon: Building2,
    description: "For organization departments",
  },
  {
    value: "project" as const,
    label: "Project",
    icon: Hash,
    description: "For specific projects and initiatives",
  },
  {
    value: "private" as const,
    label: "Private",
    icon: Lock,
    description: "Private group with invite-only access",
  },
];

export default function WorkgroupsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    on: onRealtime,
    off: offRealtime,
    subscribeToWorkgroup,
    unsubscribeFromWorkgroup,
  } = useRealtime();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: workgroups = [], isLoading } = useWorkgroups();
  useAdminUsers();
  const createWg = useCreateWorkgroup();
  const updateWg = useUpdateWorkgroup();
  const deleteWg = useDeleteWorkgroup();

  const visibleWorkgroups = workgroups.filter((wg) => {
    // Defense-in-depth: never render private teams for non-members.
    const canAccessPrivate = !wg.is_private || Boolean(wg.is_member || wg.user_role);
    return canAccessPrivate;
  });

  const totalMembers = visibleWorkgroups.reduce(
    (sum, wg) => sum + Number(wg.member_count || 0),
    0,
  );
  const todayMessages = visibleWorkgroups.reduce(
    (sum, wg) => sum + Number(wg.today_message_count || 0),
    0,
  );

  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Workgroup | null>(null);
  const [manageMembersUserId, setManageMembersUserId] = useState<string>("none");
  const [deleteTarget, setDeleteTarget] = useState<Workgroup | null>(null);
  const selectedId = searchParams.get("team");
  const openWorkgroup = (id: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("team", id);
    setSearchParams(next);
  };
  const closeWorkgroup = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("team");
    setSearchParams(next);
  };

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filterType, setFilterType] = useState<
    "all" | "team" | "project" | "private" | "department"
  >("all");
  const [form, setForm] = useState<{
    name: string;
    description: string;
    avatar_color: string;
    type: "team" | "project" | "private" | "department";
    is_private: boolean;
  }>({
    name: "",
    description: "",
    avatar_color: "bg-blue-500",
    type: "team",
    is_private: false,
  });

  const { data: editingMembers = [] } = useWorkgroupMembers(editing?.id || "");
  const assignableMembers = (editingMembers as WorkgroupMember[]).filter(
    (m) => !["owner", "admin"].includes(m.role),
  );

  const teamOnlyWorkgroups = visibleWorkgroups.filter(
    (wg) => !((wg.type === "private") && Boolean((wg.settings as any)?.is_direct_chat)),
  );

  const filtered = teamOnlyWorkgroups
    .filter((w) => {
      const matchesSearch = w.name.toLowerCase().includes(search.toLowerCase());
      const matchesType = filterType === "all" || w.type === filterType;
      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      const timeA = new Date(a.last_message_at || a.updated_at || a.created_at).getTime();
      const timeB = new Date(b.last_message_at || b.updated_at || b.created_at).getTime();
      return timeB - timeA;
    });

  const resetForm = () => {
    setForm({
      name: "",
      description: "",
      avatar_color: "bg-blue-500",
      type: "team",
      is_private: false,
    });
  };

  const openEdit = (wg: Workgroup) => {
    const canEditOrDelete =
      wg.user_role === "owner" || wg.created_by === user?.id;
    if (!canEditOrDelete) return;

    setForm({
      name: wg.name,
      description: wg.description || "",
      avatar_color: wg.avatar_color,
      type: wg.type,
      is_private: wg.is_private,
    });
    setManageMembersUserId(
      (wg.settings?.member_manager_user_id as string) || "none",
    );
    setEditing(wg);
  };

  useEffect(() => {
    const handleWorkgroupUpdated = (payload: {
      action?: "created" | "updated" | "deleted";
      workgroup_id?: string;
      workgroup?: Partial<Workgroup> & { id?: string };
    }) => {
      const targetId = payload?.workgroup?.id || payload?.workgroup_id;

      if (targetId && payload?.action !== "created") {
        queryClient.setQueriesData(
          { queryKey: ["workgroups"] },
          (prev: Workgroup[] | undefined) => {
            if (!Array.isArray(prev)) return prev;
            if (payload?.action === "deleted") {
              return prev.filter((wg) => wg.id !== targetId);
            }
            return prev.map((wg) =>
              wg.id === targetId ? { ...wg, ...(payload.workgroup || {}) } : wg,
            );
          },
        );
      }

      // Keep both admin/super_admin views in sync without manual refresh.
      queryClient.invalidateQueries({ queryKey: ["workgroups"] });
      if (selectedId && (!targetId || targetId === selectedId)) {
        queryClient.invalidateQueries({ queryKey: ["workgroup", selectedId] });
      }
    };

    onRealtime("workgroup:updated", handleWorkgroupUpdated);
    onRealtime("connect", handleWorkgroupUpdated);
    return () => {
      offRealtime("workgroup:updated", handleWorkgroupUpdated);
      offRealtime("connect", handleWorkgroupUpdated);
    };
  }, [onRealtime, offRealtime, queryClient, selectedId]);

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
            // Do not increase count for own message or currently opened room.
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
    const ids = visibleWorkgroups.map((wg) => wg.id);
    ids.forEach((id) => subscribeToWorkgroup(id));
    return () => {
      ids.forEach((id) => unsubscribeFromWorkgroup(id));
    };
  }, [visibleWorkgroups, subscribeToWorkgroup, unsubscribeFromWorkgroup]);

  useEffect(() => {
    if (!editing) return;
    if (manageMembersUserId === "none") return;
    const exists = assignableMembers.some((m) => m.user_id === manageMembersUserId);
    if (!exists) {
      setManageMembersUserId("none");
    }
  }, [editing, assignableMembers, manageMembersUserId]);

  const handleCreate = () => {
    createWg.mutate(
      {
        name: form.name,
        description: form.description,
        avatar_color: form.avatar_color,
        type: form.type,
        is_private: form.is_private,
      },
      {
        onSuccess: () => {
          setShowCreate(false);
          resetForm();
          toast.success(`Team "${form.name}" created successfully!`);
        },
      },
    );
  };

  const handleUpdate = () => {
    if (!editing) return;
    updateWg.mutate(
      {
        id: editing.id,
        name: form.name,
        description: form.description,
        avatar_color: form.avatar_color,
        type: form.type,
        is_private: form.is_private,
        manage_member_user_id:
          manageMembersUserId === "none" ? null : manageMembersUserId,
      },
      {
        onSuccess: () => {
          setEditing(null);
          setManageMembersUserId("none");
          resetForm();
          toast.success(`Team "${form.name}" updated successfully!`);
        },
      },
    );
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteWg.mutate(deleteTarget.id, {
      onSuccess: () => {
        setDeleteTarget(null);
        toast.success(`Team "${deleteTarget.name}" deleted successfully!`);
      },
    });
  };

  const getWorkgroupTypeIcon = (type: string) => {
    const typeConfig = WORKGROUP_TYPES.find((t) => t.value === type);
    return typeConfig ? typeConfig.icon : Users;
  };

  const getWorkgroupTypeLabel = (type: string) => {
    const typeConfig = WORKGROUP_TYPES.find((t) => t.value === type);
    return typeConfig ? typeConfig.label : "Team";
  };

  if (selectedId) {
    return (
      <WorkgroupDetailView
        workgroupId={selectedId}
        onBack={closeWorkgroup}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Microsoft Teams Style Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                  Teams & Workgroups
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Microsoft Teams-style collaboration platform for your
                  organization
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => {
                  resetForm();
                  setShowCreate(true);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
              >
                <Plus className="h-4 w-4" />
                Create Team
              </Button>
            </div>
          </div>

          {/* Stats Cards - Teams Style */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-700 dark:text-blue-300 text-sm font-medium">
                    Total Teams
                  </p>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                    {visibleWorkgroups.length}
                  </p>
                </div>
                <Users className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-700 dark:text-green-300 text-sm font-medium">
                    Active Now
                  </p>
                  <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                    {filtered.filter((wg) => (wg.id.charCodeAt(0) + wg.id.charCodeAt(wg.id.length - 1)) % 3 === 0).length}
                  </p>
                </div>
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                </div>
              </div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-700 dark:text-purple-300 text-sm font-medium">
                    Messages Today
                  </p>
                  <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                    {todayMessages}
                  </p>
                </div>
                <MessageSquare className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-700 dark:text-orange-300 text-sm font-medium">
                    Total Members
                  </p>
                  <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                    {totalMembers}
                  </p>
                </div>
                <UserPlus className="h-8 w-8 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters - Teams Style */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search teams, projects, and conversations..."
                className="pl-10 bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => navigate("/collaboration/direct-chats")}
                className="gap-2 bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600"
              >
                Direct Chats
              </Button>
              </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="gap-2 bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600"
                >
                  <Hash className="h-4 w-4" />
                  {filterType === "all"
                    ? "All Types"
                    : getWorkgroupTypeLabel(filterType)}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setFilterType("all")}>
                  All Types
                </DropdownMenuItem>
                {WORKGROUP_TYPES.map((type) => (
                  <DropdownMenuItem
                    key={type.value}
                    onClick={() => setFilterType(type.value)}
                  >
                    <type.icon className="h-4 w-4 mr-2" />
                    {type.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="flex items-center bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-1">
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("grid")}
                className={`rounded-md ${viewMode === "grid" ? "bg-blue-600 text-white shadow-sm" : ""}`}
              >
                <LayoutGrid className="h-4 w-4 mr-2" />
                Grid
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
                className={`rounded-md ${viewMode === "list" ? "bg-blue-600 text-white shadow-sm" : ""}`}
              >
                <List className="h-4 w-4 mr-2" />
                List
              </Button>
            </div>
          </div>
        </div>

        <div>
          <div className="flex-1">
            {/* Teams Grid - Microsoft Teams Style */}
            {isLoading ? (
              <div className="text-center py-12 text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-40 animate-pulse" />
                <p>Loading teams...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
                <Users className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  No teams found
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  {search
                    ? `No teams match "${search}"`
                    : "Create your first team to start collaborating with your colleagues."}
                </p>
                {!search && (
                  <Button
                    onClick={() => {
                      resetForm();
                      setShowCreate(true);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
                  >
                    <Plus className="h-4 w-4" /> Create Your First Team
                  </Button>
                )}
              </div>
            ) : (
              <div
                className={
                  viewMode === "grid"
                    ? "grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3"
                    : "space-y-3"
                }
              >
            {filtered.map((wg) => {
              const TypeIcon = getWorkgroupTypeIcon(wg.type || "team");
              const memberCount = Number(wg.member_count || 0);
              const postCount = Number(wg.message_count || 0);
              const unreadCount =
                selectedId === wg.id ? 0 : Number(wg.unread_count || 0);
              const hasActivity = (wg.id.charCodeAt(0) + wg.id.charCodeAt(wg.id.length - 1)) % 3 === 0;
              const canEditOrDelete =
                wg.user_role === "owner" || wg.created_by === user?.id;

              return (
                <div
                  key={wg.id}
                  className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all cursor-pointer group relative ${
                    viewMode === "list" ? "flex items-center p-4" : "p-4"
                  } ${hasActivity ? "ring-2 ring-blue-200 dark:ring-blue-800" : ""}`}
                  onClick={() => openWorkgroup(wg.id)}
                >
                  {hasActivity && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse border-2 border-white dark:border-gray-800" />
                  )}

                  <div
                    className={`flex ${viewMode === "list" ? "items-center gap-3 flex-1" : "flex-col items-center gap-3 w-full"}`}
                  >
                    <div className="relative flex-shrink-0 pt-2">
                      <Avatar
                        className={
                          viewMode === "list"
                            ? "h-12 w-12"
                            : "h-16 w-16 shadow-sm"
                        }
                      >
                        <AvatarFallback
                          className={`${wg.avatar_color} text-white font-semibold ${viewMode === "list" ? "text-lg" : "text-xl"}`}
                        >
                          {wg.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute bottom-0 right-0 w-6 h-6 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center border border-gray-200 dark:border-gray-600">
                        <TypeIcon className="h-3.5 w-3.5 text-gray-600 dark:text-gray-400" />
                      </div>
                    </div>

                    <div
                      className={`flex-1 min-w-0 overflow-hidden ${viewMode === "grid" ? "flex flex-col items-center w-full px-2" : ""}`}
                    >
                      <div
                        className={`flex items-center gap-2 mb-1 w-full ${viewMode === "grid" ? "justify-center" : ""}`}
                      >
                        <h3 
                          className={`font-semibold text-primary dark:text-blue-400 truncate hover:text-blue-700 dark:hover:text-blue-300 transition-colors ${viewMode === "grid" ? "text-center" : ""}`}
                          title={wg.name}
                        >
                          {wg.name}
                        </h3>
                        {wg.is_private && (
                          <Lock className="h-4 w-4 text-gray-500 shrink-0" />
                        )}
                        {hasActivity && (
                          <Star className="h-4 w-4 text-yellow-500 fill-current shrink-0" />
                        )}
                        {unreadCount > 0 && (
                          <Badge className="bg-red-600 bg-primary text-white text-[10px] px-2 py-0.5">
                            <MessageCircle className="h-3 w-3 mr-1" />
                            {unreadCount}
                          </Badge>
                        )}
                      </div>
                      {wg.last_message_sender_name && (
                        <p
                          className={`text-xs text-primary mb-1 ${viewMode === "grid" ? "text-center" : ""}`}
                        >
                          Last sender: {wg.last_message_sender_name}
                        </p>
                      )}
                      {wg.description && (
                        <p
                          className={`text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2 ${viewMode === "grid" ? "text-center px-2" : "line-clamp-1"}`}
                        >
                          {wg.description}
                        </p>
                      )}
                      <div
                        className={`flex items-center flex-wrap gap-x-3 gap-y-1 text-sm text-gray-500 dark:text-gray-400 mt-1 ${viewMode === "grid" ? "justify-center" : ""}`}
                      >
                        <div className="flex items-center gap-1 shrink-0">
                          <Users className="h-3.5 w-3.5" />
                          <span>{memberCount} members</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <MessageSquare className="h-3.5 w-3.5" />
                          <span>{postCount} messages</span>
                        </div>
                      </div>
                      <div
                        className={`flex items-center flex-wrap gap-2 mt-3 ${viewMode === "grid" ? "justify-center" : ""}`}
                      >
                        <Badge
                          variant="secondary"
                          className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                        >
                          {getWorkgroupTypeLabel(wg.type || "team")}
                        </Badge>
                        {hasActivity && (
                          <Badge
                            variant="outline"
                            className="text-xs text-green-600 dark:text-green-400 border-green-200 dark:border-green-800"
                          >
                            Active now
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div
                      className={`mt-4 pt-3 flex items-center justify-between border-t border-gray-100 dark:border-gray-700 w-full ${viewMode === "list" ? "mt-0 pt-0 pl-4 border-t-0 border-l justify-end w-auto" : ""}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openWorkgroup(wg.id)}
                        className="h-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 flex-1"
                      >
                        <MessageSquare className="h-3.5 w-3.5 mr-1" /> Open
                      </Button>
                      {canEditOrDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(wg)}
                          className="h-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 flex-1"
                        >
                          <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                        </Button>
                      )}
                      {canEditOrDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(wg)}
                          className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 flex-1"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
              })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Simple Create / Edit Dialog */}
      <Dialog
        open={showCreate || !!editing}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreate(false);
            setEditing(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {editing ? `Edit ${getWorkgroupTypeLabel(form.type)}` : `Create New ${getWorkgroupTypeLabel(form.type)}`}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? `Update your ${getWorkgroupTypeLabel(form.type).toLowerCase()} details.`
                : `Create a new ${getWorkgroupTypeLabel(form.type).toLowerCase()} workspace for collaboration.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Team Name */}
            <div className="space-y-2">
              <Label htmlFor="name">{getWorkgroupTypeLabel(form.type)} Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => {
                  const val = e.target.value;
                  const capitalized =
                    val.charAt(0).toUpperCase() + val.slice(1);
                  setForm({ ...form, name: capitalized });
                }}
                placeholder={`e.g., Sales ${getWorkgroupTypeLabel(form.type)}, Marketing Project`}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                rows={2}
                placeholder={`What is this ${getWorkgroupTypeLabel(form.type).toLowerCase()} for?`}
              />
            </div>

            {/* Team Type - Simple Radio Buttons */}
            <div className="space-y-2">
              <Label>Team Type</Label>
              <div className="flex gap-4">
                {WORKGROUP_TYPES.map((type) => (
                  <div key={type.value} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id={type.value}
                      name="type"
                      value={type.value}
                      checked={form.type === type.value}
                      onChange={(e) => {
                        const selectedType = e.target.value as
                          | "team"
                          | "project"
                          | "private"
                          | "department";
                        setForm({
                          ...form,
                          type: selectedType,
                          // Keep privacy behavior strict with type selection.
                          is_private: selectedType === "private",
                        });
                      }}
                      className="w-4 h-4 text-blue-600"
                    />
                    <Label
                      htmlFor={type.value}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {type.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {editing && (
              <div className="space-y-2">
                <Label htmlFor="assign-member-manager">
                  Assign Member Management Permission
                </Label>
                <select
                  id="assign-member-manager"
                  value={manageMembersUserId}
                  onChange={(e) => setManageMembersUserId(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="none">None (only owner/admin can add/remove)</option>
                  {assignableMembers.map((member) => (
                    <option key={member.user_id} value={member.user_id}>
                      {(member.full_name || "Unknown").trim()} - {member.email}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Selected member can add/remove team members, but cannot delete team and role stays unchanged.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreate(false);
                setEditing(null);
                setManageMembersUserId("none");
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={editing ? handleUpdate : handleCreate}
              disabled={
                !form.name.trim() || createWg.isPending || updateWg.isPending
              }
              className="gap-2"
            >
              {createWg.isPending || updateWg.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {editing ? "Updating..." : "Creating..."}
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  {editing ? `Update ${getWorkgroupTypeLabel(form.type)}` : `Create ${getWorkgroupTypeLabel(form.type)}`}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the team, all its posts, and member
              associations. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
