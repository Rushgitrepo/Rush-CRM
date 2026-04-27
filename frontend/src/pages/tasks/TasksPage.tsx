import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Plus, Search, Trash2, CheckCircle2, Clock, Eye, Activity,
  FolderKanban, List, LayoutGrid, FolderOpen, ChevronRight,
  AlertCircle, ArrowUpRight, Circle, ChevronDown, MoreHorizontal,
  CalendarDays, User, Flag, Hash, Inbox, FileText, Tag, 
  MessageSquare, Paperclip, Timer, Target, Zap,
} from "lucide-react";
import { TasksKanbanBoard } from "@/components/tasks/TasksKanbanBoard";
import {
  useProjects, useTasks, useCreateProject, useCreateTask,
  useUpdateTask, useDeleteTask, useDeleteProject,
  type Task, type Project,
} from "@/hooks/useTasks";
import { useOrganizationProfiles } from "@/hooks/useTenantQuery";
import { format, isToday, isTomorrow, isPast } from "date-fns";
import { cn } from "@/lib/utils";
import { ProjectTemplatesDialog } from "@/components/projects/ProjectTemplatesDialog";
import { useApplyTemplate, type ProjectTemplate } from "@/hooks/useProjectFeatures";

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { value: "new",         label: "New",         icon: Circle,       color: "text-blue-500",   bg: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "pending",     label: "Pending",     icon: Clock,        color: "text-yellow-500", bg: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  { value: "in_progress", label: "In Progress", icon: Activity,     color: "text-orange-500", bg: "bg-orange-50 text-orange-700 border-orange-200" },
  { value: "waiting",     label: "Waiting",     icon: Eye,          color: "text-purple-500", bg: "bg-purple-50 text-purple-700 border-purple-200" },
  { value: "completed",   label: "Completed",   icon: CheckCircle2, color: "text-green-500",  bg: "bg-green-50 text-green-700 border-green-200" },
  { value: "deferred",    label: "Deferred",    icon: Circle,       color: "text-gray-400",   bg: "bg-gray-50 text-gray-600 border-gray-200" },
];

