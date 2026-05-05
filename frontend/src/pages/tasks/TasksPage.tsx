import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Plus, Search, Filter, LayoutGrid, List, Calendar as CalendarIcon,
  ChevronRight, Circle, Clock, CheckCircle2, AlertCircle,
  Inbox, Star, TrendingUp, X, FolderKanban, Command,
} from "lucide-react";
import {
  useProjects, useTasks, useCreateTask, useUpdateTask, useCreateProject, useUpdateProject,
  type Task, type Project,
} from "@/hooks/useTasks";
import { useOrganizationProfiles } from "@/hooks/useTenantQuery";
import { isToday, isTomorrow, isPast } from "date-fns";
import { cn } from "@/lib/utils";
import { TaskDialog } from "@/components/tasks/TaskDialog";
import { TaskListView } from "@/components/tasks/TaskListView";
import { TaskBoardView } from "@/components/tasks/TaskBoardView";
import { TaskCalendarView } from "@/components/tasks/TaskCalendarView";
import { ProjectDialog } from "@/components/tasks/ProjectDialog";
import { CommandMenu } from "@/components/tasks/CommandMenu";

type ViewMode = "list" | "board" | "calendar";
type FilterView = "inbox" | "today" | "upcoming" | "starred" | "all";

interface AdvancedFilters {
  status: string[];
  priority: string[];
  assignee: string[];
}

