import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MoreHorizontal, Plus, Building2, GripVertical, Phone, Mail, X, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useUpdateLead, useDeleteLead, useConvertLeadToDeal } from "@/hooks/useCrmMutations";
import { usePipelineStages, useCreatePipelineStage, useDeletePipelineStage } from "@/hooks/usePipelineStages";
import { ClickToCall } from "@/components/telephony/ClickToCall";
import { cn } from "@/lib/utils";

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  status: string;
  source: string;
  value: number;
  assignee?: {
    name?: string;
    avatar?: string;
    initials?: string;
  };
  createdAt: string;
}

interface Column {
  id: string;
  title: string;
  color: string;
  isCustom?: boolean;
}

interface LeadsKanbanViewProps {
  leads: Lead[];
  onCreateLead?: () => void;
}

const defaultColumns: Column[] = [
  { id: "new", title: "New", color: "bg-chart-1" },
  { id: "contacted", title: "Contacted", color: "bg-warning" },
  { id: "qualified", title: "Qualified", color: "bg-success" },
  { id: "proposal", title: "Proposal Sent", color: "bg-purple-500" },
  { id: "negotiation", title: "Negotiation", color: "bg-orange-500" },
  { id: "unqualified", title: "Unqualified", color: "bg-muted-foreground" },
];

const colorOptions = [
  "bg-chart-1", "bg-warning", "bg-success", "bg-purple-500", 
  "bg-orange-500", "bg-blue-500", "bg-pink-500", "bg-indigo-500",
  "bg-teal-500", "bg-red-500", "bg-yellow-500", "bg-green-500"
];

export function LeadsKanbanView({ leads, onCreateLead }: LeadsKanbanViewProps) {
  const navigate = useNavigate();
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();
  const convertLead = useConvertLeadToDeal();
  const { data: pipelineStages = [], isLoading, error } = usePipelineStages();
  const createStage = useCreatePipelineStage();
  const deleteStage = useDeletePipelineStage();
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [isAddStageOpen, setIsAddStageOpen] = useState(false);
  const [newStageTitle, setNewStageTitle] = useState("");
  const [selectedColor, setSelectedColor] = useState(colorOptions[0]);

  // Always show default columns, add custom stages if available
  const columns = [
    ...defaultColumns,
    ...(pipelineStages || []).map(stage => ({
      id: stage.stage_key || stage.id,
      title: stage.stage_label || stage.name,
      color: stage.color || "bg-gray-500",
      isCustom: true
    }))
  ];

  // Debug logging
  console.log('Pipeline stages:', pipelineStages);
  console.log('Columns:', columns);
  console.log('Loading:', isLoading, 'Error:', error);

  const getInitials = (lead: Lead) => {
    const source =
      lead.assignee?.initials ||
      lead.assignee?.name ||
      lead.name ||
      lead.email ||
      lead.company ||
      "Lead";

    return (
      source
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || "")
        .join("") || "LD"
    );
  };

  const getLeadsByStatus = (status: string) =>
    leads.filter((lead) => lead.status === status);

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData("leadId", leadId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => setDragOverColumn(null);

  const handleDrop = (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    const leadId = e.dataTransfer.getData("leadId");
    if (!leadId) return;
    const lead = leads.find((l) => l.id === leadId);
    if (lead && lead.status !== newStatus) {
      updateLead.mutate({ id: leadId, status: newStatus, stage: newStatus });
    }
  };

  const handleAddStage = () => {
    if (!newStageTitle.trim()) return;
    createStage.mutate({ stageName: newStageTitle });
    setNewStageTitle("");
    setSelectedColor(colorOptions[0]);
    setIsAddStageOpen(false);
  };

  const handleDeleteStage = (columnId: string) => {
    // Find the stage to delete
    const stageToDelete = pipelineStages.find(stage => 
      (stage.stage_key || stage.id) === columnId
    );
    if (stageToDelete) {
      deleteStage.mutate(stageToDelete.id);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Lead Pipeline</h2>
        <Dialog open={isAddStageOpen} onOpenChange={setIsAddStageOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Stage
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Custom Stage</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="stage-title">Stage Title</Label>
                <Input
                  id="stage-title"
                  value={newStageTitle}
                  onChange={(e) => setNewStageTitle(e.target.value)}
                  placeholder="Enter stage name"
                />
              </div>
              <div>
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={cn(
                        "w-6 h-6 rounded-full border-2",
                        color,
                        selectedColor === color ? "border-foreground" : "border-transparent"
                      )}
                    />
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsAddStageOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddStage}>
                  Add Stage
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((column) => {
        const columnLeads = getLeadsByStatus(column.id);
        const totalValue = columnLeads.reduce((sum, lead) => sum + lead.value, 0);

        return (
          <div
            key={column.id}
            className={cn(
              "flex-shrink-0 w-80 bg-white rounded-xl border border-slate-200 transition-colors shadow-sm",
              dragOverColumn === column.id
                ? "border-primary bg-slate-50"
                : "border-slate-200"
            )}
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            {/* Column Header */}
            <div className="p-4 border-b border-slate-200 bg-slate-50/70">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${column.color}`} />
                  <h3 className="font-semibold text-slate-800">{column.title}</h3>
                  <Badge variant="secondary" className="rounded-full">
                    {columnLeads.length}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={onCreateLead}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  {column.isCustom && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteStage(column.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                ${totalValue.toLocaleString()} total value
              </p>
            </div>

            {/* Column Content */}
            <div className="p-2 space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto">
              {columnLeads.map((lead) => (
                <div
                  key={lead.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, lead.id)}
                  className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing group"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {getInitials(lead)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p
                          className="font-medium text-sm text-slate-800 hover:text-slate-950 cursor-pointer"
                          onClick={() => navigate(`/crm/leads/${lead.id}`)}
                        >
                          {lead.name}
                        </p>
                        {lead.email && (
                          <a 
                            href={`mailto:${lead.email}`} 
                            className="text-xs text-slate-500 hover:text-slate-700 hover:underline transition-colors truncate block"
                          >
                            {lead.email}
                          </a>
                        )}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <MoreHorizontal className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="border-slate-200 bg-white shadow-lg">
                        <DropdownMenuItem onClick={() => navigate(`/crm/leads/${lead.id}`)}>
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => convertLead.mutate(lead.id)}>
                          Convert to Deal
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => deleteLead.mutate(lead.id)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="space-y-2">
                    {lead.company && (
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <Building2 className="h-3 w-3" />
                        {lead.company}
                      </div>
                    )}
                    {lead.phone && (
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <Phone className="h-3 w-3" />
                        <ClickToCall 
                          phoneNumber={lead.phone} 
                          entityType="lead" 
                          entityId={lead.id} 
                          className="text-slate-500 hover:text-slate-700 hover:underline transition-colors truncate block" 
                        />
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        {lead.source || "—"}
                      </Badge>
                      <span className="text-sm font-semibold text-slate-800">
                        ${lead.value.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {columnLeads.length === 0 && (
                <div className="text-center py-8 text-slate-500 text-sm">
                  No leads in this stage
                </div>
              )}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}

