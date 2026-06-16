import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  UserPlus,
  Search,
  Mail,
  ShieldCheck,
  Edit2,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  Briefcase,
  ChevronRight,
  ChevronLeft,
  Save,
  Clock,
  RefreshCw,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { DASHBOARD_MODULES, MODULE_PERMISSIONS } from "@/data/permissions.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { useAuth } from "@/contexts/AuthContext";
import { usersApi, organizationApi } from "@/lib/api";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { ModulePermissionEditor } from "@/components/admin/ModulePermissionEditor";
import { getAvatarUrl } from "@/lib/utils";

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "team_lead", label: "Team Lead" },
  { value: "employee", label: "Employee" },
];

const DEPARTMENTS = [
  "Management",
  "Sales",
  "Marketing",
  "Operations",
  "Human Resources",
  "Engineering",
  "Customer Support",
  "Finance",
];

export default function AdminDashboardPage() {
  const {
    userRole,
    user,
    refreshProfile,
    updateProfilePermissions,
    hasPermission,
  } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDept, setFilterDept] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);

  // Form State
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    department: "",
    role: "employee",
    position: "",
  });

  const [addMemberStep, setAddMemberStep] = useState(1);
  const [selectedModules, setSelectedModules] = useState<
    Record<string, string[]>
  >({});

  const showToast = (
    type: "success" | "error",
    message: string,
    options?: {
      duration?: number;
      position?:
      | "top-left"
      | "top-center"
      | "top-right"
      | "bottom-left"
      | "bottom-center"
      | "bottom-right";
    },
  ) => {
    if (type === "success") {
      toast.success(message, options);
      return;
    }
    toast.error(message, options);
  };

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users", searchTerm, filterRole, filterStatus, filterDept],
    queryFn: () => usersApi.getAll({
      search: searchTerm || undefined,
      role: filterRole !== "all" ? filterRole : undefined,
      status: filterStatus !== "all" ? filterStatus : undefined,
      department: filterDept !== "all" ? filterDept : undefined,
    }),
    refetchInterval: 3000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  const { data: stats } = useQuery({
    queryKey: ["admin-users-stats"],
    queryFn: () => usersApi.getStats(),
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  // Pending invites — DB se real data
  const { data: dbInvites = [], isLoading: invitesLoading } = useQuery({
    queryKey: ["admin-invites"],
    queryFn: () => organizationApi.getInvites(),
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  });

  const resendInviteMutation = useMutation({
    mutationFn: (invite: any) =>
      usersApi.create({ email: invite.email, fullName: invite.full_name || invite.email, role: invite.role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-invites"] });
      toast.success("Invite resent successfully");
    },
    onError: (err: any) => toast.error(err.message || "Failed to resend invite"),
  });

  const deleteInviteMutation = useMutation({
    mutationFn: (id: string) => organizationApi.deleteInvite(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-invites"] });
      toast.success("Invite deleted");
    },
    onError: (err: any) => toast.error(err.message || "Failed to delete invite"),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => usersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-invites"] });
      showToast("success", "Employee created successfully");
      closeDialog();
    },
    onError: (error: any) => {
      showToast("error", error.message || "Failed to create employee");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      usersApi.update(id, data),
    onSuccess: async (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      if (user?.id === variables.id && variables.data?.module_permissions) {
        // Apply immediately so permission checks update without full page refresh.
        updateProfilePermissions(variables.data.module_permissions);
        await refreshProfile();
      }
      showToast("success", "Employee updated successfully");
      closeDialog();
    },
    onError: (error: any) => {
      showToast("error", error.message || "Failed to update employee");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      showToast("success", "Employee deleted successfully");
    },
    onError: (error: any) => {
      showToast("error", error.message || "Failed to delete employee");
    },
  });

  const closeDialog = () => {
    setFormData({
      fullName: "",
      email: "",
      phone: "",
      department: "",
      role: "employee",
      position: "",
    });
    setEditingUser(null);
    setSelectedModules({});
    setAddMemberStep(1);
    setIsDialogOpen(false);
  };

  const handleOpenDeleteDialog = (user: any) => {
    setUserToDelete(user);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (userToDelete) {
      deleteMutation.mutate(userToDelete.id);
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
    }
  };

  const handleCreateNew = () => {
    const canCreateMembers =
      hasPermission("admin_dashboard", "create") ||
      hasPermission("employees", "create");

    if (!canCreateMembers) {
      showToast(
        "error",
        "You don't have permission to view Team members page",
        {
          position: "bottom-right",
          duration: 4000,
        },
      );
      return;
    }
    setEditingUser(null);
    setFormData({
      fullName: "",
      email: "",
      phone: "",
      department: "",
      role: "employee",
      position: "",
    });
    setAddMemberStep(1);
    setIsDialogOpen(true);
  };

  const handleEdit = (user: any) => {
    setEditingUser(user);
    setFormData({
      fullName: user.full_name || "",
      email: user.email || "",
      phone: user.phone || "",
      department: user.department || "",
      role: user.role || "employee",
      position: user.position || "",
    });
    // Set initial permissions if available
    setSelectedModules(user.module_permissions || {});
    setAddMemberStep(2);
    setIsDialogOpen(true);
  };

  const handleEditClick = (targetUser: any) => {
    const canEditMembers =
      hasPermission("admin_dashboard", "edit") ||
      hasPermission("employees", "edit");

    if (!canEditMembers) {
      showToast("error", "You don't have permission to edit team members", {
        position: "bottom-right",
        duration: 4000,
      });
      return;
    }

    handleEdit(targetUser);
  };

  const handleDeleteClick = (targetUser: any) => {
    const canDeleteMembers =
      hasPermission("admin_dashboard", "delete") ||
      hasPermission("employees", "delete");

    if (!canDeleteMembers) {
      showToast("error", "You don't have permission to delete team members", {
        position: "bottom-right",
        duration: 4000,
      });
      return;
    }

    handleOpenDeleteDialog(targetUser);
  };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Handle Submit called. Step:", addMemberStep);

    if (addMemberStep === 1 && !editingUser) {
      console.log("On Step 1, blocking creation and moving to Step 2.");
      setAddMemberStep(2);
      return;
    }

    if (addMemberStep === 2 || editingUser) {
      console.log("Proceeding with data submission.");
      const payload = {
        ...formData,
        module_permissions: selectedModules,
      };

      if (editingUser) {
        updateMutation.mutate({ id: editingUser.id, data: payload });
      } else {
        createMutation.mutate(payload);
      }
    }
  };

  const filteredUsers = users?.filter(
    (u) =>
      u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const canModify = (targetUser: any) => {
    if (userRole?.role === "super_admin") return true;
    if (targetUser.role === "super_admin") return false;
    return true;
  };

  return (
    <PermissionGuard module="admin_dashboard" action="view">
      <div className=" space-y-6 max-w-8xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">
              Employee Management
            </h1>
            <p className="text-muted-foreground  mt-1">
              Manage organization employees and system access.
            </p>
          </div>
          <Button onClick={handleCreateNew} className="gap-2 bg-primary text-[20px]">
            <UserPlus className="h-10 w-10" />
            New Employee
          </Button>
        </div>

        {/* Stats Cards — DB se real data */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Total Users */}
          <Card className="border-none shadow-sm bg-card/50">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Total Users</p>
                <p className="text-3xl font-bold mt-1">{stats ? Number(stats.total) : 0}</p>
              </div>
              <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
            </CardContent>
          </Card>
          {/* Active Users */}
          <Card className="border-none shadow-sm bg-card/50">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Active Users</p>
                <p className="text-3xl font-bold mt-1 text-emerald-500">{stats ? Number(stats.active) : 0}</p>
              </div>
              <div className="h-11 w-11 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <UserPlus className="h-5 w-5 text-emerald-500" />
              </div>
            </CardContent>
          </Card>
          {/* Admins */}
          <Card className="border-none shadow-sm bg-card/50">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Admins</p>
                <p className="text-3xl font-bold mt-1 text-violet-500">{stats ? Number(stats.admins) : 0}</p>
              </div>
              <div className="h-11 w-11 rounded-full bg-violet-500/10 flex items-center justify-center">
                <ShieldCheck className="h-5 w-5 text-violet-500" />
              </div>
            </CardContent>
          </Card>
          {/* Inactive */}
          <Card className="border-none shadow-sm bg-card/50">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Inactive</p>
                <p className="text-3xl font-bold mt-1 text-destructive">{stats ? Number(stats.inactive) : 0}</p>
              </div>
              <div className="h-11 w-11 rounded-full bg-destructive/10 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-destructive" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pending Invitations — DB se real data */}
        <Card className="border-none shadow-sm bg-card/50">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-base  text-[16px] font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500 " />
              Pending Invitations
              {!invitesLoading && (
                <span className="ml-1 text-xs font-bold bg-amber-500/15 text-amber-500 px-2 py-0.5 rounded-full">
                  {dbInvites.length}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {invitesLoading ? (
              <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading invites...
              </div>
            ) : dbInvites.length === 0 ? (
              <div className="px-6 py-4 text-sm text-muted-foreground">
                No pending invitations.
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {dbInvites.map((invite: any) => {
                  return (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between px-6 py-4 hover:bg-muted/20 transition-colors"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-sm text-foreground">
                          {invite.email}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Role: {invite.role?.replace("_", " ")} &middot; Sent:{" "}
                          {new Date(invite.created_at).toLocaleDateString("en-US", {
                            month: "short", day: "numeric", year: "numeric",
                          })}
                          {invite.expires_at && (
                            <> &middot; Expires:{" "}
                              {new Date(invite.expires_at).toLocaleDateString("en-US", {
                                month: "short", day: "numeric", year: "numeric",
                              })}
                            </>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                          title="Resend Invite"
                          onClick={() => resendInviteMutation.mutate(invite)}
                          disabled={resendInviteMutation.isPending}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title="Delete Invite"
                          onClick={() => deleteInviteMutation.mutate(invite.id)}
                          disabled={deleteInviteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6">
          <Card className="border-none shadow-sm bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Employee Management
                </CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative w-52">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search users..."
                      className="pl-9 bg-secondary/50 border-none"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  {/* Role Filter */}
                  <Select value={filterRole} onValueChange={setFilterRole}>
                    <SelectTrigger className="w-32 bg-secondary/50 border-none h-9 text-sm">
                      <SelectValue placeholder="All Roles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      {ROLE_OPTIONS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* Status Filter */}
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-32 bg-secondary/50 border-none h-9 text-sm">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  {/* Department Filter */}
                  <Select value={filterDept} onValueChange={setFilterDept}>
                    <SelectTrigger className="w-36 bg-secondary/50 border-none h-9 text-sm">
                      <SelectValue placeholder="All Depts" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Depts</SelectItem>
                      {DEPARTMENTS.map((d) => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center p-12 space-y-4">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">
                    Fetching employees...
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-muted/30">
                      <tr>
                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Employee
                        </th>
                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Role
                        </th>
                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Department
                        </th>
                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Status
                        </th>
                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Joined
                        </th>
                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {filteredUsers?.map((u) => (
                        <tr
                          key={u.id}
                          className="hover:bg-muted/20 transition-colors group text-sm"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9 border border-border/50">
                                <AvatarImage src={getAvatarUrl(u.avatar_url)} />
                                <AvatarFallback className="bg-primary/10 text-primary font-bold">
                                  {u.full_name
                                    ?.split(" ")
                                    .map((n: string) => n[0])
                                    .join("")
                                    .toUpperCase()
                                    .slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col">
                                <span className="font-semibold text-foreground/90 flex items-center gap-2">
                                  {u.full_name}
                                  {u.password_change_required && (
                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">
                                      Pending
                                    </span>
                                  )}
                                </span>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Mail className="h-3 w-3" /> {u.email}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <Badge
                              variant="outline"
                              className={`capitalize border-none px-2 py-0.5 ${u.role === "super_admin"
                                ? "bg-indigo-500/10 text-indigo-500"
                                : u.role === "admin"
                                  ? "bg-emerald-500/10 text-emerald-500"
                                  : "bg-slate-500/10 text-slate-500"
                                }`}
                            >
                              {u.role?.replace("_", " ")}
                            </Badge>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5 text-muted-foreground capitalize">
                              <Briefcase className="h-3.5 w-3.5" />
                              {u.department || "General"}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5 text-xs">
                              {u.is_active !== false ? (
                                <>
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                  <span className="text-emerald-500/90 font-medium">
                                    Active
                                  </span>
                                </>
                              ) : (
                                <>
                                  <XCircle className="h-3.5 w-3.5 text-destructive" />
                                  <span className="text-destructive font-medium">
                                    Inactive
                                  </span>
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-xs text-muted-foreground">
                            {u.created_at
                              ? new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                              : "—"}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                                onClick={() => handleEditClick(u)}
                                disabled={!canModify(u)}
                                title="Edit User"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                disabled={!canModify(u)}
                                onClick={() => handleDeleteClick(u)}
                                title="Delete User"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

        </div>

        {/* User Form Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[95vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl">
            <div className="p-6 bg-gradient-to-br from-primary/5 via-background to-background border-b border-border/50">
              <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    {addMemberStep === 1 ? (
                      <UserPlus className="h-5 w-5 text-primary" />
                    ) : (
                      <ShieldCheck className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div>
                    <DialogTitle className="text-xl">
                      {editingUser
                        ? "Edit Employee Permissions"
                        : "Add New Employee"}
                      {!editingUser &&
                        (addMemberStep === 1 ? " (Step 1/2)" : " (Step 2/2)")}
                    </DialogTitle>
                    <DialogDescription>
                      {editingUser
                        ? `Managing module access for ${editingUser.full_name}`
                        : addMemberStep === 1
                          ? "Configure basic account information"
                          : "Assign module-level access permissions"}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              {/* Step Progress Bar - Only show for new members */}
              {!editingUser && (
                <div className="flex gap-2 mt-6">
                  {[1, 2].map((i) => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i <= addMemberStep ? "bg-primary" : "bg-primary/10"
                        }`}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <form id="member-form">
                {addMemberStep === 1 ? (
                  <div className="grid gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
                          Full Name
                        </label>
                        <Input
                          placeholder="John Doe"
                          required
                          value={formData.fullName}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              fullName: e.target.value,
                            })
                          }
                          className="bg-secondary/30 border-none focus-visible:ring-1 focus-visible:ring-primary h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
                          Email Address
                        </label>
                        <Input
                          type="email"
                          placeholder="john@rushcorporation.com"
                          required
                          disabled={!!editingUser}
                          value={formData.email}
                          onChange={(e) =>
                            setFormData({ ...formData, email: e.target.value })
                          }
                          className="bg-secondary/30 border-none focus-visible:ring-1 focus-visible:ring-primary h-11"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
                          Job Title / Position
                        </label>
                        <Input
                          placeholder="e.g. Sales Manager"
                          value={formData.position}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              position: e.target.value,
                            })
                          }
                          className="bg-secondary/30 border-none focus-visible:ring-1 focus-visible:ring-primary h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
                          Phone Number
                        </label>
                        <Input
                          placeholder="+1 (555) 000-0000"
                          value={formData.phone}
                          onChange={(e) =>
                            setFormData({ ...formData, phone: e.target.value })
                          }
                          className="bg-secondary/30 border-none focus-visible:ring-1 focus-visible:ring-primary h-11"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
                          Department
                        </label>
                        <Select
                          value={formData.department}
                          onValueChange={(v) =>
                            setFormData({ ...formData, department: v })
                          }
                        >
                          <SelectTrigger className="bg-secondary/30 border-none focus:ring-1 focus:ring-primary h-11">
                            <SelectValue placeholder="Select Department" />
                          </SelectTrigger>
                          <SelectContent>
                            {DEPARTMENTS.map((d) => (
                              <SelectItem key={d} value={d}>
                                {d}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
                          System Role
                        </label>
                        <Select
                          value={formData.role}
                          onValueChange={(v) =>
                            setFormData({ ...formData, role: v })
                          }
                        >
                          <SelectTrigger className="bg-secondary/30 border-none focus:ring-1 focus:ring-primary h-11 capitalize">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLE_OPTIONS.filter(
                              (r) =>
                                userRole?.role === "super_admin" ||
                                r.value !== "super_admin",
                            ).map((r) => (
                              <SelectItem key={r.value} value={r.value}>
                                {r.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {formData.role === "admin" && (
                          <p className="text-[10px] text-amber-500 font-medium flex items-center gap-1 mt-1">
                            <ShieldCheck className="h-3 w-3" /> Note: Admin role
                            has broad access
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Role Edit - only show when editing existing user */}
                    {editingUser && (
                      <div className="flex items-center gap-4 p-4 bg-secondary/30 rounded-xl border border-border/50">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <ShieldCheck className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                            System Role
                          </label>
                          <Select
                            value={formData.role}
                            onValueChange={(v) =>
                              setFormData({ ...formData, role: v })
                            }
                          >
                            <SelectTrigger className="mt-1 bg-secondary/50 border-none focus:ring-1 focus:ring-primary h-9 capitalize">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLE_OPTIONS.filter(
                                (r) =>
                                  userRole?.role === "super_admin" ||
                                  r.value !== "super_admin",
                              ).map((r) => (
                                <SelectItem key={r.value} value={r.value}>
                                  {r.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {formData.role === "admin" && (
                          <p className="text-[10px] text-amber-500 font-medium flex items-center gap-1 shrink-0">
                            <ShieldCheck className="h-3 w-3" /> Broad access
                          </p>
                        )}
                      </div>
                    )}
                    <ModulePermissionEditor
                      selectedModules={selectedModules}
                      setSelectedModules={setSelectedModules}
                      availableUsers={users}
                      filterRole={formData.role}
                    />
                  </div>
                )}
              </form>
            </div>

            <div className="p-6 bg-secondary/20 border-t border-border/50 flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={closeDialog}
                className="text-muted-foreground hover:text-foreground"
              >
                Cancel
              </Button>

              <div className="flex items-center gap-3">
                {addMemberStep === 2 && !editingUser && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAddMemberStep(1)}
                    className="gap-2 border-border/50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Back
                  </Button>
                )}

                {addMemberStep === 1 ? (
                  <Button
                    type="button"
                    onClick={() => {
                      const form = document.getElementById(
                        "member-form",
                      ) as HTMLFormElement;
                      if (form.checkValidity()) {
                        setAddMemberStep(2);
                      } else {
                        form.reportValidity();
                      }
                    }}
                    className="gap-2 px-6 bg-primary shadow-lg shadow-primary/20"
                  >
                    Configure Permissions
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={
                      createMutation.isPending || updateMutation.isPending
                    }
                    className="gap-2 px-8 bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 text-white"
                  >
                    {createMutation.isPending || updateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {editingUser ? "Save Changes" : "Create Account"}
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
        >
          <AlertDialogContent className="border-none shadow-2xl">
            <AlertDialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                  <Trash2 className="h-5 w-5 text-destructive" />
                </div>
                <AlertDialogTitle className="text-xl">
                  Are you absolutely sure?
                </AlertDialogTitle>
              </div>
              <AlertDialogDescription className="text-sm">
                This will deactivate{" "}
                <strong>{userToDelete?.full_name}'s</strong> account. They will
                no longer be able to log in to the system. This action is
                carefully logged.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-4">
              <AlertDialogCancel className="border-none bg-secondary/50 hover:bg-secondary">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-lg shadow-destructive/20"
              >
                Yes, Delete Account
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PermissionGuard>
  );
}
