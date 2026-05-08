import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarIcon, FolderKanban, Palette, User } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Project } from "@/hooks/useTasks";
import { MemberSearchSelect } from "@/components/tasks/MemberSearchSelect";

interface ProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: Project | null;
  members: any[];
  onSubmit: (data: any) => void;
}

const PROJECT_COLORS = [
  { value: "bg-blue-500", label: "Blue" },
  { value: "bg-green-500", label: "Green" },
  { value: "bg-purple-500", label: "Purple" },
  { value: "bg-orange-500", label: "Orange" },
  { value: "bg-red-500", label: "Red" },
  { value: "bg-pink-500", label: "Pink" },
  { value: "bg-yellow-500", label: "Yellow" },
  { value: "bg-indigo-500", label: "Indigo" },
];

const STATUS_OPTIONS = [
  { value: "planning", label: "Planning" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export function ProjectDialog({
  open,
  onOpenChange,
  project,
  members,
  onSubmit,
}: ProjectDialogProps) {
  const { profile, userRole } = useAuth();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    status: "planning",
    color: "bg-blue-500",
    start_date: undefined as Date | undefined,
    end_date: undefined as Date | undefined,
    managerId: "",
    canAssign: false,
  });

  // Update form when project changes (for editing)
  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name || "",
        description: project.description || "",
        status: project.status || "planning",
        color: project.color || "bg-blue-500",
        start_date: (project as any).start_date || (project as any).startDate ? new Date((project as any).start_date || (project as any).startDate) : undefined,
        end_date: (project as any).end_date || (project as any).endDate ? new Date((project as any).end_date || (project as any).endDate) : undefined,
        managerId: (project as any).manager_id || (project as any).managerId || "",
        canAssign: (project as any).can_assign ?? (project as any).canAssign ?? false,
      });
    } else {
      // Reset form for new project
      setFormData({
        name: "",
        description: "",
        status: "planning",
        color: "bg-blue-500",
        start_date: undefined,
        end_date: undefined,
        managerId: "",
        canAssign: false,
      });
    }
  }, [project, open]);

  const isAdmin = userRole?.role === 'admin' || userRole?.role === 'super_admin';
  const isCreator = !project || project.created_by === profile?.id;
  const canEditCoreFields = isAdmin || isCreator;

  const handleSubmit = () => {
    if (!formData.name.trim()) return;

    onSubmit({
      ...formData,
      startDate: formData.start_date ? formData.start_date.toISOString() : null,
      endDate: formData.end_date ? formData.end_date.toISOString() : null,
      managerId: formData.managerId || null,
      canAssign: formData.canAssign,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <FolderKanban className="h-6 w-6" />
            {project ? "Edit Project" : "Create New Project"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Project Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">
              Project Name *
            </Label>
            <Input
              id="name"
              placeholder="Enter project name..."
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="text-base h-12"
              disabled={!canEditCoreFields}
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">
              Description
            </Label>
            <Textarea
              id="description"
              placeholder="Add project description..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="min-h-[100px] resize-none"
              disabled={!canEditCoreFields}
            />
          </div>

          {/* Properties Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Status */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Color */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Color
              </Label>
              <Select
                value={formData.color}
                onValueChange={(value) => setFormData({ ...formData, color: value })}
              >
                <SelectTrigger>
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      <div className={cn("h-4 w-4 rounded-full", formData.color)} />
                      {PROJECT_COLORS.find((c) => c.value === formData.color)?.label}
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_COLORS.map((color) => (
                    <SelectItem key={color.value} value={color.value}>
                      <div className="flex items-center gap-2">
                        <div className={cn("h-4 w-4 rounded-full", color.value)} />
                        {color.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Start Date */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                Start Date
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.start_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.start_date ? (
                      format(formData.start_date, "PPP")
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.start_date}
                    onSelect={(date) => setFormData({ ...formData, start_date: date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* End Date */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                End Date
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.end_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.end_date ? (
                      format(formData.end_date, "PPP")
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.end_date}
                    onSelect={(date) => setFormData({ ...formData, end_date: date })}
                    initialFocus
                    disabled={(date) =>
                      formData.start_date ? date < formData.start_date : false
                    }
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Manager & Delegation */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4" />
                Assign To
                {!canEditCoreFields && !formData.canAssign && (
                  <span className="flex items-center gap-1 text-[10px] text-red-500 font-semibold">
                    <div className="h-2 w-2 rounded-full bg-red-500" />
                    No permission
                  </span>
                )}
              </Label>
              {/* Show dropdown if: admin/creator OR delegation is ON */}
              {(canEditCoreFields || formData.canAssign) ? (
                <MemberSearchSelect
                  members={members}
                  value={formData.managerId || ""}
                  onChange={(val) => setFormData({ ...formData, managerId: val })}
                />
              ) : (
                <div className="flex h-10 w-full items-center justify-between rounded-md border border-red-500/40 bg-red-500/5 px-3 py-2 text-sm cursor-not-allowed opacity-60">
                  <span className="text-muted-foreground">
                    {formData.managerId
                      ? members.find((m) => m.id === formData.managerId)?.full_name || "Assigned"
                      : "No Assign Permission"}
                  </span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/50"><path d="m6 9 6 6 6-6" /></svg>
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl border border-primary/10 bg-primary/5 flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-semibold">Allow Delegation</Label>
                <p className="text-xs text-muted-foreground">
                  Allow manager to assign projects and manage members.
                </p>
              </div>
              <Switch
                checked={formData.canAssign}
                onCheckedChange={(checked) => setFormData({ ...formData, canAssign: checked })}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!formData.name.trim()}>
            {project ? "Update Project" : "Create Project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
