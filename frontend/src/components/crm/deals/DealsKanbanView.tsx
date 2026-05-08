import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, MoreHorizontal, DollarSign, Calendar, GripVertical, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useUpdateDeal, useDeleteDeal } from "@/hooks/useCrmMutations";
import { useDealPipelineStages, useUpdateDealPipelineStage, useDeleteDealPipelineStage, useCreateDealPipelineStage } from "@/hooks/usePipelineStages";
import { DeleteConfirmationDialog } from "@/components/crm/DeleteConfirmationDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DealData {
  id: string;
  title: string;
  stage: string | null;
  status: string;
  value: number | null;
  probability: number | null;
  currency: string | null;
  expected_close_date: string | null;
  invoice_amount?: number | null;
  companies?: { name: string } | null;
  contacts?: { first_name: string; last_name?: string | null } | null;
}

// Replaced by useDealPipelineStages

interface DealsKanbanViewProps {
  deals?: DealData[];
  selectedStage?: string | null;
  onStageSelect?: (stage: string | null) => void;
}

export function DealsKanbanView({ deals = [], selectedStage, onStageSelect }: DealsKanbanViewProps) {
  const navigate = useNavigate();
  const updateDeal = useUpdateDeal();
  const deleteDeal = useDeleteDeal();
  const { data: pipelineStages = [] } = useDealPipelineStages();
  const updateStage = useUpdateDealPipelineStage();
  const deleteStage = useDeleteDealPipelineStage();
  
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [isEditStageOpen, setIsEditStageOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<{id: string, label: string, color: string, probability: number} | null>(null);
  const [editStageName, setEditStageName] = useState("");
  const [editStageColor, setEditStageColor] = useState("");
  const [editStageProb, setEditStageProb] = useState(0);
  const [stageToDelete, setStageToDelete] = useState<string | null>(null);
  const [dealToDelete, setDealToDelete] = useState<string | null>(null);

  const stages = pipelineStages.map(s => ({
    id: s.id,
    key: s.stage_key,
    name: s.stage_label,
    color: s.color || "bg-gray-500",
    prob: s.probability || 0,
    is_active: s.is_active
  })).filter(s => s.is_active !== false);

  const getStageDeals = (stageKey: string) =>
    deals.filter((d) => (d.stage || "drawings_received") === stageKey);

  const getStageTotalValue = (stageKey: string) =>
    getStageDeals(stageKey).reduce((sum, d) => sum + (Number(d.value) || 0), 0);

  const handleDragStart = (e: React.DragEvent, dealId: string) => {
    e.dataTransfer.setData("dealId", dealId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(stageId);
  };

  const handleDragLeave = () => setDragOverColumn(null);

  const handleDrop = (e: React.DragEvent, newStageKey: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    const dealId = e.dataTransfer.getData("dealId");
    if (!dealId) return;
    const deal = deals.find((d) => d.id === dealId);
    if (deal && deal.stage !== newStageKey) {
      const stageInfo = stages.find((s) => s.key === newStageKey);
      updateDeal.mutate({
        id: dealId,
        stage: newStageKey,
        probability: stageInfo?.prob ?? deal.probability,
      });
    }
  };

  const handleUpdateStage = () => {
    if (!editingStage || !editStageName.trim()) return;
    updateStage.mutate({ 
      id: editingStage.id, 
      stageName: editStageName,
      color: editStageColor,
      probability: editStageProb
    });
    setIsEditStageOpen(false);
    setEditingStage(null);
  };

  const handleHideStage = (id: string) => {
    updateStage.mutate({ id, is_active: false });
  };

  const handleDeleteStage = (id: string) => {
    setStageToDelete(id);
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {stages.map((stage) => {
        const stageDeals = getStageDeals(stage.key);
        if (selectedStage && selectedStage !== stage.key) return null;

        return (
          <div
            key={stage.id}
            className={cn(
              "flex-shrink-0 w-80 rounded-xl border transition-colors bg-muted/30",
              dragOverColumn === stage.id
                ? "border-primary bg-primary/5"
                : "border-border"
            )}
            onDragOver={(e) => handleDragOver(e, stage.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, stage.key)}
          >
            {/* Stage Header */}
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn("h-3 w-3 rounded-full", stage.color)} />
                  <span className="font-semibold">{stage.name}</span>
                  <Badge variant="secondary" className="ml-1">
                    {stageDeals.length}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => navigate("/crm/deals/create")}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => {
                        setEditingStage({ id: stage.id, label: stage.name, color: stage.color, probability: stage.prob });
                        setEditStageName(stage.name);
                        setEditStageColor(stage.color);
                        setEditStageProb(stage.prob);
                        setIsEditStageOpen(true);
                      }}>
                        Edit Stage
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleHideStage(stage.id)}>
                        Hide Stage
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={() => handleDeleteStage(stage.id)}
                      >
                        Delete Stage
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                ${(getStageTotalValue(stage.key) / 1000).toFixed(0)}k total
              </p>
            </div>

            {/* Deals */}
            <div className="p-2 space-y-2 max-h-[600px] overflow-y-auto">
              {stageDeals.map((deal) => {
                const companyName = deal.companies?.name || "";
                const prob = deal.probability ?? 0;
                const closeDate = deal.expected_close_date;

                return (
                  <div
                    key={deal.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, deal.id)}
                    className="rounded-lg border border-border bg-card p-4 cursor-grab active:cursor-grabbing hover:shadow-card transition-all group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div>
                          <h4
                            className="font-medium text-sm hover:text-primary cursor-pointer"
                            onClick={() => navigate(`/crm/deals/${deal.id}`)}
                          >
                            {deal.title}
                          </h4>
                          {companyName && (
                            <p className="text-xs text-muted-foreground">{companyName}</p>
                          )}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/crm/deals/${deal.id}`)}>
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDealToDelete(deal.id)}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <DollarSign className="h-4 w-4 text-success" />
                        <span className="font-semibold">
                          ${(Number(deal.value) || 0).toLocaleString()}
                        </span>
                      </div>

                      {/* Payment received indicator for Approved stage */}
                      {(deal.stage === "proposal_approved") && (() => {
                        const totalValue = Number(deal.value) || 0;
                        const invoicePaid = Number(deal.invoice_amount) || 0;
                        const paymentPct = totalValue > 0 ? Math.min(Math.round((invoicePaid / totalValue) * 100), 100) : 0;
                        const paymentLabel = paymentPct >= 100 ? "Full" : paymentPct > 0 ? "Partial" : "None";
                        return (
                          <div>
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-muted-foreground flex items-center gap-1">
                                <CreditCard className="h-3 w-3" />
                                {paymentLabel} Payment
                              </span>
                              <span className="font-medium">{paymentPct}%</span>
                            </div>
                            <Progress value={paymentPct} className="h-1.5" />
                          </div>
                        );
                      })()}

                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Probability</span>
                          <span className="font-medium">{prob}%</span>
                        </div>
                        <Progress value={prob} className="h-1.5" />
                      </div>

                      {closeDate && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground pt-2 border-t border-border">
                          <Calendar className="h-3 w-3" />
                          {new Date(closeDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {stageDeals.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No deals in this stage
                </div>
              )}
            </div>
          </div>
        );
      })}
      {/* Edit Stage Dialog */}
      <Dialog open={isEditStageOpen} onOpenChange={setIsEditStageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Deal Stage</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Stage Name</Label>
              <Input
                placeholder="Enter stage name..."
                value={editStageName}
                onChange={(e) => setEditStageName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Default Probability (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={editStageProb}
                onChange={(e) => setEditStageProb(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2 flex-wrap">
                {[
                  "bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5",
                  "bg-warning", "bg-success", "bg-primary", "bg-destructive", "bg-muted-foreground",
                  "bg-purple-500", "bg-orange-500", "bg-pink-500", "bg-blue-500", "bg-emerald-500"
                ].map((color) => (
                  <button
                    key={color}
                    className={cn(
                      "h-8 w-8 rounded-full border-2 transition-all",
                      color,
                      editStageColor === color ? "border-primary scale-110" : "border-transparent"
                    )}
                    onClick={() => setEditStageColor(color)}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditStageOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateStage}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmationDialog 
        open={!!stageToDelete}
        onOpenChange={(open) => !open && setStageToDelete(null)}
        onConfirm={() => {
          if (stageToDelete) {
            deleteStage.mutate(stageToDelete, {
              onSuccess: () => setStageToDelete(null)
            });
          }
        }}
        isLoading={deleteStage.isPending}
        title="Delete Pipeline Stage?"
        description="Are you sure you want to delete this stage? Deals in this stage will need to be moved manually."
      />

      <DeleteConfirmationDialog 
        open={!!dealToDelete}
        onOpenChange={(open) => !open && setDealToDelete(null)}
        onConfirm={() => {
          if (dealToDelete) {
            deleteDeal.mutate(dealToDelete, {
              onSuccess: () => setDealToDelete(null)
            });
          }
        }}
        isLoading={deleteDeal.isPending}
        title="Delete Deal?"
        description="Are you sure you want to delete this deal? This action cannot be undone."
      />
    </div>
  );
}