const PRIORITY_OPTIONS = [
  { value: "low",    label: "Low",    color: "text-green-500",  bg: "bg-green-50 text-green-700 border-green-200",   dot: "bg-green-400" },
  { value: "normal", label: "Normal", color: "text-blue-500",   bg: "bg-blue-50 text-blue-700 border-blue-200",     dot: "bg-blue-400" },
  { value: "high",   label: "High",   color: "text-orange-500", bg: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-orange-400" },
  { value: "urgent", label: "Urgent", color: "text-red-500",    bg: "bg-red-50 text-red-700 border-red-200",          dot: "bg-red-500" },
];

const ISSUE_TYPES = [
  { value: "task",      label: "Task",      icon: CheckCircle2, color: "text-blue-500",   bg: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "milestone", label: "Milestone", icon: Flag,         color: "text-purple-500", bg: "bg-purple-50 text-purple-700 border-purple-200" },
  { value: "project",   label: "Project",   icon: FolderOpen,   color: "text-green-500",  bg: "bg-green-50 text-green-700 border-green-200" },
];

const PROJECT_COLORS = [
  "bg-violet-500", "bg-blue-500", "bg-cyan-500", "bg-emerald-500",
  "bg-yellow-500", "bg-orange-500", "bg-rose-500", "bg-pink-500",
];

const PROJECT_STATUS_COLOR: Record<string, string> = {
  active: "bg-emerald-500", on_hold: "bg-yellow-500",
  completed: "bg-blue-500", cancelled: "bg-red-500", planning: "bg-violet-500",
};

type ViewMode = "list" | "board" | "overview";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getProjectColor(project: Project) {
  if (project.color) return project.color;
  const idx = project.id.charCodeAt(0) % PROJECT_COLORS.length;
  return PROJECT_COLORS[idx];
}

function formatDue(date: string) {
  const d = new Date(date);
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  return format(d, "MMM d");
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TasksPage() {
  const navigate = useNavigate();
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [view, setView] = useState<ViewMode>("overview");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({
    assignee: "all",
    priority: "all", 
    status: "all",
    labels: [] as string[],
  });
  const [taskDialog, setTaskDialog] = useState(false);
  const [projectDialog, setProjectDialog] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const { data: projects = [], isLoading: loadingProjects } = useProjects();
  const { data: allTasks = [], isLoading: loadingTasks } = useTasks();
  const { data: members = [] } = useOrganizationProfiles();

  // Debug: Check if data is loading
  console.log('Tasks data:', { allTasks, loadingTasks, tasksCount: allTasks.length });
  console.log('Selected project:', selectedProject);

  const createProject = useCreateProject();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const deleteProject = useDeleteProject();
  const applyTemplate = useApplyTemplate();

  const [newProject, setNewProject] = useState({ name: "", description: "" });
  const [newTask, setNewTask] = useState({
    title: "", description: "", priority: "normal", type: "task",
    project_id: "", assigned_to: "", due_date: "", labels: [] as string[],
  });

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Cmd/Ctrl + K for search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
        searchInput?.focus();
      }

      // C for create issue
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setTaskDialog(true);
      }

      // P for create project  
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        setProjectDialog(true);
      }

      // 1-3 for view switching
      if (e.key === '1') {
        e.preventDefault();
        setView('list');
      }
      if (e.key === '2') {
        e.preventDefault();
        setView('board');
      }
      if (e.key === '3') {
        e.preventDefault();
        setView('overview');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Derive tasks for current view
  const viewTasks = allTasks.filter((t) => {
    if (selectedProject === "my_tasks") return t.assigned_to === "current_user_id"; // Replace with actual user ID
    if (selectedProject === "overdue") return t.due_date && isPast(new Date(t.due_date)) && t.status !== "completed";
    if (selectedProject === "completed") return t.status === "completed";
    if (selectedProject === "all_tasks") return t.type === "task" || !t.type;
    if (selectedProject === "milestones") return t.type === "milestone";
    return t.project_id === selectedProject;
  });

  const filteredTasks = viewTasks.filter((t) => {
    // Text search
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    
    // Assignee filter
    if (filters.assignee && filters.assignee !== "all") {
      if (filters.assignee === "unassigned" && t.assigned_to) {
        return false;
      }
      if (filters.assignee !== "unassigned" && t.assigned_to !== filters.assignee) {
        return false;
      }
    }
    
    // Priority filter
    if (filters.priority && filters.priority !== "all" && t.priority !== filters.priority) {
      return false;
    }
    
    // Status filter
    if (filters.status && filters.status !== "all" && t.status !== filters.status) {
      return false;
    }
    
    return true;
  });

  // Debug: Check filtering
  console.log('View tasks after project filter:', viewTasks.length);
  console.log('Filtered tasks after all filters:', filteredTasks.length);
  console.log('Current filters:', filters);
  console.log('Search term:', search);
  console.log('Filtering debug:', { 
    viewTasks: viewTasks.length, 
    filteredTasks: filteredTasks.length, 
    selectedProject, 
    filters,
    search 
  });

  const currentProject = projects.find((p) => p.id === selectedProject) ?? null;

  const handleCreateProject = () => {
    if (!newProject.name.trim()) return;
    createProject.mutate(newProject, {
      onSuccess: () => { setProjectDialog(false); setNewProject({ name: "", description: "" }); },
    });
  };

  const handleApplyTemplate = (template: ProjectTemplate) => {
    createProject.mutate(
      { name: template.name, description: template.description || undefined },
      {
        onSuccess: (p: any) => {
          applyTemplate.mutate(
            { template_id: template.id, project_id: p.id },
            { onSuccess: () => navigate(`/projects/${p.id}`) }
          );
        },
      }
    );
  };

  const handleCreateTask = () => {
    if (!newTask.title.trim()) return;
    // Only assign project_id if user explicitly selected a project in the dialog OR if we're in a specific project view
    const pid = newTask.project_id || (selectedProject !== "inbox" && selectedProject !== "all" && !["tasks", "bugs", "features"].includes(selectedProject) ? selectedProject : undefined);
    
    const taskData = {
      title: newTask.title,
      description: newTask.description || undefined,
      priority: newTask.priority,
      type: newTask.type,
      status: "new", // Set default status to "new"
      project_id: pid,
      assigned_to: newTask.assigned_to || undefined,
      due_date: newTask.due_date || undefined,
      labels: newTask.labels.length > 0 ? newTask.labels : undefined,
    };
    
    console.log('Creating task with data:', taskData);
    console.log('Selected project context:', selectedProject);
    console.log('Task project_id from form:', newTask.project_id);
    console.log('Final project_id assigned:', pid);
    
    createTask.mutate(taskData as any, {
      onSuccess: (result) => {
        console.log('Task created successfully:', result);
        setTaskDialog(false);
        setNewTask({ title: "", description: "", priority: "normal", type: "task", project_id: "", assigned_to: "", due_date: "", labels: [] });
      },
      onError: (error) => {
        console.error('Task creation failed:', error);
      }
    });
  };

  const toggleGroup = (key: string) =>
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const getMember = (id: string | null) =>
    id ? (members.find((m) => m.id === id)?.full_name ?? null) : null;

  const getProjectStats = (pid: string) => {
    const pt = allTasks.filter((t) => t.project_id === pid);
    const done = pt.filter((t) => t.status === "completed").length;
    return { total: pt.length, done, progress: pt.length ? Math.round((done / pt.length) * 100) : 0 };
  };

  const isLoading = loadingProjects || loadingTasks;

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden -m-6 bg-background">

      {/* ══ SIDEBAR ══════════════════════════════════════════════════════════ */}
      <aside className="w-80 shrink-0 flex flex-col border-r border-border bg-card/50 overflow-hidden">

        {/* Sidebar header */}
        <div className="px-6 pt-6 pb-4 border-b border-border/60">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 flex items-center justify-center shadow-lg">
                <CheckCircle2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Tasks</h2>
                <p className="text-xs text-muted-foreground">Project management</p>
              </div>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg" onClick={() => setTaskDialog(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Create Task</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Quick filters */}
        <div className="px-6 py-4 space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">My Tasks</div>
          <SidebarItem
            icon={<User className="h-4 w-4" />}
            label="My Tasks"
            count={allTasks.filter((t) => t.assigned_to === "current_user_id").length}
            active={selectedProject === "my_tasks"}
            onClick={() => setSelectedProject("my_tasks")}
          />
          <SidebarItem
            icon={<Clock className="h-4 w-4" />}
            label="Overdue"
            count={allTasks.filter((t) => t.due_date && isPast(new Date(t.due_date)) && t.status !== "completed").length}
            active={selectedProject === "overdue"}
            onClick={() => setSelectedProject("overdue")}
          />
          <SidebarItem
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Completed"
            count={allTasks.filter((t) => t.status === "completed").length}
            active={selectedProject === "completed"}
            onClick={() => setSelectedProject("completed")}
          />
        </div>

        <div className="px-6">
          <div className="h-px bg-border/60" />
        </div>

        {/* Task types */}
        <div className="px-6 py-4">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Task Types</div>
          <div className="space-y-2">
            <SidebarItem
              icon={<CheckCircle2 className="h-4 w-4" />}
              label="All Tasks"
              count={allTasks.filter((t) => t.type === "task" || !t.type).length}
              active={selectedProject === "all_tasks"}
              onClick={() => setSelectedProject("all_tasks")}
            />
            <SidebarItem
              icon={<Flag className="h-4 w-4" />}
              label="Milestones"
              count={allTasks.filter((t) => t.type === "milestone").length}
              active={selectedProject === "milestones"}
              onClick={() => setSelectedProject("milestones")}
            />
          </div>
        </div>

        <div className="px-6">
          <div className="h-px bg-border/60" />
        </div>

        {/* Projects */}
        <div className="px-6 py-4 mb-2">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Projects</div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-foreground rounded-md" onClick={() => setProjectDialog(true)}>
                  <Plus className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">New Project</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Projects list */}
        <div className="flex-1 overflow-y-auto px-6 space-y-1 pb-6">
          {loadingProjects ? (
            <div className="px-3 py-4 text-sm text-muted-foreground flex items-center gap-2">
              <div className="h-3 w-3 animate-spin rounded-full border border-muted-foreground border-t-transparent" />
              Loading...
            </div>
          ) : projects.length === 0 ? (
            <button
              onClick={() => setProjectDialog(true)}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-200 border border-dashed border-border hover:border-muted-foreground/50"
            >
              <Plus className="h-4 w-4" /> Create your first project
            </button>
          ) : (
            projects.map((project) => {
              const s = getProjectStats(project.id);
              const color = getProjectColor(project);
              return (
                <SidebarProjectItem
                  key={project.id}
                  project={project}
                  color={color}
                  stats={s}
                  active={selectedProject === project.id}
                  onClick={() => setSelectedProject(project.id)}
                  onOpen={() => navigate(`/projects/${project.id}`)}
                />
              );
            })
          )}
        </div>
      </aside>

      {/* ══ MAIN CONTENT ═════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden bg-background">

        {/* Enhanced Top toolbar */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-border/60 bg-gradient-to-r from-background via-background to-muted/20 backdrop-blur-sm shrink-0">
          {/* Enhanced Breadcrumb / title */}
          <div className="flex items-center gap-6 min-w-0">
            {currentProject ? (
              <>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className={cn("h-4 w-4 rounded-lg", getProjectColor(currentProject))} />
                    <h1 className="text-2xl font-bold text-foreground truncate">{currentProject.name}</h1>
                  </div>
                  <Badge variant="outline" className="text-xs capitalize gap-2 px-3 py-1.5 bg-card border-border/60">
                    <span className={cn("h-2 w-2 rounded-full", PROJECT_STATUS_COLOR[currentProject.status] ?? "bg-muted")} />
                    {currentProject.status.replace(/_/g, " ")}
                  </Badge>
                </div>
                <Button variant="ghost" size="sm" className="h-9 text-sm text-muted-foreground gap-2 hover:text-foreground hover:bg-muted/60 rounded-xl" onClick={() => navigate(`/projects/${currentProject.id}`)}>
                  Open Project <ArrowUpRight className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-4">
                <h1 className="text-2xl font-bold text-foreground">
                  {selectedProject === "my_tasks" ? "My Tasks" : 
                   selectedProject === "overdue" ? "Overdue Tasks" :
                   selectedProject === "completed" ? "Completed Tasks" :
                   selectedProject === "all_tasks" ? "All Tasks" :
                   selectedProject === "milestones" ? "Milestones" : "Tasks"}
                </h1>
                <Badge variant="secondary" className="text-xs px-3 py-1.5 bg-primary/10 text-primary border-primary/20">
                  {filteredTasks.length} tasks
                </Badge>
              </div>
            )}
          </div>

          {/* Enhanced Right controls */}
          <div className="flex items-center gap-4 shrink-0">
            {/* Enhanced View switcher */}
            <div className="flex items-center bg-muted/60 rounded-2xl p-1.5 gap-1 border border-border/40 shadow-sm">
              {([
                { v: "list" as ViewMode,     icon: List,        tip: "List" },
                { v: "board" as ViewMode,    icon: FolderKanban, tip: "Kanban" },
                { v: "overview" as ViewMode, icon: LayoutGrid,  tip: "Overview" },
              ]).map(({ v, icon: Icon, tip }) => (
                <Tooltip key={v}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setView(v)}
                      className={cn(
                        "px-4 py-2.5 rounded-xl transition-all duration-200 flex items-center gap-2 font-medium",
                        view === v ? "bg-background shadow-md text-foreground border border-border/60" : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-sm hidden sm:block">{tip}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{tip}</TooltipContent>
                </Tooltip>
              ))}
            </div>

            {/* Enhanced Search */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input 
                className="pl-12 h-11 w-96 text-sm bg-muted/40 border-border/60 focus:bg-background focus:border-primary focus:ring-primary/20 rounded-2xl shadow-sm" 
                placeholder="Search tasks..." 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
              />
            </div>

            {/* Enhanced Filters */}
            <div className="flex items-center gap-3">
              <Select value={filters.assignee || "all"} onValueChange={(v) => setFilters(f => ({ ...f, assignee: v === "all" ? "all" : v }))}>
                <SelectTrigger className="h-11 w-40 text-sm border-border/60 rounded-2xl bg-background/50 shadow-sm">
                  <User className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Assignee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Assignees</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filters.priority || "all"} onValueChange={(v) => setFilters(f => ({ ...f, priority: v === "all" ? "all" : v }))}>
                <SelectTrigger className="h-11 w-36 text-sm border-border/60 rounded-2xl bg-background/50 shadow-sm">
                  <Flag className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  {PRIORITY_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button variant="outline" size="default" className="h-11 gap-2 text-sm border-border/60 rounded-2xl bg-background/50 shadow-sm" onClick={() => setTemplatesOpen(true)}>
              <FileText className="h-4 w-4" /> Templates
            </Button>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="default" className="h-11 px-4 border-border/60 rounded-2xl bg-background/50 shadow-sm" onClick={() => alert('Keyboard Shortcuts:\n\nC - Create Task\nP - Create Project\nCmd+K - Search\n1 - List View\n2 - Kanban View\n3 - Overview')}>
                  <span className="text-sm font-medium">?</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Keyboard Shortcuts</TooltipContent>
            </Tooltip>

            <Button size="default" className="h-11 gap-2 text-sm rounded-2xl shadow-md bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary" onClick={() => setTaskDialog(true)}>
              <Plus className="h-4 w-4" /> New Task
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden bg-background">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-4">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-sm text-muted-foreground font-medium">Loading your workspace...</p>
              </div>
            </div>
          ) : view === "list" ? (
            <ListView
              tasks={filteredTasks}
              projects={projects}
              members={members}
              collapsedGroups={collapsedGroups}
              onToggleGroup={toggleGroup}
              onStatusChange={(id, status) => updateTask.mutate({ id, status, completed_at: status === "completed" ? new Date().toISOString() : null } as any)}
              onDelete={(id) => deleteTask.mutate(id)}
              onNewTask={() => setTaskDialog(true)}
              getMember={getMember}
              selectedProject={selectedProject}
            />
          ) : view === "board" ? (
            <BoardView
              tasks={filteredTasks}
              projects={projects}
              members={members}
              onStatusChange={(id, status) => updateTask.mutate({ id, status, completed_at: status === "completed" ? new Date().toISOString() : null } as any)}
              onDelete={(id) => deleteTask.mutate(id)}
              onNewTask={() => setTaskDialog(true)}
              getMember={getMember}
              selectedProject={selectedProject}
            />
          ) : (
            <OverviewView
              projects={projects}
              allTasks={allTasks}
              getProjectStats={getProjectStats}
              getProjectColor={getProjectColor}
              onSelectProject={setSelectedProject}
              onOpenProject={(id) => navigate(`/projects/${id}`)}
              onNewProject={() => setProjectDialog(true)}
            />
          )}
        </div>
      </div>

      {/* ══ DIALOGS ══════════════════════════════════════════════════════════ */}
      <Dialog open={taskDialog} onOpenChange={setTaskDialog}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto border-0 shadow-2xl">
          <DialogHeader className="border-b border-border pb-4">
            <DialogTitle className="text-xl font-semibold text-foreground">Create New Task</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">Add a new task to track work and collaborate with your team</p>
          </DialogHeader>
          
          <div className="space-y-8 py-6">
            {/* Title Input */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Task Name</Label>
              <Input
                placeholder="Enter task name..."
                className="text-base h-12 border-border focus:border-primary focus:ring-primary/20 bg-background"
                value={newTask.title}
                onChange={(e) => setNewTask((t) => ({ ...t, title: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && handleCreateTask()}
                autoFocus
              />
            </div>
            
            {/* Description */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Description</Label>
              <Textarea
                placeholder="Add task description..."
                className="text-sm resize-none min-h-[120px] border-border focus:border-primary focus:ring-primary/20 bg-background"
                value={newTask.description}
                onChange={(e) => setNewTask((t) => ({ ...t, description: e.target.value }))}
                rows={5}
              />
            </div>

            {/* Properties Grid */}
            <div className="space-y-6">
              <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">Task Properties</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Task Type */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                    Type
                  </Label>
                  <Select value={newTask.type} onValueChange={(v) => setNewTask((t) => ({ ...t, type: v }))}>
                    <SelectTrigger className="h-11 border-border focus:border-primary focus:ring-primary/20 bg-background">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {ISSUE_TYPES.map((type) => {
                        const Icon = type.icon;
                        return (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center gap-2">
                              <Icon className={cn("h-4 w-4", type.color)} />
                              {type.label}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {/* Priority */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-orange-500"></div>
                    Priority
                  </Label>
                  <Select value={newTask.priority} onValueChange={(v) => setNewTask((t) => ({ ...t, priority: v }))}>
                    <SelectTrigger className="h-11 border-border focus:border-primary focus:ring-primary/20 bg-background">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((priority) => (
                        <SelectItem key={priority.value} value={priority.value}>
                          <div className="flex items-center gap-2">
                            <span className={cn("h-2 w-2 rounded-full", priority.dot)} />
                            {priority.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Project */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500"></div>
                    Project
                  </Label>
                  <Select value={newTask.project_id} onValueChange={(v) => setNewTask((t) => ({ ...t, project_id: v }))}>
                    <SelectTrigger className="h-11 border-border focus:border-primary focus:ring-primary/20 bg-background">
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No Project</SelectItem>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          <div className="flex items-center gap-2">
                            <span className={cn("h-2 w-2 rounded-sm", getProjectColor(project))} />
                            {project.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Assignee */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-purple-500"></div>
                    Assignee
                  </Label>
                  <Select value={newTask.assigned_to} onValueChange={(v) => setNewTask((t) => ({ ...t, assigned_to: v }))}>
                    <SelectTrigger className="h-11 border-border focus:border-primary focus:ring-primary/20 bg-background">
                      <SelectValue placeholder="Assign to..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Unassigned</SelectItem>
                      {members.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-5 w-5">
                              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                {getInitials(member.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            {member.full_name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Due Date */}
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-sm font-medium text-foreground flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-red-500"></div>
                    Due Date
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="h-11 w-full justify-start text-left font-normal border-border focus:border-primary focus:ring-primary/20 bg-background">
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {newTask.due_date ? format(new Date(newTask.due_date), "PPP") : "Select due date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={newTask.due_date ? new Date(newTask.due_date) : undefined}
                        onSelect={(date) => setNewTask((t) => ({ ...t, due_date: date ? date.toISOString().split('T')[0] : "" }))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-border pt-4">
            <Button variant="outline" onClick={() => setTaskDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTask} disabled={!newTask.title.trim()} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={projectDialog} onOpenChange={setProjectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">Create a new project to organize your tasks</p>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Project Name</Label>
              <Input
                placeholder="Enter project name..."
                className="h-11 border-border focus:border-primary focus:ring-primary/20 bg-background"
                value={newProject.name}
                onChange={(e) => setNewProject((p) => ({ ...p, name: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Description</Label>
              <Textarea
                placeholder="Project description (optional)..."
                className="resize-none min-h-[80px] border-border focus:border-primary focus:ring-primary/20 bg-background"
                value={newProject.description}
                onChange={(e) => setNewProject((p) => ({ ...p, description: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="border-t border-border pt-4">
            <Button variant="outline" onClick={() => setProjectDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateProject} disabled={!newProject.name.trim()} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProjectTemplatesDialog 
        open={templatesOpen} 
        onOpenChange={setTemplatesOpen}
        onApply={handleApplyTemplate}
      />

    </div>
  );
}

// ─── Sidebar Item ─────────────────────────────────────────────────────────────
function SidebarItem({ icon, label, count, active, onClick }: {
  icon: React.ReactNode; label: string; count?: number; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 text-left",
        active 
          ? "bg-primary/10 text-primary font-medium border border-primary/20" 
          : "text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent hover:border-border"
      )}
    >
      <span className={cn("shrink-0", active ? "text-primary" : "text-muted-foreground")}>{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && count > 0 && (
        <span className={cn(
          "text-xs tabular-nums px-1.5 py-0.5 rounded-full font-medium",
          active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
        )}>
          {count}
        </span>
      )}
    </button>
  );
}

// ─── Sidebar Project Item ─────────────────────────────────────────────────────
function SidebarProjectItem({ project, color, stats, active, onClick, onOpen }: {
  project: Project; color: string; stats: { total: number; done: number; progress: number };
  active: boolean; onClick: () => void; onOpen: () => void;
}) {
  return (
    <div className="group relative">
      <button
        onClick={onClick}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 text-left pr-8",
          active 
            ? "bg-primary/10 text-primary font-medium border border-primary/20" 
            : "text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent hover:border-border"
        )}
      >
        <span className={cn("h-2 w-2 rounded-full shrink-0", color)} />
        <span className="flex-1 truncate">{project.name}</span>
        {stats.total > 0 && (
          <span className={cn(
            "text-xs tabular-nums shrink-0 px-1.5 py-0.5 rounded-full font-medium",
            active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
          )}>
            {stats.done}/{stats.total}
          </span>
        )}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onOpen(); }}
        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
      >
        <ArrowUpRight className="h-3 w-3" />
      </button>
    </div>
  );
}

// ─── Board View ───────────────────────────────────────────────────────────────
function BoardView({ tasks, projects, members, onStatusChange, onDelete, onNewTask, getMember, selectedProject }: {
  tasks: Task[]; projects: Project[]; members: any[];
  onStatusChange: (id: string, s: string) => void; onDelete: (id: string) => void;
  onNewTask: () => void; getMember: (id: string | null) => string | null;
  selectedProject: string;
}) {
  const navigate = useNavigate();
  const createTask = useCreateTask();
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [newTaskInputs, setNewTaskInputs] = useState<Record<string, string>>({});
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const handleCreateQuickTask = (status: string, title: string) => {
    if (!title.trim()) return;
    const pid = selectedProject !== "my_tasks" && selectedProject !== "overdue" && selectedProject !== "completed" && !["all_tasks", "milestones"].includes(selectedProject) ? selectedProject : undefined;
    createTask.mutate({ title, status, project_id: pid, priority: "normal", type: "task" } as any, {
      onSuccess: () => setNewTaskInputs(prev => ({ ...prev, [status]: "" }))
    });
  };

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', task.id);
    
    // Add some visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedTask(null);
    setDragOverColumn(null);
    
    // Reset visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  };

  const handleDragOver = (e: React.DragEvent, columnStatus: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnStatus);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if we're leaving the column entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverColumn(null);
    }
  };

  const handleDrop = (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    
    if (draggedTask && draggedTask.status !== newStatus) {
      onStatusChange(draggedTask.id, newStatus);
      console.log(`Moved task "${draggedTask.title}" from ${draggedTask.status} to ${newStatus}`);
    }
    
    setDraggedTask(null);
  };

  const columns = STATUS_OPTIONS.map(status => ({
    ...status,
    tasks: tasks.filter(t => t.status === status.value)
  }));

  return (
    <div className="h-full overflow-hidden bg-background">
      <div className="flex gap-4 p-6 h-full overflow-x-auto">
        {columns.map((column) => {
          const StatusIcon = column.icon;
          const isDropTarget = dragOverColumn === column.value;
          const isDraggedTaskColumn = draggedTask?.status === column.value;
          
          return (
            <div 
              key={column.value} 
              className="flex-shrink-0 w-72 flex flex-col"
              onDragOver={(e) => handleDragOver(e, column.value)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.value)}
            >
              {/* Compact Column Header with Drop Indicator */}
              <div className={cn(
                "flex items-center justify-between mb-4 pb-3 border-b transition-all duration-200",
                isDropTarget 
                  ? "border-primary bg-primary/5 rounded-t-lg px-3 py-2" 
                  : "border-border/40"
              )}>
                <div className="flex items-center gap-2">
                  <div className={cn("p-1.5 rounded-lg transition-all", column.bg, isDropTarget && "scale-105")}>
                    <StatusIcon className={cn("h-3.5 w-3.5", column.color)} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-foreground">{column.label}</h3>
                    <p className="text-xs text-muted-foreground">
                      {column.tasks.length} tasks
                      {isDropTarget && draggedTask && " • Drop here"}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className={cn(
                  "text-xs font-medium px-2 py-0.5 transition-all",
                  isDropTarget && "bg-primary text-primary-foreground"
                )}>
                  {column.tasks.length}
                </Badge>
              </div>

              {/* Compact Tasks Container with Drop Zone */}
              <div className={cn(
                "flex-1 space-y-2 overflow-y-auto pb-3 rounded-lg transition-all duration-200 min-h-24",
                isDropTarget && "bg-primary/5 border-2 border-dashed border-primary/30 p-2"
              )}>
                {column.tasks.length === 0 && isDropTarget && (
                  <div className="flex items-center justify-center h-20 text-sm text-primary font-medium">
                    <div className="text-center">
                      <div className="h-6 w-6 mx-auto mb-1 rounded-full bg-primary/10 flex items-center justify-center">
                        <StatusIcon className="h-3 w-3 text-primary" />
                      </div>
                      Drop task here
                    </div>
                  </div>
                )}
                
                {column.tasks.map((task) => (
                  <BoardTaskCard
                    key={task.id}
                    task={task}
                    projects={projects}
                    getMember={getMember}
                    onStatusChange={onStatusChange}
                    onDelete={onDelete}
                    showProject={selectedProject === "all_tasks" || selectedProject === "my_tasks"}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    isDragging={draggedTask?.id === task.id}
                  />
                ))}

                {/* Compact Quick Add */}
                <div className="mt-3">
                  {newTaskInputs[column.value] !== undefined ? (
                    <div className="bg-card border border-border rounded-lg p-3 space-y-2">
                      <input
                        autoFocus
                        placeholder="Task name..."
                        className="w-full bg-transparent text-sm outline-none font-medium placeholder:text-muted-foreground"
                        value={newTaskInputs[column.value] || ""}
                        onChange={(e) => setNewTaskInputs(prev => ({ ...prev, [column.value]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleCreateQuickTask(column.value, newTaskInputs[column.value] || "");
                          }
                          if (e.key === "Escape") {
                            setNewTaskInputs(prev => ({ ...prev, [column.value]: undefined }));
                          }
                        }}
                        onBlur={() => {
                          if (newTaskInputs[column.value]?.trim()) {
                            handleCreateQuickTask(column.value, newTaskInputs[column.value] || "");
                          } else {
                            setNewTaskInputs(prev => ({ ...prev, [column.value]: undefined }));
                          }
                        }}
                      />
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Press Enter to create</span>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setNewTaskInputs(prev => ({ ...prev, [column.value]: "" }))}
                      className="w-full flex items-center gap-2 p-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all border border-dashed border-border hover:border-border/80"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add task
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Board Task Card ──────────────────────────────────────────────────────────
function BoardTaskCard({ task, projects, getMember, onStatusChange, onDelete, showProject, onDragStart, onDragEnd, isDragging }: {
  task: Task; projects: Project[]; getMember: (id: string | null) => string | null;
  onStatusChange: (id: string, s: string) => void; onDelete: (id: string) => void;
  showProject: boolean;
  onDragStart?: (e: React.DragEvent, task: Task) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  isDragging?: boolean;
}) {
  const navigate = useNavigate();
  const priorityOpt = PRIORITY_OPTIONS.find((p) => p.value === task.priority);
  const typeOpt = ISSUE_TYPES.find((t) => t.value === task.type) || ISSUE_TYPES[0];
  const project = projects.find((p) => p.id === task.project_id);
  const member = getMember(task.assigned_to);
  const overdue = task.due_date && isPast(new Date(task.due_date)) && task.status !== "completed";
  const TypeIcon = typeOpt.icon;

  const ticketId = `${project?.name?.toUpperCase().slice(0, 3) || 'TSK'}-${task.id.slice(-4).toUpperCase()}`;

  return (
    <div 
      className={cn(
        "bg-card border border-border rounded-lg p-3 transition-all duration-200 cursor-pointer group hover:border-primary/30 select-none",
        isDragging ? "opacity-50 scale-95 rotate-1 shadow-xl z-50" : "hover:shadow-sm",
        "transform-gpu" // Enable GPU acceleration for smoother animations
      )}
      draggable={true}
      onDragStart={(e) => onDragStart?.(e, task)}
      onDragEnd={onDragEnd}
      onClick={(e) => {
        // Don't navigate if we're dragging
        if (!isDragging) {
          navigate(`/tasks/${task.id}`);
        }
      }}
    >
      
      {/* Compact Header with Drag Handle */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          {/* Drag Handle */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-muted/50">
            <div className="flex flex-col gap-0.5">
              <div className="w-1 h-1 bg-muted-foreground/40 rounded-full"></div>
              <div className="w-1 h-1 bg-muted-foreground/40 rounded-full"></div>
              <div className="w-1 h-1 bg-muted-foreground/40 rounded-full"></div>
            </div>
          </div>
          
          <span className="text-xs font-mono text-muted-foreground font-medium">{ticketId}</span>
        </div>
        
        <Popover>
          <PopoverTrigger asChild>
            <button 
              onClick={(e) => e.stopPropagation()}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-all"
            >
              <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-32 p-1" align="end">
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </button>
          </PopoverContent>
        </Popover>
      </div>

      {/* Compact Title */}
      <h4 className={cn(
        "font-medium text-sm mb-2 line-clamp-2 leading-snug",
        task.status === "completed" ? "line-through text-muted-foreground" : "text-foreground"
      )}>
        {task.title}
      </h4>

      {/* Compact Labels */}
      {task.labels && task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.labels.slice(0, 2).map((label: string) => (
            <Badge key={label} variant="outline" className="text-xs px-1.5 py-0.5 bg-primary/5 border-primary/20 text-primary">
              {label}
            </Badge>
          ))}
          {task.labels.length > 2 && (
            <Badge variant="outline" className="text-xs px-1.5 py-0.5">
              +{task.labels.length - 2}
            </Badge>
          )}
        </div>
      )}

      {/* Compact Project */}
      {showProject && project && (
        <div className="flex items-center gap-1.5 mb-2 text-xs text-muted-foreground">
          <span className={cn("h-1.5 w-1.5 rounded-sm", getProjectColor(project))} />
          <span>{project.name}</span>
        </div>
      )}

      {/* Compact Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-border/40">
        <div className="flex items-center gap-1.5">
          {/* Priority */}
          <Badge variant="outline" className={cn("text-xs gap-1 px-1.5 py-0.5 border-0", priorityOpt?.bg)}>
            <span className={cn("h-1.5 w-1.5 rounded-full", priorityOpt?.dot)} />
            <span className="hidden sm:inline">{priorityOpt?.label}</span>
          </Badge>

          {/* Due Date */}
          {task.due_date && (
            <span className={cn(
              "text-xs px-1.5 py-0.5 rounded flex items-center gap-1",
              overdue ? "text-red-600 bg-red-50 font-medium" : "text-muted-foreground bg-muted/40"
            )}>
              {overdue && <AlertCircle className="h-2.5 w-2.5" />}
              {formatDue(task.due_date)}
            </span>
          )}
        </div>

        {/* Assignee */}
        {member ? (
          <Tooltip>
            <TooltipTrigger>
              <Avatar className="h-5 w-5 border border-border/40">
                <AvatarFallback className="text-xs bg-primary/10 text-primary font-medium">
                  {getInitials(member)}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>{member}</TooltipContent>
          </Tooltip>
        ) : (
          <div className="h-5 w-5 rounded-full bg-muted/40 flex items-center justify-center">
            <User className="h-2.5 w-2.5 text-muted-foreground/50" />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── List View ────────────────────────────────────────────────────────────────
function ListView({ tasks, projects, members, collapsedGroups, onToggleGroup, onStatusChange, onDelete, onNewTask, getMember, selectedProject }: {
  tasks: Task[]; projects: Project[]; members: any[]; collapsedGroups: Set<string>;
  onToggleGroup: (k: string) => void; onStatusChange: (id: string, s: string) => void;
  onDelete: (id: string) => void; onNewTask: () => void; getMember: (id: string | null) => string | null;
  selectedProject: string;
}) {
  const [inlineTitle, setInlineTitle] = useState("");
  const [inlineActive, setInlineActive] = useState<string | null>(null);
  const inlineRef = useRef<HTMLInputElement>(null);
  const createTask = useCreateTask();

  const handleInlineCreate = (status: string) => {
    if (!inlineTitle.trim()) { setInlineActive(null); return; }
    const pid = selectedProject !== "my_tasks" && selectedProject !== "overdue" && selectedProject !== "completed" && !["all_tasks", "milestones"].includes(selectedProject) ? selectedProject : undefined;
    createTask.mutate({ title: inlineTitle, status, project_id: pid, priority: "normal", type: "task" } as any, {
      onSuccess: () => { setInlineTitle(""); setInlineActive(null); },
    });
  };

  // Group by status
  const groups = STATUS_OPTIONS.map((s) => ({
    ...s,
    tasks: tasks.filter((t) => t.status === s.value),
  }));

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 px-8">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center border border-primary/10">
          <CheckCircle2 className="h-6 w-6 text-primary/40" />
        </div>
        <div className="text-center space-y-1">
          <h3 className="text-base font-semibold text-foreground">No tasks found</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            {selectedProject === "my_tasks" 
              ? "You don't have any assigned tasks. Tasks assigned to you will appear here."
              : selectedProject === "overdue"
              ? "No overdue tasks found. Great job staying on track!"
              : selectedProject === "completed"
              ? "No completed tasks yet. Completed tasks will appear here."
              : "No tasks have been created yet. Start by creating your first task."
            }
          </p>
        </div>
        <Button size="sm" className="gap-2 px-4 py-2 rounded-lg" onClick={onNewTask}>
          <Plus className="h-4 w-4" /> Create First Task
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden bg-background">
      {/* Compact Table Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/40">
        <div className="flex items-center gap-3 px-6 py-3 text-xs text-muted-foreground font-medium">
          <span className="w-5"></span> {/* Status */}
          <span className="w-20 text-xs">ID</span>
          <span className="flex-1 text-xs">Task Name</span>
          <span className="w-24 text-center hidden lg:block text-xs">Assignee</span>
          <span className="w-20 text-center hidden md:block text-xs">Priority</span>
          <span className="w-20 text-center hidden sm:block text-xs">Due</span>
          <span className="w-8" />
        </div>
      </div>

      {/* Content */}
      <div className="overflow-y-auto h-full">
        <div className="px-6 py-4 space-y-4">
          {groups.map((group) => {
            const isCollapsed = collapsedGroups.has(group.value);
            const StatusIcon = group.icon;
            return (
              <div key={group.value} className="space-y-1">
                {/* Compact Group Header */}
                <button
                  onClick={() => onToggleGroup(group.value)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-muted/30 transition-all duration-200 group/header border border-transparent hover:border-border/40 bg-card/30"
                >
                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", isCollapsed && "-rotate-90")} />
                  <div className={cn("p-1.5 rounded-lg", group.bg)}>
                    <StatusIcon className={cn("h-4 w-4", group.color)} />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{group.label}</span>
                      <Badge variant="secondary" className="text-xs font-medium px-2 py-0.5 h-5">
                        {group.tasks.length}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground/60 font-medium">
                    {group.tasks.length > 0 && `${Math.round((group.tasks.filter(t => t.status === 'completed').length / group.tasks.length) * 100)}%`}
                  </div>
                </button>

                {/* Compact Tasks */}
                {!isCollapsed && (
                  <div className="bg-card/20 rounded-lg border border-border/30">
                    {group.tasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        projects={projects}
                        getMember={getMember}
                        onStatusChange={onStatusChange}
                        onDelete={onDelete}
                        showProject={selectedProject === "all_tasks" || selectedProject === "my_tasks"}
                      />
                    ))}

                    {/* Compact Inline Add */}
                    {inlineActive === group.value ? (
                      <div className="flex items-center gap-3 px-4 py-2 border-t border-border/20 bg-muted/20">
                        <Circle className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                        <input
                          ref={inlineRef}
                          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60 font-medium"
                          placeholder="Task name..."
                          value={inlineTitle}
                          onChange={(e) => setInlineTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleInlineCreate(group.value);
                            if (e.key === "Escape") { setInlineActive(null); setInlineTitle(""); }
                          }}
                          onBlur={() => handleInlineCreate(group.value)}
                          autoFocus
                        />
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Enter to save</span>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setInlineActive(group.value)}
                        className="flex items-center gap-3 px-4 py-2 text-sm text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/20 transition-all duration-200 w-full border-t border-border/20 border-dashed hover:border-border/40"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span className="font-medium">Add task</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Task Row ─────────────────────────────────────────────────────────────────
function TaskRow({ task, projects, getMember, onStatusChange, onDelete, showProject }: {
  task: Task; projects: Project[]; getMember: (id: string | null) => string | null;
  onStatusChange: (id: string, s: string) => void; onDelete: (id: string) => void;
  showProject: boolean;
}) {
  const navigate = useNavigate();
  const [statusOpen, setStatusOpen] = useState(false);
  const statusOpt = STATUS_OPTIONS.find((s) => s.value === task.status);
  const priorityOpt = PRIORITY_OPTIONS.find((p) => p.value === task.priority);
  const typeOpt = ISSUE_TYPES.find((t) => t.value === task.type) || ISSUE_TYPES[0];
  const project = projects.find((p) => p.id === task.project_id);
  const member = getMember(task.assigned_to);
  const overdue = task.due_date && isPast(new Date(task.due_date)) && task.status !== "completed";
  const StatusIcon = statusOpt?.icon ?? Circle;
  const TypeIcon = typeOpt.icon;

  // Generate ticket ID (like TSK-1234)
  const ticketId = `${project?.name?.toUpperCase().slice(0, 3) || 'TSK'}-${task.id.slice(-4).toUpperCase()}`;

  return (
    <div className="flex items-center gap-3 px-4 py-2 hover:bg-muted/20 transition-all duration-150 group/row border-b border-border/20 last:border-b-0">
      {/* Compact status toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => {
              const idx = STATUS_OPTIONS.findIndex((s) => s.value === task.status);
              const next = STATUS_OPTIONS[(idx + 1) % STATUS_OPTIONS.length];
              onStatusChange(task.id, next.value);
            }}
            className={cn("shrink-0 transition-all duration-200 hover:scale-110 p-0.5 rounded", statusOpt?.color)}
          >
            <StatusIcon className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Click to advance status</TooltipContent>
      </Tooltip>

      {/* Compact Task ID */}
      <div className="w-20 shrink-0">
        <span className="text-xs font-mono text-muted-foreground font-medium">{ticketId}</span>
      </div>

      {/* Compact Title with project */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <button
          onClick={() => navigate(`/tasks/${task.id}`)}
          className={cn(
            "text-sm font-medium truncate hover:text-primary transition-colors cursor-pointer text-left flex-1",
            task.status === "completed" ? "line-through text-muted-foreground" : "text-foreground"
          )}
        >
          {task.title}
        </button>
        {showProject && project && (
          <span className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground/70 shrink-0 bg-muted/40 px-1.5 py-0.5 rounded border border-border/30">
            <span className={cn("h-1.5 w-1.5 rounded-sm", getProjectColor(project))} />
            {project.name}
          </span>
        )}
      </div>

      {/* Compact Assignee */}
      <div className="w-24 hidden lg:flex justify-center">
        {member ? (
          <Tooltip>
            <TooltipTrigger>
              <div className="flex items-center gap-1.5">
                <Avatar className="h-5 w-5 border border-border/40">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary font-medium">{getInitials(member)}</AvatarFallback>
                </Avatar>
                <span className="text-xs text-muted-foreground font-medium hidden xl:block">{member.split(' ')[0]}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>{member}</TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-muted-foreground/40 text-xs">—</span>
        )}
      </div>

      {/* Compact Priority */}
      <div className="w-20 hidden md:flex justify-center">
        <Badge variant="outline" className={cn("text-xs gap-1 px-1.5 py-0.5 h-5 border-0", priorityOpt?.bg)}>
          <span className={cn("h-1.5 w-1.5 rounded-full", priorityOpt?.dot)} />
          <span className="hidden lg:inline">{priorityOpt?.label}</span>
        </Badge>
      </div>

      {/* Compact Due Date */}
      <div className="w-20 hidden sm:flex justify-center">
        {task.due_date ? (
          <span className={cn(
            "text-xs px-1.5 py-0.5 rounded flex items-center gap-1",
            overdue ? "text-red-600 bg-red-50 font-medium" : "text-muted-foreground"
          )}>
            {overdue && <AlertCircle className="h-2.5 w-2.5" />}
            {formatDue(task.due_date)}
          </span>
        ) : (
          <span className="text-muted-foreground/40 text-xs">—</span>
        )}
      </div>

      {/* Compact Actions */}
      <div className="w-8 flex justify-center">
        <Popover>
          <PopoverTrigger asChild>
            <button className="opacity-0 group-hover/row:opacity-100 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-32 p-1" align="end">
            <button
              onClick={() => onDelete(task.id)}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </button>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

// ─── Overview View ────────────────────────────────────────────────────────────
function OverviewView({ projects, allTasks, getProjectStats, getProjectColor, onSelectProject, onOpenProject, onNewProject }: {
  projects: Project[]; allTasks: Task[];
  getProjectStats: (id: string) => { total: number; done: number; progress: number };
  getProjectColor: (p: Project) => string;
  onSelectProject: (id: string) => void; onOpenProject: (id: string) => void; onNewProject: () => void;
}) {
  const totalDone = allTasks.filter((t) => t.status === "completed").length;
  const totalOverdue = allTasks.filter((t) => t.due_date && isPast(new Date(t.due_date)) && t.status !== "completed").length;
  const inProgress = allTasks.filter((t) => t.status === "in_progress").length;
  const waiting = allTasks.filter((t) => t.status === "waiting").length;
  const pending = allTasks.filter((t) => t.status === "pending").length;
  const newTasks = allTasks.filter((t) => t.status === "new").length;

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="max-w-7xl mx-auto p-8 space-y-8">
        
        {/* Professional Header */}
        <div className="text-center py-6">
          <h1 className="text-2xl font-bold text-foreground mb-2">Workspace Overview</h1>
          <p className="text-muted-foreground">Track progress and manage your work efficiently</p>
        </div>

        {/* Professional Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { 
              label: "Total", 
              value: allTasks.length, 
              sub: "tasks", 
              icon: Hash,
            },
            { 
              label: "New", 
              value: newTasks, 
              sub: "new", 
              icon: Circle,
            },
            { 
              label: "Pending", 
              value: pending, 
              sub: "pending", 
              icon: Clock,
            },
            { 
              label: "In Progress", 
              value: inProgress, 
              sub: "active", 
              icon: Activity,
            },
            { 
              label: "Waiting", 
              value: waiting, 
              sub: "waiting", 
              icon: Eye,
            },
            { 
              label: "Completed", 
              value: totalDone, 
              sub: "done", 
              icon: CheckCircle2,
            },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="bg-card border border-border rounded-xl p-4 hover:shadow-sm transition-all">
                <div className="flex items-center justify-between mb-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground tabular-nums">{stat.value}</p>
                  <p className="text-sm font-medium text-foreground">{stat.label}</p>
                  <p className="text-xs text-muted-foreground">{stat.sub}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress Overview */}
        {allTasks.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-foreground">Overall Progress</h3>
                <p className="text-sm text-muted-foreground">Completion rate across all issues</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-foreground">{Math.round((totalDone / allTasks.length) * 100)}%</p>
                <p className="text-xs text-muted-foreground">completed</p>
              </div>
            </div>
            <Progress value={(totalDone / allTasks.length) * 100} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>{totalDone} completed</span>
              <span>{allTasks.length - totalDone} remaining</span>
            </div>
          </div>
        )}

        {/* Projects Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-foreground">Projects</h2>
              <p className="text-sm text-muted-foreground">Manage and track your project progress</p>
            </div>
            <Button variant="outline" size="default" className="gap-2" onClick={onNewProject}>
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          </div>

          {projects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-16 flex flex-col items-center gap-4 bg-muted/20">
              <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
                <FolderOpen className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="text-center">
                <h3 className="font-medium text-foreground mb-1">No projects yet</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-md">
                  Projects help you organize related issues and track progress towards larger goals.
                </p>
                <Button size="default" onClick={onNewProject} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create your first project
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {projects.map((project) => {
                const s = getProjectStats(project.id);
                const color = getProjectColor(project);
                const pt = allTasks.filter((t) => t.project_id === project.id);
                const byStatus = {
                  new: pt.filter((t) => t.status === "new").length,
                  pending: pt.filter((t) => t.status === "pending").length,
                  in_progress: pt.filter((t) => t.status === "in_progress").length,
                  waiting: pt.filter((t) => t.status === "waiting").length,
                  completed: pt.filter((t) => t.status === "completed").length,
                };
                const overdue = pt.filter((t) => t.due_date && isPast(new Date(t.due_date)) && t.status !== "completed").length;

                return (
                  <div
                    key={project.id}
                    onClick={() => onSelectProject(project.id)}
                    className="group rounded-xl border border-border bg-card hover:shadow-md transition-all cursor-pointer p-5 space-y-4"
                  >
                    {/* Project Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={cn("h-3 w-3 rounded-sm", color)} />
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-foreground truncate">{project.name}</h3>
                          <Badge variant="outline" className="text-xs mt-1 capitalize">
                            {project.status.replace(/_/g, " ")}
                          </Badge>
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); onOpenProject(project.id); }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                      >
                        <ArrowUpRight className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Description */}
                    {project.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                        {project.description}
                      </p>
                    )}

                    {/* Progress Section */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-foreground">Progress</span>
                        <span className="text-sm font-bold text-foreground">{s.progress}%</span>
                      </div>
                      <Progress value={s.progress} className="h-2" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{s.done} completed</span>
                        <span>{s.total} total</span>
                      </div>
                    </div>

                    {/* Status Breakdown */}
                    {s.total > 0 && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="text-center">
                            <div className="font-medium text-foreground">{byStatus.in_progress}</div>
                            <div className="text-muted-foreground">Active</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium text-foreground">{byStatus.waiting}</div>
                            <div className="text-muted-foreground">Waiting</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium text-foreground">{byStatus.completed}</div>
                            <div className="text-muted-foreground">Done</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <div className="flex items-center gap-2">
                        {overdue > 0 && (
                          <div className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded-md">
                            <AlertCircle className="h-3 w-3" />
                            {overdue} overdue
                          </div>
                        )}
                        {s.total === 0 && (
                          <span className="text-xs text-muted-foreground">No tasks yet</span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground font-medium">
                        {s.total} {s.total === 1 ? 'task' : 'tasks'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
