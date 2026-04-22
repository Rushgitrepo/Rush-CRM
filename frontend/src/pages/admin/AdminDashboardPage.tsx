import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  UserPlus,
  Search,
  Mail,
  Phone,
  ShieldCheck,
  MoreVertical,
  Edit2,
  Trash2,
  Loader2,
  Filter,
  CheckCircle2,
  XCircle,
  Briefcase,
  ChevronRight,
  ChevronLeft,
  Save,
  Lock,
  Settings2,
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
import { usersApi } from "@/lib/api";
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
  const { userRole, user, refreshProfile, updateProfilePermissions, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
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
  const [pendingInvites, setPendingInvites] = useState<
    Array<{ email: string; fullName: string; role: string; createdAt: string }>
  >([]);

  const showToast = (
    type: "success" | "error",
    message: string,
    options?: { duration?: number; position?: "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right" }
  ) => {
    if (type === "success") {
      toast.success(message, options);
      return;
    }
    toast.error(message, options);
  };

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => usersApi.getAll(),
    refetchInterval: 3000, // Refetch every 3 seconds to catch new users
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => usersApi.create(data),
    onSuccess: (_, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      if (variables?.email) {
        setPendingInvites((prev) => [
          {
            email: variables.email,
            fullName: variables.fullName || "Pending User",
            role: variables.role || "employee",
            createdAt: new Date().toISOString(),
          },
          ...prev.filter((p) => p.email.toLowerCase() !== String(variables.email).toLowerCase()),
        ]);
      }
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
      hasPermission("members", "create") || hasPermission("employees", "create");

    if (!canCreateMembers) {
      showToast("error", "You don't have permission to view Team members page", {
        position: "bottom-right",
        duration: 4000,
      });
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
      hasPermission("members", "edit") || hasPermission("employees", "edit");

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
      hasPermission("members", "delete") || hasPermission("employees", "delete");

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

  useEffect(() => {
    if (!users?.length) return;
    const activeEmails = new Set(users.map((u: any) => String(u.email || "").toLowerCase()));
    console.log('Active emails:', Array.from(activeEmails));
    console.log('Pending invites before filter:', pendingInvites);
    setPendingInvites((prev) => {
      const filtered = prev.filter((p) => !activeEmails.has(p.email.toLowerCase()));
      console.log('Pending invites after filter:', filtered);
      return filtered;
    });
  }, [users]);

  return (
    <PermissionGuard module="members" action="view">
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Admin Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage organization employees and system access.
            </p>
          </div>
          <Button onClick={handleCreateNew} className="gap-2 bg-primary">
            <UserPlus className="h-4 w-4" />
            Add New Employee
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <Card className="border-none shadow-sm bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Employee Management
                </CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search employees..."
                      className="pl-9 bg-secondary/50 border-none"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="border-none bg-secondary/50"
                  >
                    <Filter className="h-4 w-4" />
                  </Button>
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
                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {pendingInvites.map((p) => (
                        <tr key={`${p.email}-${p.createdAt}`} className="bg-amber-50/60 text-sm">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9 border border-amber-200">
                                <AvatarFallback className="bg-amber-100 text-amber-700 font-bold">
                                  {p.fullName?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col">
                                <span className="font-semibold text-foreground/90 flex items-center gap-2">
                                  {p.fullName}
                                  <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">
                                    Pending
                                  </span>
                                </span>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Mail className="h-3 w-3" /> {p.email}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant="outline" className="capitalize border-none px-2 py-0.5 bg-amber-100 text-amber-700">
                              {p.role.replace("_", " ")}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-muted-foreground">--</td>
                          <td className="px-6 py-4">
                            <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700">
                              Invite Sent
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-right text-xs text-muted-foreground">--</td>
                        </tr>
                      ))}
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
                              className={`capitalize border-none px-2 py-0.5 ${
                                u.role === "super_admin"
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
                            <div className="flex items-center gap-1.5 text-muted-foreground">
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

          {/* Quick Stats Card */}
          <Card className="border-none shadow-sm bg-primary text-primary-foreground max-w-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium opacity-80 uppercase tracking-wider">
                    Total Active Employees
                  </p>
                  <p className="text-3xl font-bold">{users?.length || 0}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                  <ShieldCheck className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* User Form Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl">
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
                      className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                        i <= addMemberStep ? "bg-primary" : "bg-primary/10"
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
                  <ModulePermissionEditor
                    selectedModules={selectedModules}
                    setSelectedModules={setSelectedModules}
                  />
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
