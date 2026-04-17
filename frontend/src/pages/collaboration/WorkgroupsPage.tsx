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
  MoreVertical,
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
  ChevronRight,
  LayoutGrid,
  List,
  MessageCircle,
  Activity,
  Globe,
  Shield,
  ArrowUpAZ,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
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

// Helper to adjust color brightness (used for gradients)
const adjustColor = (color: string, amount: number) => {
  return '#' + color.replace(/^#/, '').replace(/../g, color => ('0' + Math.min(255, Math.max(0, parseInt(color, 16) + amount)).toString(16)).slice(-2));
};

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
  const [sortBy, setSortBy] = useState<"name" | "members">("name");
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
    .filter((wg) => {
      const matchesSearch =
        wg.name.toLowerCase().includes(search.toLowerCase()) ||
        (wg.description || "").toLowerCase().includes(search.toLowerCase());
      const matchesType = filterType === "all" || wg.type === filterType;
      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      if (sortBy === "name") {
        return a.name.localeCompare(b.name);
      } else {
        return Number(b.member_count || 0) - Number(a.member_count || 0);
      }
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
    <div className="flex h-screen bg-background text-foreground overflow-hidden selection:bg-primary/10">
      {/* Sidebar - Workspace Navigation */}
      <aside className="w-80 border-r border-border/50 bg-muted/20 flex flex-col hidden lg:flex">
        <div className="p-8 pb-4">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-black tracking-tighter text-foreground/90 uppercase">Workspaces</h2>
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          
          <nav className="space-y-1">
            {[
              { id: 'all', label: 'All Workspaces', icon: Globe },
              { id: 'team', label: 'Teams', icon: Users },
              { id: 'project', label: 'Projects', icon: LayoutGrid },
              { id: 'department', label: 'Departments', icon: Shield },
              { id: 'private', label: 'Private', icon: Lock },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setFilterType(item.id as any)}
                className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold transition-all duration-300 group ${
                  filterType === item.id 
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.icon className={`w-5 h-5 transition-transform duration-500 ${filterType === item.id ? "" : "group-hover:rotate-12"}`} />
                {item.label}
                {item.id === 'all' && filtered.filter(w => (w.unread_count || 0) > 0).length > 0 && (
                  <span className="ml-auto flex h-2 w-2 rounded-full bg-primary animate-pulse" />
                )}
              </button>
            ))}
          </nav>

          <div className="mt-10">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 px-5 mb-4">Communications</h3>
            <button
              onClick={() => navigate("/collaboration/direct-chats")}
              className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition-all group"
            >
              <div className="w-8 h-8 rounded-xl bg-muted group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                <MessageCircle className="w-4 h-4 group-hover:text-primary transition-colors" />
              </div>
              Direct Messages
              <span className="ml-auto flex items-center justify-center w-5 h-5 rounded-lg bg-muted text-[10px] font-black">12</span>
            </button>
          </div>
        </div>

        <div className="mt-auto p-8 border-t border-border/40 bg-gradient-to-t from-muted/30 to-transparent">
          <div className="bg-card rounded-3xl p-6 border border-border/40 shadow-xl shadow-muted/10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-30 transition-opacity">
              <Users className="w-12 h-12" />
            </div>
            <h4 className="font-black text-sm uppercase tracking-widest text-muted-foreground mb-4">Enterprise Stats</h4>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground/80">Active Users</span>
                <span className="text-sm font-black">{totalMembers}</span>
              </div>
              <div className="flex items-center justify-between text-primary">
                <span className="text-xs font-bold">Unread Activity</span>
                <span className="text-sm font-black">{filtered.filter(w => (w.unread_count || 0) > 0).length}</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-background relative">
        {/* Floating Header */}
        <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-2xl border-b border-border/40 px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="lg:hidden">
              <Users className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-3">
                {filterType === 'all' ? "Collaborative Hub" : getWorkgroupTypeLabel(filterType)}
                <Badge variant="outline" className="text-[10px] uppercase font-black tracking-[0.2em] rounded-full border-primary/20 bg-primary/5 text-primary">
                  {filtered.length} active
                </Badge>
              </h1>
              <p className="text-sm text-muted-foreground font-medium">Global communication and shared resources.</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
             <div className="hidden sm:flex items-center bg-muted/50 p-1 rounded-xl border border-border/40">
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  onClick={() => setViewMode("grid")}
                  className={`h-10 w-10 p-0 rounded-lg transition-all ${viewMode === "grid" ? "bg-background shadow-md text-primary" : "text-muted-foreground"}`}
                >
                  <LayoutGrid className="w-5 h-5" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  onClick={() => setViewMode("list")}
                  className={`h-10 w-10 p-0 rounded-lg transition-all ${viewMode === "list" ? "bg-background shadow-md text-primary" : "text-muted-foreground"}`}
                >
                  <List className="w-5 h-5" />
                </Button>
              </div>
              <Button 
                onClick={() => { resetForm(); setShowCreate(true); }}
                className="rounded-2xl px-8 h-12 shadow-2xl shadow-primary/25 hover:shadow-primary/40 transition-all duration-500 bg-primary hover:bg-primary/90 text-primary-foreground font-black tracking-tight"
              >
                <Plus className="w-5 h-5 mr-3" />
                Create Room
              </Button>
          </div>
        </header>

        {/* Content Scroll Area */}
        <section className="flex-1 overflow-y-auto custom-scrollbar p-8">
          <div className="max-w-6xl mx-auto space-y-12">
            
            {/* Search Bar - Advanced Design */}
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-transparent to-primary/20 rounded-[2.5rem] blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-700" />
              <div className="relative flex items-center bg-card rounded-[2rem] border border-border/60 shadow-xl shadow-muted/10 p-2 pr-6 overflow-hidden">
                <Search className="ml-6 w-6 h-6 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Jump to workspace, project, or member..."
                  className="flex-1 border-none bg-transparent h-16 text-xl font-bold placeholder:text-muted-foreground/50 focus-visible:ring-0"
                />
                <div className="flex items-center gap-4 border-l border-border/40 pl-6 ml-4">
                   <Button
                      variant="ghost"
                      onClick={() => setSortBy(sortBy === "name" ? "members" : "name")}
                      className="h-10 px-4 rounded-xl font-black text-xs uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
                    >
                      {sortBy === "name" ? <ArrowUpAZ className="w-5 h-5 mr-2" /> : <Users className="w-5 h-5 mr-2" />}
                      {sortBy === "name" ? "Alpha" : "Size"}
                    </Button>
                </div>
              </div>
            </div>

            {/* Workgroups Display */}
            <div className={viewMode === "grid" ? "grid gap-8 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "space-y-4"}>
              {isLoading ? (
                <div className="col-span-full py-32 flex flex-col items-center gap-6">
                  <div className="w-20 h-20 rounded-[2.5rem] bg-muted/50 flex items-center justify-center animate-pulse">
                     <Activity className="w-10 h-10 text-primary/30" />
                  </div>
                  <p className="text-xl font-black text-muted-foreground/30 uppercase tracking-[0.3em]">Syncing Hub</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="col-span-full py-32 flex flex-col items-center text-center">
                  <div className="w-32 h-32 rounded-[3.5rem] bg-muted/30 flex items-center justify-center mb-8 relative">
                    <Globe className="w-16 h-16 text-muted-foreground/20" />
                    <div className="absolute inset-0 rounded-[3.5rem] border-4 border-dashed border-muted-foreground/10 animate-spin-slow" />
                  </div>
                  <h3 className="text-3xl font-black text-foreground mb-3 tracking-tighter">Workspace Not Found</h3>
                  <p className="text-muted-foreground max-w-sm font-medium text-lg leading-relaxed">
                    No active channels match your search criteria. Try a broader term or create a new room.
                  </p>
                </div>
              ) : (
                filtered.map((wg) => (
                  <WorkgroupCard 
                    key={wg.id} 
                    wg={wg} 
                    viewMode={viewMode} 
                    user={user}
                    onOpen={() => openWorkgroup(wg.id)}
                    onEdit={() => openEdit(wg)}
                    onDelete={() => setDeleteTarget(wg)}
                  />
                ))
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Reusable Components inside the same file for clean logic */}
      <Dialog open={showCreate || !!editing} onOpenChange={(v) => { if(!v) { setShowCreate(false); setEditing(null); resetForm(); } }}>
        <DialogContent className="max-w-xl rounded-[3rem] p-10 border-none shadow-2xl">
          <DialogHeader className="mb-8">
            <DialogTitle className="text-3xl font-black tracking-tighter flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                {editing ? <Edit className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
              </div>
              {editing ? "Update Space" : "New Workspace"}
            </DialogTitle>
            <DialogDescription className="text-lg font-medium text-muted-foreground mt-2">
              {editing ? "Refine your collaboration environment." : "Establish a new command center for your mission."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-8">
            <div className="space-y-3">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Workspace Identity</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Project Overdrive"
                className="h-16 rounded-2xl text-xl font-bold bg-muted/40 border-none focus-visible:ring-2 focus-visible:ring-primary/20"
              />
            </div>

            <div className="space-y-3">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Strategic Objective</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What exactly are we achieving here?"
                className="min-h-[120px] rounded-2xl text-lg font-medium bg-muted/40 border-none focus-visible:ring-2 focus-visible:ring-primary/20 resize-none p-5"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {WORKGROUP_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setForm({ ...form, type: type.value as any, is_private: type.value === 'private' })}
                  className={`flex items-center gap-4 p-5 rounded-2xl border-2 transition-all duration-300 text-left ${
                    form.type === type.value 
                      ? "border-primary bg-primary/5 shadow-inner" 
                      : "border-border/40 hover:border-primary/20 hover:bg-muted/30"
                  }`}
                >
                  <div className={`p-3 rounded-xl ${form.type === type.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    <type.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-black text-sm">{type.label}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">{type.value}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <DialogFooter className="mt-12 sm:justify-start">
             <Button
                onClick={editing ? handleUpdate : handleCreate}
                disabled={!form.name.trim() || createWg.isPending || updateWg.isPending}
                className="h-16 px-12 rounded-3xl bg-primary hover:bg-primary/90 text-primary-foreground text-lg font-black shadow-2xl shadow-primary/30 transition-all flex-1 sm:flex-none"
              >
                {createWg.isPending || updateWg.isPending ? "Syncing..." : (editing ? "Commit Changes" : "Deploy Workspace")}
              </Button>
              <Button
                variant="ghost"
                onClick={() => { setShowCreate(false); setEditing(null); }}
                className="h-16 px-8 rounded-3xl font-bold text-muted-foreground"
              >
                Cancel
              </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => (!o && setDeleteTarget(null))}>
        <AlertDialogContent className="rounded-[3rem] p-10 border-none shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-3xl font-black tracking-tighter">Terminate Workspace?</AlertDialogTitle>
            <AlertDialogDescription className="text-lg font-medium text-muted-foreground mt-4 leading-relaxed">
              You are about to permanently delete <span className="text-foreground font-black">"{deleteTarget?.name}"</span>. 
              All communication history and data will be liquidated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-10 sm:justify-start gap-4">
            <AlertDialogAction
              onClick={handleDelete}
              className="h-14 px-10 rounded-2xl bg-destructive hover:bg-destructive/90 text-white font-black"
            >
              Confirm Termination
            </AlertDialogAction>
            <AlertDialogCancel className="h-14 px-10 rounded-2xl font-bold border-none hover:bg-muted">
              Abort
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Internal Component for the modern Card
function WorkgroupCard({ wg, viewMode, user, onOpen, onEdit, onDelete }: any) {
  const TypeIcon = getWorkgroupTypeIcon(wg.type || "team");
  const memberCount = Number(wg.member_count || 0);
  const postCount = Number(wg.message_count || 0);
  const unreadCount = Number(wg.unread_count || 0);
  const hasActivity = unreadCount > 0;
  const canEditOrDelete = wg.user_role === "owner" || wg.created_by === user?.id;
  const nameInitial = (wg.name || "W")[0].toUpperCase();

  if (viewMode === "grid") {
    return (
      <Card
        onClick={onOpen}
        className={`group cursor-pointer border-none shadow-xl shadow-muted/10 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500 relative overflow-hidden bg-card rounded-[3rem] p-8 flex flex-col items-center text-center ${
          hasActivity ? "ring-2 ring-primary/40 bg-primary/[0.02]" : ""
        }`}
      >
        <div className="absolute top-0 right-0 p-8 pt-10">
           {hasActivity && (
             <span className="flex h-4 w-4 relative">
               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
               <span className="relative inline-flex rounded-full h-4 w-4 bg-primary shadow-lg shadow-primary/50"></span>
             </span>
           )}
        </div>

        <div 
          className="w-28 h-28 rounded-[2.5rem] flex items-center justify-center text-white text-4xl font-black shadow-2xl mb-8 group-hover:scale-105 group-hover:rotate-2 transition-all duration-700"
          style={{ 
            backgroundColor: wg.avatar_color || '#3b82f6',
            background: `linear-gradient(135deg, ${wg.avatar_color || '#3b82f6'}, ${adjustColor(wg.avatar_color || '#3b82f6', -30)})`,
            boxShadow: `0 25px 50px -12px ${wg.avatar_color || '#3b82f6'}50`
          }}
        >
          {nameInitial}
        </div>

        <div className="space-y-4 flex-1">
          <div className="flex items-center justify-center gap-3">
             <Badge variant="outline" className="h-6 px-3 rounded-full text-[10px] font-black uppercase tracking-widest border-primary/20 text-primary">
               {wg.type}
             </Badge>
             {wg.is_private && <Lock className="w-4 h-4 text-muted-foreground/30" />}
          </div>
          <h3 className="text-2xl font-black text-foreground group-hover:text-primary transition-colors tracking-tighter truncate max-w-[240px]">
            {wg.name}
          </h3>
          <p className="text-base text-muted-foreground font-medium leading-relaxed line-clamp-2 px-2 opacity-70">
            {wg.description || "Established mission for top-level collaboration."}
          </p>
        </div>

        <div className="mt-10 pt-8 w-full border-t border-border/40 grid grid-cols-2 gap-4">
          <div className="text-center">
             <p className="text-lg font-black text-foreground/80 tracking-tighter">{memberCount}</p>
             <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Members</p>
          </div>
          <div className="text-center">
             <p className="text-lg font-black text-primary tracking-tighter">{postCount}</p>
             <p className="text-[10px] font-black uppercase tracking-widest text-primary/40">Records</p>
          </div>
        </div>

        {hasActivity && (
          <div className="mt-6 w-full bg-primary py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-primary-foreground shadow-xl shadow-primary/20">
             {unreadCount} Critical Alerts
          </div>
        )}

        {canEditOrDelete && (
          <div className="absolute top-6 left-6 opacity-0 group-hover:opacity-100 transition-all">
             <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className="w-10 h-10 p-0 rounded-2xl hover:bg-primary/10 hover:text-primary"
              >
                <Edit className="w-5 h-5" />
              </Button>
          </div>
        )}
      </Card>
    );
  }

  return (
    <div
      onClick={onOpen}
      className={`group flex items-center p-6 cursor-pointer hover:bg-muted/40 rounded-[2.5rem] border border-transparent hover:border-border/40 transition-all duration-300 relative ${
        hasActivity ? "bg-primary/[0.04] border-primary/10 shadow-lg shadow-primary/5" : "bg-card shadow-sm shadow-muted/5"
      }`}
    >
      <div className="relative mr-8">
        <div 
          className="w-20 h-20 rounded-[1.8rem] flex items-center justify-center text-white font-black text-3xl shadow-2xl transition-all duration-500 group-hover:scale-105 group-hover:rotate-1"
          style={{ 
            backgroundColor: wg.avatar_color || '#3b82f6',
            background: `linear-gradient(135deg, ${wg.avatar_color || '#3b82f6'}, ${adjustColor(wg.avatar_color || '#3b82f6', -20)})`
          }}
        >
          {nameInitial}
        </div>
        {hasActivity && (
          <div className="absolute -top-3 -right-3 h-8 min-w-[32px] px-2 bg-primary flex items-center justify-center text-white rounded-2xl border-[6px] border-background font-black text-xs shadow-xl">
            {unreadCount}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 mr-12">
        <div className="flex items-center gap-4 mb-2">
           <h3 className="text-2xl font-black text-foreground tracking-tighter truncate group-hover:text-primary transition-colors">
            {wg.name}
          </h3>
          <Badge variant="outline" className="h-6 px-3 rounded-full text-[9px] font-black uppercase tracking-widest border-primary/20 text-primary bg-primary/5">
                {wg.type}
          </Badge>
          {wg.is_private && <Lock className="w-5 h-5 text-muted-foreground/20" />}
        </div>
        <p className="text-lg text-muted-foreground font-medium truncate opacity-60">
          {wg.description || "Standard communication channel."}
        </p>
      </div>

      <div className="flex items-center gap-12 font-black">
        <div className="hidden sm:flex flex-col items-center">
          <p className="text-xl text-foreground/80 tracking-tighter">{memberCount}</p>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground/40">Users</p>
        </div>
        <div className="hidden sm:flex flex-col items-center min-w-[120px]">
           <p className="text-xl text-primary font-black tracking-tighter">
             {wg.last_message_at ? formatDistanceToNow(new Date(wg.last_message_at), { addSuffix: true }).replace('about ', '') : "Idle"}
           </p>
           <p className="text-[10px] uppercase tracking-widest text-primary/30">Last Sync</p>
        </div>
        <div className="flex items-center gap-3">
          {canEditOrDelete && (
             <Button
                variant="ghost"
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className="w-12 h-12 rounded-2xl opacity-0 group-hover:opacity-100 hover:bg-primary/10 hover:text-primary transition-all"
              >
                <Edit className="w-6 h-6" />
              </Button>
          )}
          <div className="w-14 h-14 rounded-3xl bg-muted/60 flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-500 shadow-lg shadow-muted/5 group-hover:shadow-primary/20">
             <ChevronRight className="w-8 h-8 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>
    </div>
  );
}
