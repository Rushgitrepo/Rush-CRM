import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
  Circle, Clock, CheckCircle2, Calendar, Plus, GripVertical, Star,
  MoreHorizontal, Edit, Trash2,
} from "lucide-react";
import { format, isToday, isTomorrow, isPast } from "date-fns";
import { cn } from "@/lib/utils";
import { useUpdateTask, useDeleteTask, type Task } from "@/hooks/useTasks";
import { useAuth } from "@/contexts/AuthContext";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const COLUMNS = [
  { id: "new", label: "Inbox", icon: Circle, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/20" },
  { id: "in_progress", label: "In Progress", icon: Clock, color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-950/20" },
  { id: "completed", label: "Completed", icon: CheckCircle2, color: "text-green-500", bg: "bg-green-50 dark:bg-green-950/20" },
];

const PRIORITY_CONFIG = {
  low: { label: "Low", color: "text-gray-500", dot: "bg-gray-400" },
  normal: { label: "Normal", color: "text-blue-500", dot: "bg-blue-400" },
  high: { label: "High", color: "text-orange-500", dot: "bg-orange-400" },
  urgent: { label: "Urgent", color: "text-red-500", dot: "bg-red-500" },
};

interface TaskBoardViewProps {
  tasks: Task[];
  onEditTask?: (task: Task) => void;
  onCreateTask?: (status: string) => void;
  onToggleStar?: (task: Task) => void;
}

function TaskCard({ task, onEdit, onToggleStar }: { task: Task; onEdit?: (task: Task) => void; onToggleStar?: (task: Task) => void }) {
  const { profile, userRole } = useAuth();
  const isAdmin = userRole?.role === "admin" || userRole?.role === "super_admin";
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const [detailOpen, setDetailOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priority = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.normal;
  const isOverdue = task.due_date && isPast(new Date(task.due_date)) && task.status !== "completed";

  const formatDueDate = (date: string) => {
    const d = new Date(date);
    if (isToday(d)) return "Today";
    if (isTomorrow(d)) return "Tomorrow";
    return format(d, "MMM d");
  };

  const handleStatusChange = (newStatus: string) => {
    updateTask.mutate({ id: task.id, status: newStatus });
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "group p-4 rounded-xl border border-border bg-card hover:shadow-lg hover:border-primary/50 transition-all cursor-pointer",
          isDragging && "opacity-50"
        )}
        onClick={() => setDetailOpen(true)}
      >
        {/* Header row */}
        <div className="flex items-start gap-2 mb-3">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity mt-1"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>
          <div className="flex-1">
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-medium text-sm text-foreground flex-1">
                {task.title}
              </h4>
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleStar?.(task); }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Star className={cn("h-3.5 w-3.5", task.is_starred ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground")} />
                </button>
                {/* Dots menu */}
                {(task.created_by === profile?.id || task.assigned_to === profile?.id || (task as any).delegated_by === profile?.id) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" sideOffset={4} className="w-44">
                      <DropdownMenuItem onClick={() => onEdit?.(task)}>
                        <Edit className="h-4 w-4 mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleStatusChange("new")}>
                        <Circle className="h-4 w-4 mr-2 text-blue-500" /> Mark as Inbox
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleStatusChange("in_progress")}>
                        <Clock className="h-4 w-4 mr-2 text-orange-500" /> In Progress
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleStatusChange("completed")}>
                        <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" /> Completed
                      </DropdownMenuItem>
                      {task.created_by === profile?.id && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                            onClick={() => setTaskToDelete(true)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-3 ml-6">
            {task.description}
          </p>
        )}

        {/* Progress */}
        {task.progress !== undefined && task.progress > 0 && (
          <div className="mb-3 ml-6">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground">Progress</span>
              <span className="text-[10px] font-medium text-foreground">{task.progress}%</span>
            </div>
            <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
              <div
                className={cn("h-full transition-all", task.progress === 100 ? "bg-green-500" : "bg-primary")}
                style={{ width: `${task.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Meta */}
        <div className="flex items-center justify-between text-xs ml-6">
          <div className="flex items-center gap-2">
            {task.project_name && (
              <Badge variant="outline" className="text-xs">
                {task.project_name}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {task.due_date && (
              <span className={cn("flex items-center gap-1", isOverdue ? "text-red-500 font-medium" : "text-muted-foreground")}>
                <Calendar className="h-3 w-3" />
                {formatDueDate(task.due_date)}
              </span>
            )}
            {task.assigned_to_name && (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Avatar className="h-5 w-5">
                  {(task as any).assigned_to_avatar && <AvatarImage src={(task as any).assigned_to_avatar} alt={task.assigned_to_name} />}
                  <AvatarFallback className="text-[8px]">
                    {task.assigned_to_name.split(/\s+/).map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-[11px]">{task.assigned_to_name}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Detail Panel */}
      <TaskDetailPanel
        task={task}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={onEdit}
      />

      {/* Delete Dialog */}
      <AlertDialog open={taskToDelete} onOpenChange={setTaskToDelete}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>Are you sure? This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTask.mutate(task.id, { onSuccess: () => setTaskToDelete(false) })}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteTask.isPending ? "Deleting..." : "Yes, Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function DroppableColumn({
  column, tasks, onEditTask, onCreateTask, onToggleStar,
}: {
  column: typeof COLUMNS[0];
  tasks: Task[];
  onEditTask?: (task: Task) => void;
  onCreateTask?: (status: string) => void;
  onToggleStar?: (task: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const ColumnIcon = column.icon;

  return (
    <div className="flex-1 min-w-[320px] flex flex-col">
      <div className={cn("rounded-xl p-4 mb-4", column.bg)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ColumnIcon className={cn("h-5 w-5", column.color)} />
            <h3 className="font-semibold text-foreground">{column.label}</h3>
            <Badge variant="secondary" className="text-xs">{tasks.length}</Badge>
          </div>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => onCreateTask?.(column.id)}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={cn(
            "flex-1 space-y-3 overflow-y-auto min-h-[200px] p-2 rounded-lg border-2 border-dashed transition-colors",
            isOver ? "border-primary bg-primary/5" : "border-transparent"
          )}
        >
          {tasks.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Drop tasks here or click + to add
            </div>
          ) : (
            tasks.map((task) => (
              <TaskCard key={task.id} task={task} onEdit={onEditTask} onToggleStar={onToggleStar} />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export function TaskBoardView({ tasks, onEditTask, onCreateTask, onToggleStar }: TaskBoardViewProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const updateTask = useUpdateTask();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => setActiveId(event.active.id as string);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) { setActiveId(null); return; }

    const activeTask = tasks.find((t) => t.id === active.id);
    if (!activeTask) { setActiveId(null); return; }

    let targetStatus: string | null = null;
    if (COLUMNS.some((col) => col.id === over.id)) {
      targetStatus = over.id as string;
    } else {
      const overTask = tasks.find((t) => t.id === over.id);
      if (overTask) targetStatus = overTask.status;
    }

    if (targetStatus && activeTask.status !== targetStatus) {
      updateTask.mutate({ id: activeTask.id, status: targetStatus });
    }
    setActiveId(null);
  };

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-6 h-full overflow-x-auto pb-6">
        {COLUMNS.map((column) => (
          <DroppableColumn
            key={column.id}
            column={column}
            tasks={tasks.filter((t) => t.status === column.id)}
            onEditTask={onEditTask}
            onCreateTask={onCreateTask}
            onToggleStar={onToggleStar}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? (
          <div className="p-4 rounded-xl border border-border bg-card shadow-2xl rotate-3 scale-105">
            <h4 className="font-medium text-sm text-foreground">{activeTask.title}</h4>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