export default function TasksPage() {
  const navigate = useNavigate();
  const [view, setView] = useState<ViewMode>("list");
  const [filterView, setFilterView] = useState<FilterView>("inbox");
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [newTaskStatus, setNewTaskStatus] = useState<string | null>(null);
  const [newTaskDate, setNewTaskDate] = useState<Date | null>(null);
  const [showCommandMenu, setShowCommandMenu] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
    status: [],
    priority: [],
    assignee: [],
  });

  const { data: projects = [] } = useProjects();
  const { data: allTasks = [] } = useTasks();
  const { data: members = [] } = useOrganizationProfiles();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K for command menu
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowCommandMenu(true);
      }
      // Cmd/Ctrl + N for new task
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        setShowTaskDialog(true);
      }
      // Cmd/Ctrl + P for new project
      if ((e.metaKey || e.ctrlKey) && e.key === "p") {
        e.preventDefault();
        setShowProjectDialog(true);
      }
      // 1, 2, 3 for view switching (only if not typing)
      const target = e.target as HTMLElement;
      if (!target.matches("input, textarea") && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (e.key === "1") setView("list");
        if (e.key === "2") setView("board");
        if (e.key === "3") setView("calendar");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Filter tasks based on current view and advanced filters
  const filteredTasks = useMemo(() => {
    return allTasks.filter((task) => {
      // Search filter
      if (search && !task.title.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }

      // Project filter
      if (selectedProject && task.project_id !== selectedProject) {
        return false;
      }

      // Advanced filters
      if (advancedFilters.status.length > 0 && !advancedFilters.status.includes(task.status)) {
        return false;
      }
      if (advancedFilters.priority.length > 0 && !advancedFilters.priority.includes(task.priority)) {
        return false;
      }
      if (advancedFilters.assignee.length > 0 && task.assigned_to && !advancedFilters.assignee.includes(task.assigned_to)) {
        return false;
      }

      // View filter
      if (filterView === "inbox" && task.status !== "new") {
        return false;
      }
      if (filterView === "today" && task.due_date && !isToday(new Date(task.due_date))) {
        return false;
      }
      if (filterView === "upcoming" && task.due_date && !isTomorrow(new Date(task.due_date))) {
        return false;
      }
      if (filterView === "starred" && !task.is_starred) {
        return false;
      }

      return true;
    });
  }, [allTasks, search, selectedProject, advancedFilters, filterView]);

  const stats = {
    total: allTasks.length,
    completed: allTasks.filter(t => t.status === "completed").length,
    inProgress: allTasks.filter(t => t.status === "in_progress").length,
    overdue: allTasks.filter(t => t.due_date && isPast(new Date(t.due_date)) && t.status !== "completed").length,
  };

  const handleCreateTask = (data: any) => {
    const cleanData = {
      ...data,
      status: newTaskStatus || data.status || "new",
      due_date: newTaskDate ? newTaskDate.toISOString() : (data.due_date || null),
      project_id: data.project_id || null,
      assigned_to: data.assigned_to || null,
    };
    
    createTask.mutate(cleanData, {
      onSuccess: () => {
        setShowTaskDialog(false);
        setNewTaskStatus(null);
        setNewTaskDate(null);
      },
    });
  };

  const handleUpdateTask = (data: any) => {
    if (!editingTask) return;
    
    const cleanData = {
      ...data,
      project_id: data.project_id || null,
      assigned_to: data.assigned_to || null,
      due_date: data.due_date || null,
    };
    
    updateTask.mutate(
      { id: editingTask.id, ...cleanData },
      {
        onSuccess: () => {
          setShowTaskDialog(false);
          setEditingTask(null);
        },
      }
    );
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setNewTaskStatus(null);
    setNewTaskDate(null);
    setShowTaskDialog(true);
  };

  const handleCreateTaskWithStatus = (status: string) => {
    setNewTaskStatus(status);
    setNewTaskDate(null);
    setEditingTask(null);
    setShowTaskDialog(true);
  };

  const handleCreateTaskWithDate = (date: Date) => {
    setNewTaskDate(date);
    setNewTaskStatus(null);
    setEditingTask(null);
    setShowTaskDialog(true);
  };

  const handleCloseDialog = () => {
    setShowTaskDialog(false);
    setEditingTask(null);
    setNewTaskStatus(null);
    setNewTaskDate(null);
  };

  const handleCreateProject = (data: any) => {
    createProject.mutate(data, {
      onSuccess: () => {
        setShowProjectDialog(false);
      },
    });
  };

  const handleUpdateProject = (data: any) => {
    if (!editingProject) return;

    updateProject.mutate(
      { id: editingProject.id, ...data },
      {
        onSuccess: () => {
          setShowProjectDialog(false);
          setEditingProject(null);
        },
      }
    );
  };

  const handleCloseProjectDialog = () => {
    setShowProjectDialog(false);
    setEditingProject(null);
  };

  const toggleFilter = (type: keyof AdvancedFilters, value: string) => {
    setAdvancedFilters((prev) => {
      const current = prev[type];
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [type]: updated };
    });
  };

  const clearFilters = () => {
    setAdvancedFilters({ status: [], priority: [], assignee: [] });
  };

  const hasActiveFilters = 
    advancedFilters.status.length > 0 || 
    advancedFilters.priority.length > 0 || 
    advancedFilters.assignee.length > 0;

  return (
    <div className="flex h-[calc(100vh-4rem)] -m-6 bg-background">
      {/* Sidebar */}
      <aside className="w-72 border-r border-border bg-card/30 flex flex-col">
        {/* Sidebar Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg">
                <CheckCircle2 className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Tasks</h2>
                <p className="text-xs text-muted-foreground">{stats.total} total</p>
              </div>
            </div>
          </div>

          <Button 
            className="w-full gap-2 shadow-md" 
            onClick={() => setShowTaskDialog(true)}
          >
            <Plus className="h-4 w-4" />
            New Task
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="p-6 space-y-3 border-b border-border">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
              <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
              <div className="text-xs text-blue-600/70">In Progress</div>
            </div>
            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
              <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
              <div className="text-xs text-green-600/70">Completed</div>
            </div>
          </div>
          {stats.overdue > 0 && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-bold text-red-600">{stats.overdue}</div>
                  <div className="text-xs text-red-600/70">Overdue Tasks</div>
                </div>
                <AlertCircle className="h-5 w-5 text-red-500" />
              </div>
            </div>
          )}
        </div>

        {/* Views */}
        <div className="p-6 space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Views
          </div>
          <SidebarButton
            icon={<Inbox className="h-4 w-4" />}
            label="Inbox"
            count={allTasks.filter(t => t.status === "new").length}
            active={filterView === "inbox"}
            onClick={() => setFilterView("inbox")}
          />
          <SidebarButton
            icon={<CalendarIcon className="h-4 w-4" />}
            label="Today"
            count={allTasks.filter(t => t.due_date && isToday(new Date(t.due_date))).length}
            active={filterView === "today"}
            onClick={() => setFilterView("today")}
          />
          <SidebarButton
            icon={<TrendingUp className="h-4 w-4" />}
            label="Upcoming"
            count={allTasks.filter(t => t.due_date && isTomorrow(new Date(t.due_date))).length}
            active={filterView === "upcoming"}
            onClick={() => setFilterView("upcoming")}
          />
          <SidebarButton
            icon={<Star className="h-4 w-4" />}
            label="Starred"
            count={allTasks.filter(t => t.is_starred).length}
            active={filterView === "starred"}
            onClick={() => setFilterView("starred")}
          />
        </div>

        {/* Projects */}
        <div className="flex-1 overflow-y-auto p-6 space-y-2">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Projects
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={() => setShowProjectDialog(true)}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>

          {projects.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              No projects yet
            </div>
          ) : (
            projects.map((project) => {
              const projectTasks = allTasks.filter(t => t.project_id === project.id);
              const completedCount = projectTasks.filter(t => t.status === "completed").length;
              const progress = projectTasks.length > 0 
                ? Math.round((completedCount / projectTasks.length) * 100) 
                : 0;

              return (
                <button
                  key={project.id}
                  onClick={() => setSelectedProject(project.id === selectedProject ? null : project.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left",
                    selectedProject === project.id
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted text-foreground"
                  )}
                >
                  <div className={cn("h-2 w-2 rounded-full", project.color || "bg-primary")} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{project.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {projectTasks.length} tasks · {progress}%
                    </div>
                  </div>
                  <ChevronRight className={cn(
                    "h-4 w-4 transition-transform",
                    selectedProject === project.id && "rotate-90"
                  )} />
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="border-b border-border bg-card/50 backdrop-blur-sm">
          <div className="px-8 py-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-foreground mb-1">
                  {filterView === "inbox" ? "Inbox" :
                   filterView === "today" ? "Today" :
                   filterView === "upcoming" ? "Upcoming" :
                   filterView === "starred" ? "Starred" : "All Tasks"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {filteredTasks.length} {filteredTasks.length === 1 ? "task" : "tasks"}
                </p>
              </div>

              {/* View Switcher */}
              <div className="flex items-center gap-2 bg-muted/50 rounded-xl p-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setView("list")}
                      className={cn(
                        "px-4 py-2 rounded-lg transition-all",
                        view === "list"
                          ? "bg-background shadow-sm text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <List className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>List View (1)</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setView("board")}
                      className={cn(
                        "px-4 py-2 rounded-lg transition-all",
                        view === "board"
                          ? "bg-background shadow-sm text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Board View (2)</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setView("calendar")}
                      className={cn(
                        "px-4 py-2 rounded-lg transition-all",
                        view === "calendar"
                          ? "bg-background shadow-sm text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <CalendarIcon className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Calendar View (3)</TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="task-search"
                  placeholder="Search tasks... (⌘K)"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 bg-background"
                />
              </div>

              <Popover open={showFilters} onOpenChange={setShowFilters}>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className={cn("gap-2", hasActiveFilters && "border-primary")}
                  >
                    <Filter className="h-4 w-4" />
                    Filters
                    {hasActiveFilters && (
                      <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center">
                        {advancedFilters.status.length + advancedFilters.priority.length + advancedFilters.assignee.length}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="end">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-sm">Filters</h4>
                      {hasActiveFilters && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearFilters}
                          className="h-auto p-1 text-xs"
                        >
                          Clear all
                        </Button>
                      )}
                    </div>

                    {/* Status Filter */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Status</label>
                      <div className="flex flex-wrap gap-2">
                        {["new", "in_progress", "completed"].map((status) => (
                          <Badge
                            key={status}
                            variant={advancedFilters.status.includes(status) ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => toggleFilter("status", status)}
                          >
                            {status === "new" ? "New" : status === "in_progress" ? "In Progress" : "Completed"}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Priority Filter */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Priority</label>
                      <div className="flex flex-wrap gap-2">
                        {["low", "normal", "high", "urgent"].map((priority) => (
                          <Badge
                            key={priority}
                            variant={advancedFilters.priority.includes(priority) ? "default" : "outline"}
                            className="cursor-pointer capitalize"
                            onClick={() => toggleFilter("priority", priority)}
                          >
                            {priority}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Assignee Filter */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Assignee</label>
                      <Select
                        value=""
                        onValueChange={(value) => toggleFilter("assignee", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select assignee..." />
                        </SelectTrigger>
                        <SelectContent>
                          {members.map((member) => (
                            <SelectItem key={member.id} value={member.id}>
                              {member.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {advancedFilters.assignee.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {advancedFilters.assignee.map((assigneeId) => {
                            const member = members.find((m) => m.id === assigneeId);
                            return (
                              <Badge key={assigneeId} variant="secondary" className="gap-1">
                                {member?.full_name || "Unknown"}
                                <X
                                  className="h-3 w-3 cursor-pointer"
                                  onClick={() => toggleFilter("assignee", assigneeId)}
                                />
                              </Badge>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-8">
          {view === "list" ? (
            <TaskListView tasks={filteredTasks} onEditTask={handleEditTask} />
          ) : view === "board" ? (
            <TaskBoardView 
              tasks={filteredTasks} 
              onEditTask={handleEditTask}
              onCreateTask={handleCreateTaskWithStatus}
            />
          ) : (
            <TaskCalendarView 
              tasks={filteredTasks}
              onEditTask={handleEditTask}
              onCreateTask={handleCreateTaskWithDate}
            />
          )}
        </div>
      </div>

      {/* Task Dialog */}
      <TaskDialog
        open={showTaskDialog}
        onOpenChange={handleCloseDialog}
        projects={projects}
        members={members}
        task={editingTask}
        initialStatus={newTaskStatus || undefined}
        initialDate={newTaskDate || undefined}
        onSubmit={editingTask ? handleUpdateTask : handleCreateTask}
      />

      {/* Project Dialog */}
      <ProjectDialog
        open={showProjectDialog}
        onOpenChange={handleCloseProjectDialog}
        project={editingProject}
        onSubmit={editingProject ? handleUpdateProject : handleCreateProject}
      />

      {/* Command Menu */}
      <CommandMenu
        open={showCommandMenu}
        onOpenChange={setShowCommandMenu}
        onCreateTask={() => setShowTaskDialog(true)}
        onCreateProject={() => setShowProjectDialog(true)}
        onChangeView={setView}
        onChangeFilter={setFilterView}
      />
    </div>
  );
}

// Sidebar Button Component
function SidebarButton({
  icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      )}
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      {count !== undefined && count > 0 && (
        <Badge variant="secondary" className="text-xs">
          {count}
        </Badge>
      )}
    </button>
  );
}
