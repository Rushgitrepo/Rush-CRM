import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Edit,
  Trash2,
  Hash,
  Lock,
  Building2,
  MessageCircle,
  LayoutGrid,
  List,
  Camera,
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
import { PageHeader } from "@/components/crm/ui/PageHeader";
import { DataToolbar } from "@/components/crm/ui/DataToolbar";
import { EmptyState } from "@/components/crm/ui/EmptyState";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtime } from "@/hooks/useRealtime";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { workgroupsApi } from "@/lib/api";
import { getAvatarUrl } from "@/lib/utils";

const WORKGROUP_TYPES = [
  { value: "team" as const, label: "Team", icon: Users },
  { value: "department" as const, label: "Department", icon: Building2 },
  { value: "project" as const, label: "Project", icon: Hash },
  { value: "private" as const, label: "Private", icon: Lock },
];

const TYPE_COLORS: Record<string, string> = {
  team: "bg-blue-100 text-blue-700 border-blue-200",
  department: "bg-purple-100 text-purple-700 border-purple-200",
  project: "bg-amber-100 text-amber-700 border-amber-200",
  private: "bg-rose-100 text-rose-700 border-rose-200",
};

export default function WorkgroupsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { on: onRealtime, off: offRealtime, subscribeToWorkgroup, unsubscribeFromWorkgroup } = useRealtime();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: workgroups = [], isLoading } = useWorkgroups();
  useAdminUsers();
  const createWg = useCreateWorkgroup();
  const updateWg = useUpdateWorkgroup();
  const deleteWg = useDeleteWorkgroup();

  const visibleWorkgroups = workgroups.filter((wg) =>
    !wg.is_private || Boolean(wg.is_member || wg.user_role)
  );

  const teamOnlyWorkgroups = visibleWorkgroups.filter(
    (wg) => !((wg.type === "private") && Boolean((wg.settings as any)?.is_direct_chat))
  );

  const totalMembers = teamOnlyWorkgroups.reduce((sum, wg) => sum + Number(wg.member_count || 0), 0);
  const todayMessages = teamOnlyWorkgroups.reduce((sum, wg) => sum + Number(wg.today_message_count || 0), 0);
  const unreadTeams = teamOnlyWorkgroups.filter((wg) => Number(wg.unread_count || 0) > 0).length;

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Workgroup | null>(null);
  const [manageMembersUserId, setManageMembersUserId] = useState<string>("none");
  const [deleteTarget, setDeleteTarget] = useState<Workgroup | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

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

  const [form, setForm] = useState({
    name: "",
    description: "",
    avatar_color: "bg-blue-500",
    type: "team" as "team" | "project" | "private" | "department",
    is_private: false,
  });

  const { data: editingMembers = [] } = useWorkgroupMembers(editing?.id || "");
  const assignableMembers = (editingMembers as WorkgroupMember[]).filter(
    (m) => !["owner", "admin"].includes(m.role)
  );

  const filtered = teamOnlyWorkgroups
    .filter((w) => {
      const matchesSearch =
        w.name.toLowerCase().includes(search.toLowerCase()) ||
        (w.description || "").toLowerCase().includes(search.toLowerCase());
      const matchesType = filterType === "all" || w.type === filterType;
      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "members") return Number(b.member_count || 0) - Number(a.member_count || 0);
      return new Date(b.last_message_at || b.updated_at || b.created_at).getTime() -
        new Date(a.last_message_at || a.updated_at || a.created_at).getTime();
    });

  const resetForm = () => {
    setForm({ name: "", description: "", avatar_color: "bg-blue-500", type: "team", is_private: false });
    setAvatarPreview(null);
    setAvatarFile(null);
  };

  const openEdit = (wg: Workgroup) => {
    if (wg.user_role !== "owner" && wg.created_by !== user?.id) return;
    setForm({ name: wg.name, description: wg.description || "", avatar_color: wg.avatar_color, type: wg.type, is_private: wg.is_private });
    setManageMembersUserId((wg.settings?.member_manager_user_id as string) || "none");
    setAvatarPreview(wg.avatar_url ? getAvatarUrl(wg.avatar_url) || null : null);
    setAvatarFile(null);
    setEditing(wg);
  };

  // Realtime sync
  useEffect(() => {
    const handleWorkgroupUpdated = (payload: any) => {
      const targetId = payload?.workgroup?.id || payload?.workgroup_id;
      if (targetId && payload?.action !== "created") {
        queryClient.setQueriesData({ queryKey: ["workgroups"] }, (prev: Workgroup[] | undefined) => {
          if (!Array.isArray(prev)) return prev;
          if (payload?.action === "deleted") return prev.filter((wg) => wg.id !== targetId);
          return prev.map((wg) => wg.id === targetId ? { ...wg, ...(payload.workgroup || {}) } : wg);
        });
      }
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
    queryClient.setQueriesData({ queryKey: ["workgroups"] }, (prev: any[] | undefined) => {
      if (!Array.isArray(prev)) return prev;
      return prev.map((wg) => wg?.id === selectedId ? { ...wg, unread_count: 0 } : wg);
    });
  }, [selectedId, queryClient]);

  useEffect(() => {
    const handleWorkgroupPost = (payload: { workgroup_id?: string; user_id?: string }) => {
      if (!payload?.workgroup_id) return;
      let found = false;
      queryClient.setQueriesData({ queryKey: ["workgroups"] }, (prev: any[] | undefined) => {
        if (!Array.isArray(prev)) return prev;
        return prev.map((wg) => {
          if (wg?.id !== payload.workgroup_id) return wg;
          found = true;
          if (payload.user_id === user?.id || selectedId === payload.workgroup_id) return { ...wg, unread_count: 0 };
          return { ...wg, unread_count: Number(wg.unread_count || 0) + 1 };
        });
      });
      if (!found) queryClient.invalidateQueries({ queryKey: ["workgroups"] });
    };
    onRealtime("workgroup_post:new", handleWorkgroupPost);
    return () => offRealtime("workgroup_post:new", handleWorkgroupPost);
  }, [onRealtime, offRealtime, queryClient, selectedId, user?.id]);

  useEffect(() => {
    const ids = visibleWorkgroups.map((wg) => wg.id);
    ids.forEach((id) => subscribeToWorkgroup(id));
    return () => ids.forEach((id) => unsubscribeFromWorkgroup(id));
  }, [visibleWorkgroups, subscribeToWorkgroup, unsubscribeFromWorkgroup]);

  useEffect(() => {
    if (!editing || manageMembersUserId === "none") return;
    if (!assignableMembers.some((m) => m.user_id === manageMembersUserId)) setManageMembersUserId("none");
  }, [editing, assignableMembers, manageMembersUserId]);

  const handleCreate = () => {
    createWg.mutate(
      { name: form.name, description: form.description, avatar_color: form.avatar_color, type: form.type, is_private: form.is_private },
      {
        onSuccess: async (newWg: any) => {
          if (avatarFile && newWg?.id) {
            try { await workgroupsApi.uploadAvatar(newWg.id, avatarFile); queryClient.invalidateQueries({ queryKey: ["workgroups"] }); } catch {}
          }
          setShowCreate(false); resetForm(); toast.success(`"${form.name}" created!`);
        },
      }
    );
  };

  const handleUpdate = () => {
    if (!editing) return;
    updateWg.mutate(
      { id: editing.id, name: form.name, description: form.description, avatar_color: form.avatar_color, type: form.type, is_private: form.is_private, manage_member_user_id: manageMembersUserId === "none" ? null : manageMembersUserId },
      {
        onSuccess: async () => {
          if (avatarFile && editing?.id) {
            try { await workgroupsApi.uploadAvatar(editing.id, avatarFile); queryClient.invalidateQueries({ queryKey: ["workgroups"] }); } catch {}
          }
          setEditing(null); setManageMembersUserId("none"); resetForm(); toast.success(`"${form.name}" updated!`);
        },
      }
    );
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteWg.mutate(deleteTarget.id, {
      onSuccess: () => { setDeleteTarget(null); toast.success(`"${deleteTarget.name}" deleted!`); },
    });
  };

  const getTypeLabel = (type: string) => WORKGROUP_TYPES.find((t) => t.value === type)?.label ?? "Team";
  const getTypeIcon = (type: string) => WORKGROUP_TYPES.find((t) => t.value === type)?.icon ?? Users;

  if (selectedId) {
    return <WorkgroupDetailView workgroupId={selectedId} onBack={closeWorkgroup} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workgroups"
        description="Collaborate with your team in dedicated workspaces."
        meta={[
          { label: "Teams", value: teamOnlyWorkgroups.length, tone: "info" },
          { label: "Members", value: totalMembers, tone: "success" },
          { label: "Unread", value: unreadTeams, tone: unreadTeams > 0 ? "warning" : "default" },
          { label: "Messages Today", value: todayMessages, tone: "default" },
        ]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/collaboration/direct-chats")}>
              <MessageCircle className="h-4 w-4 mr-2" />
              Direct Chats
            </Button>
            <Button size="sm" className="bg-primary" onClick={() => { resetForm(); setShowCreate(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              New Team
            </Button>
          </div>
        }
      />

      <DataToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search teams and workgroups..."
        filters={[
          {
            label: "Type",
            value: filterType,
            onChange: setFilterType,
            options: [
              { label: "All Types", value: "all" },
              ...WORKGROUP_TYPES.map((t) => ({ label: t.label, value: t.value })),
            ],
          },
        ]}
        sortValue={sortBy}
        sortOptions={[
          { label: "Recent Activity", value: "recent" },
          { label: "Name (A–Z)", value: "name" },
          { label: "Team Size", value: "members" },
        ]}
        onSortChange={setSortBy}
        view={viewMode}
        viewOptions={[
          { id: "grid", label: "Grid", icon: <LayoutGrid className="h-4 w-4" /> },
          { id: "list", label: "List", icon: <List className="h-4 w-4" /> },
        ]}
        onViewChange={(v) => setViewMode(v as "grid" | "list")}
      />

      <Card className="border-0 shadow-card">
        <CardContent className="p-4 lg:p-6">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-40 rounded-xl bg-muted/40 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              title="No workgroups found"
              description={search ? `No teams match "${search}"` : "Create your first team to start collaborating."}
              actionLabel="Create Team"
              onAction={() => { resetForm(); setShowCreate(true); }}
              icon={<Users className="h-6 w-6" />}
            />
          ) : viewMode === "grid" ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((wg) => {
                const TypeIcon = getTypeIcon(wg.type);
                const unreadCount = selectedId === wg.id ? 0 : Number(wg.unread_count || 0);
                const canEditOrDelete = wg.user_role === "owner" || wg.created_by === user?.id;
                return (
                  <div
                    key={wg.id}
                    onClick={() => openWorkgroup(wg.id)}
                    className={`relative group flex flex-col rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md ${
                      unreadCount > 0
                        ? "bg-primary/10 border-primary shadow-sm shadow-primary/20 hover:border-primary"
                        : "bg-card border-border/60 hover:border-primary/40"
                    }`}
                  >
                    {unreadCount > 0 && (
                      <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-primary rounded-l-xl" />
                    )}
                    <div className="flex items-start justify-between mb-3">
                      <div className="relative">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={getAvatarUrl(wg.avatar_url) || undefined} />
                          <AvatarFallback className={`${wg.avatar_color} text-white font-bold text-base`}>
                            {wg.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-background rounded-full flex items-center justify-center border border-border">
                          <TypeIcon className="h-3 w-3 text-muted-foreground" />
                        </div>
                        {/* WhatsApp-style green dot on avatar */}
                        {unreadCount > 0 && (
                          <span className="absolute -top-1 -right-1 flex h-4 w-4">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                            <span className="relative inline-flex rounded-full h-4 w-4 bg-primary" />
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1" onClick={(e) => e.stopPropagation()}>
                        {unreadCount > 0 && (
                          <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] rounded-full bg-primary text-white text-xs font-bold px-1.5">
                            {unreadCount}
                          </span>
                        )}
                        <div className="flex items-center gap-1">
                          {canEditOrDelete && (
                            <>
                              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => openEdit(wg)}>
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive" onClick={() => setDeleteTarget(wg)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className={`font-bold truncate mb-0.5 ${unreadCount > 0 ? "text-primary" : "text-foreground"}`}>{wg.name}</h3>
                      {unreadCount > 0 && wg.last_message_sender_name ? (
                        <p className="text-xs font-semibold text-primary truncate mb-1">
                          💬 {wg.last_message_sender_name}: new message
                        </p>
                      ) : wg.description ? (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-1">{wg.description}</p>
                      ) : null}
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{wg.member_count || 0}</span>
                        <span className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" />{wg.message_count || 0}</span>
                      </div>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${unreadCount > 0 ? TYPE_COLORS[wg.type] || "" : TYPE_COLORS[wg.type] || ""}`}>
                        {getTypeLabel(wg.type)}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {filtered.map((wg) => {
                const TypeIcon = getTypeIcon(wg.type);
                const unreadCount = selectedId === wg.id ? 0 : Number(wg.unread_count || 0);
                const canEditOrDelete = wg.user_role === "owner" || wg.created_by === user?.id;
                return (
                  <div
                    key={wg.id}
                    onClick={() => openWorkgroup(wg.id)}
                    className={`group flex items-center gap-3 py-3 px-3 cursor-pointer rounded-lg transition-all border ${
                      unreadCount > 0
                        ? "bg-primary/10 border-primary/40 shadow-sm"
                        : "border-transparent hover:bg-muted/40"
                    }`}
                  >
                    {/* Avatar with ping dot */}
                    <div className="relative shrink-0">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={getAvatarUrl(wg.avatar_url) || undefined} />
                        <AvatarFallback className={`${wg.avatar_color} text-white font-bold text-sm`}>
                          {wg.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {unreadCount > 0 ? (
                        <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                          <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-primary" />
                        </span>
                      ) : (
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-background rounded-full flex items-center justify-center border border-border">
                          <TypeIcon className="h-2.5 w-2.5 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-bold text-sm truncate ${unreadCount > 0 ? "text-primary" : "text-foreground"}`}>{wg.name}</span>
                        {wg.is_private && <Lock className="h-3 w-3 text-muted-foreground shrink-0" />}
                      </div>
                      {unreadCount > 0 && wg.last_message_sender_name ? (
                        <p className="text-xs font-semibold text-primary truncate">💬 {wg.last_message_sender_name}: new message</p>
                      ) : (
                        <p className="text-xs text-muted-foreground truncate">{wg.description || `${wg.member_count || 0} members`}</p>
                      )}
                    </div>

                    {/* Right side */}
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      {unreadCount > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] rounded-full bg-primary text-white text-xs font-bold px-1.5">
                          {unreadCount}
                        </span>
                      )}
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 hidden sm:flex ${TYPE_COLORS[wg.type] || ""}`}>
                        {getTypeLabel(wg.type)}
                      </Badge>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        {canEditOrDelete && (
                          <>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(wg)}>
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(wg)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={showCreate || !!editing} onOpenChange={(open) => { if (!open) { setShowCreate(false); setEditing(null); setManageMembersUserId("none"); resetForm(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${getTypeLabel(form.type)}` : `Create New ${getTypeLabel(form.type)}`}</DialogTitle>
            <DialogDescription>
              {editing ? `Update your ${getTypeLabel(form.type).toLowerCase()} details.` : `Set up a new ${getTypeLabel(form.type).toLowerCase()} for your team.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Avatar Upload */}
            <div className="flex items-center gap-4">
              <div className="relative cursor-pointer group" onClick={() => avatarInputRef.current?.click()}>
                <Avatar className="h-16 w-16">
                  <AvatarImage src={avatarPreview || undefined} />
                  <AvatarFallback className={`${form.avatar_color} text-white font-bold text-lg`}>
                    {form.name ? form.name.slice(0, 2).toUpperCase() : <Camera className="h-5 w-5" />}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="h-5 w-5 text-white" />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Group Logo</p>
                <p className="text-xs text-muted-foreground mb-1">Click the avatar to upload an image</p>
                {avatarPreview && (
                  <button type="button" className="text-xs text-destructive hover:underline" onClick={() => { setAvatarPreview(null); setAvatarFile(null); }}>Remove</button>
                )}
              </div>
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setAvatarFile(file);
                setAvatarPreview(URL.createObjectURL(file));
              }} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => { const v = e.target.value; setForm({ ...form, name: v.charAt(0).toUpperCase() + v.slice(1) }); }}
                placeholder={`e.g., Sales ${getTypeLabel(form.type)}`}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="What is this team for?" />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <div className="grid grid-cols-2 gap-2">
                {WORKGROUP_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setForm({ ...form, type: type.value, is_private: type.value === "private" })}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${form.type === type.value ? "border-primary bg-primary/10 text-primary font-medium" : "border-border/60 hover:bg-muted/40 text-muted-foreground"}`}
                  >
                    <type.icon className="h-4 w-4" />
                    {type.label}
                  </button>
                ))}
              </div>
            </div>
            {editing && (
              <div className="space-y-1.5">
                <Label htmlFor="assign-member-manager">Member Management Permission</Label>
                <select
                  id="assign-member-manager"
                  value={manageMembersUserId}
                  onChange={(e) => setManageMembersUserId(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="none">None — only owner/admin</option>
                  {assignableMembers.map((member) => (
                    <option key={member.user_id} value={member.user_id}>
                      {(member.full_name || "Unknown").trim()} — {member.email}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">Selected member can add/remove members but cannot delete the team.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); setEditing(null); setManageMembersUserId("none"); resetForm(); }}>Cancel</Button>
            <Button onClick={editing ? handleUpdate : handleCreate} disabled={!form.name.trim() || createWg.isPending || updateWg.isPending} className="bg-primary">
              {createWg.isPending || updateWg.isPending ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />{editing ? "Saving..." : "Creating..."}</>
              ) : (
                <><Plus className="h-4 w-4 mr-2" />{editing ? `Save Changes` : `Create ${getTypeLabel(form.type)}`}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the team, all its messages, and member associations. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
