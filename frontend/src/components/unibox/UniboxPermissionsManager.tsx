import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus, Trash2, Shield, Search } from "lucide-react";
import { format } from "date-fns";
import { getAvatarUrl } from "@/lib/utils";
import { toast } from "sonner";

interface Permission {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string;
  role: string;
  granted_at: string;
}

interface User {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string;
}

export function UniboxPermissionsManager() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();

  const { data: permissions = [], isLoading } = useQuery<Permission[]>({
    queryKey: ["unibox-permissions"],
    queryFn: async () => {
      const response = await api.get("/unibox/permissions");
      return response;
    },
  });

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["organization-users"],
    queryFn: async () => {
      const response = await api.get("/members");
      return response;
    },
  });

  const grantMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await api.post("/unibox/permissions", { user_id: userId });
      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["unibox-permissions"] });
      toast.success(data.message || "Access granted successfully");
      setDialogOpen(false);
      setSelectedUserId("");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to grant access");
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await api.delete(`/unibox/permissions/${userId}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unibox-permissions"] });
      toast.success("Access revoked successfully");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to revoke access");
    },
  });

  const availableUsers = allUsers.filter(
    (user) => !permissions.some((perm) => perm.id === user.id)
  );

  const filteredPermissions = permissions.filter(
    (perm) =>
      perm.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      perm.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Unibox Access Management
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage who can access the Unibox mailbox
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="h-4 w-4" />
              Grant Access
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Grant Unibox Access</DialogTitle>
              <DialogDescription>
                Select a user to grant access to the Unibox mailbox
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      <div className="flex items-center gap-2">
                        <span>{user.full_name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({user.email})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false);
                    setSelectedUserId("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => grantMutation.mutate(selectedUserId)}
                  disabled={!selectedUserId || grantMutation.isPending}
                >
                  {grantMutation.isPending ? "Granting..." : "Grant Access"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : filteredPermissions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No users with access
        </div>
      ) : (
        <div className="space-y-2">
          {filteredPermissions.map((permission) => (
            <div
              key={permission.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={getAvatarUrl(permission.avatar_url) || undefined} />
                  <AvatarFallback>
                    {permission.full_name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{permission.full_name}</p>
                  <p className="text-sm text-muted-foreground">{permission.email}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Access granted {format(new Date(permission.granted_at), "PPp")}
                    {permission.role === 'super_admin' && (
                      <Badge className="ml-2 text-xs" variant="secondary">
                        Super Admin
                      </Badge>
                    )}
                  </p>
                </div>
              </div>
              {permission.role !== 'super_admin' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => revokeMutation.mutate(permission.id)}
                  disabled={revokeMutation.isPending}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 p-3 bg-muted/50 rounded-lg">
        <p className="text-xs text-muted-foreground">
          <strong>Note:</strong> Users granted access here see the complete Unibox. For folder-only access (specific campaigns),
          do not grant access here — instead assign users to folders from the Unibox sidebar. Only the lead user (super admin) can manage folders.
        </p>
      </div>
    </Card>
  );
}
