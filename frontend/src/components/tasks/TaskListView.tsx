import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Circle, Clock, CheckCircle2, Flag, Calendar,
  MoreHorizontal, Star, Trash2, Edit,
} from "lucide-react";
import { format, isToday, isTomorrow, isPast } from "date-fns";
import { cn } from "@/lib/utils";
import { useUpdateTask, useDeleteTask, type Task } from "@/hooks/useTasks";

const STATUS_CONFIG = {
  new: { label: "New", icon: Circle, color: "text-blue-500" },
  in_progress: { label: "In Progress", icon: Clock, color: "text-orange-500" },
  completed: { label: "Completed", icon: CheckCircle2, color: "text-green-500" },
};

const PRIORITY_CONFIG = {
  low: { label: "Low", color: "text-gray-500", dot: "bg-gray-400" },
  normal: { label: "Normal", color: "text-blue-500", dot: "bg-blue-400" },
  high: { label: "High", color: "text-orange-500", dot: "bg-orange-400" },
  urgent: { label: "Urgent", color: "text-red-500", dot: "bg-red-500" },
};

interface TaskListViewProps {
  tasks: Task[];
  onEditTask?: (task: Task) => void;
}

export function TaskListView({ tasks, onEditTask }: TaskListViewProps) {
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const toggleTask = (taskId: string) => {
    const newSelected = new Set(selectedTasks);
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId);
    } else {
      newSelected.add(taskId);
    }
    setSelectedTasks(newSelected);
  };

  const handleToggleStar = (task: Task) => {
    updateTask.mutate({
      id: task.id,
      is_starred: !task.is_starred,
    });
  };

  const handleStatusChange = (task: Task, newStatus: string) => {
    updateTask.mutate({
      id: task.id,
      status: newStatus,
    });
  };

  const handleDelete = (taskId: string) => {
    if (confirm("Are you sure you want to delete this task?")) {
      deleteTask.mutate(taskId);
    }
  };

  const formatDueDate = (date: string) => {
    const d = new Date(date);
    if (isToday(d)) return "Today";
    if (isTomorrow(d)) return "Tomorrow";
    if (isPast(d)) return `Overdue · ${format(d, "MMM d")}`;
    return format(d, "MMM d");
  };

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-12">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No tasks found</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Create your first task to get started with project management
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => {
        const status = STATUS_CONFIG[task.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.new;
        const priority = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.normal;
        const StatusIcon = status.icon;
        const isOverdue = task.due_date && isPast(new Date(task.due_date)) && task.status !== "completed";

        return (
          <div
            key={task.id}
            className={cn(
              "group flex items-center gap-4 p-4 rounded-xl border transition-all hover:shadow-md",
              task.status === "completed"
                ? "bg-muted/30 border-border/50"
                : "bg-card border-border hover:border-primary/50"
            )}
          >
            {/* Checkbox */}
            <Checkbox
              checked={selectedTasks.has(task.id)}
              onCheckedChange={() => toggleTask(task.id)}
              className="shrink-0"
            />

            {/* Status Icon */}
            <div className={cn("shrink-0", status.color)}>
              <StatusIcon className="h-5 w-5" />
            </div>

            {/* Task Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <h3
                  className={cn(
                    "font-medium text-sm",
                    task.status === "completed"
                      ? "line-through text-muted-foreground"
                      : "text-foreground"
                  )}
                >
                  {task.title}
                </h3>

                {/* Priority Indicator */}
                <div className="flex items-center gap-1.5">
                  <div className={cn("h-2 w-2 rounded-full", priority.dot)} />
                  <span className={cn("text-xs font-medium", priority.color)}>
                    {priority.label}
                  </span>
                </div>
              </div>

              {/* Meta Info */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {task.project_name && (
                  <span className="flex items-center gap-1">
                    <div className={cn("h-2 w-2 rounded-full", task.project_color || "bg-primary")} />
                    {task.project_name}
                  </span>
                )}

                {task.due_date && (
                  <span
                    className={cn(
                      "flex items-center gap-1",
                      isOverdue && "text-red-500 font-medium"
                    )}
                  >
                    <Calendar className="h-3 w-3" />
                    {formatDueDate(task.due_date)}
                  </span>
                )}

                {task.assigned_to_name && (
                  <span className="flex items-center gap-1">
                    <Avatar className="h-4 w-4">
                      <AvatarFallback className="text-[8px]">
                        {task.assigned_to_name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {task.assigned_to_name}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0"
                onClick={() => handleToggleStar(task)}
              >
                <Star className={cn("h-4 w-4", task.is_starred && "fill-yellow-400 text-yellow-400")} />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEditTask?.(task)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleStatusChange(task, "new")}>
                    <Circle className="h-4 w-4 mr-2 text-blue-500" />
                    Mark as New
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleStatusChange(task, "in_progress")}>
                    <Clock className="h-4 w-4 mr-2 text-orange-500" />
                    Mark as In Progress
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleStatusChange(task, "completed")}>
                    <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                    Mark as Completed
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="text-destructive"
                    onClick={() => handleDelete(task.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        );
      })}
    </div>
  );
}
