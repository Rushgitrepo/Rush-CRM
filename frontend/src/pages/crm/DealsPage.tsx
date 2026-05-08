import { useMemo, useState, useEffect, Suspense, lazy } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Sparkles, Phone, Mail, Building2, Layers, MoreHorizontal, Edit, Trash2, Eye, Download, Upload, XCircle } from "lucide-react";
import { useDeals, useDeleteDeal, useBulkDeleteDeals } from "@/hooks/useCrmData";
import { useUpdateDeal } from "@/hooks/useCrmMutations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/crm/ui/PageHeader";
import { DataToolbar } from "@/components/crm/ui/DataToolbar";
import { EntityTable, EntityColumn } from "@/components/crm/ui/EntityTable";
import { EmptyState } from "@/components/crm/ui/EmptyState";
import { useCustomDialog } from "@/contexts/DialogContext";
import { DealsKanbanView } from "@/components/crm/deals/DealsKanbanView";
import { DealsActivitiesView } from "@/components/crm/deals/DealsActivitiesView";
import { DealsCalendarView } from "@/components/crm/deals/DealsCalendarView";
import { toast } from "sonner";
import { ClickToCall } from "@/components/telephony/ClickToCall";
import { useDealPipelineStages } from "@/hooks/usePipelineStages";

const WorkflowsPage = lazy(() => import("@/pages/automation/WorkflowsPage"));

type ViewType = "kanban" | "list" | "activities" | "calendar" | "automation";

const statusTone = (status?: string) => {
  const s = (status || "").toLowerCase();
  if (s === "won" || s.includes("close")) return "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50";
  if (s === "lost" || s.includes("lost")) return "bg-rose-500/10 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/50";
  if (s.includes("proposal")) return "bg-primary/10 dark:bg-primary/20 text-primary border-primary/20 dark:border-primary/50";
  return "bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/50";
};

type DealRow = {
  id: string;
  name: string;
  stage: string;
  status: string;
  value: number;
  company: string;
  contact: string;
  email: string;
  phone: string;
  createdAt: string;
  projectType?: string;
};

export default function DealsPage() {
  const navigate = useNavigate();
  const { confirm } = useCustomDialog();
  const [view, setView] = useState<ViewType>("list");
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("all");
  const [status, setStatus] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [selectedDeals, setSelectedDeals] = useState<string[]>([]);
  const [pageSize, setPageSize] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const [isAllSelectedGlobally, setIsAllSelectedGlobally] = useState(false);

  const { data: dbDeals, isLoading, isError } = useDeals({
    search,
    stage: stage !== "all" ? stage : undefined,
    status: status !== "all" ? status : undefined,
    page: currentPage,
    limit: pageSize
  });
  const { data: pipelineStages = [] } = useDealPipelineStages();
  const deleteDeal = useDeleteDeal();
  const bulkDeleteDeals = useBulkDeleteDeals();
  const updateDeal = useUpdateDeal();


  const handleBulkDelete = async () => {
    if (selectedDeals.length === 0 && !isAllSelectedGlobally) return;

    const count = isAllSelectedGlobally ? (dbDeals as any)?.pagination?.total : selectedDeals.length;
    
    confirm(`Are you sure you want to delete ${count} deals? This action cannot be undone.`, {
      title: "Bulk Delete Deals",
      confirmLabel: "Delete",
      variant: "destructive",
    }).then(async (confirmed) => {
      if (confirmed) {
        try {
          await bulkDeleteDeals.mutateAsync(
            isAllSelectedGlobally
              ? { all: true, filters: { search, status, stage } }
              : selectedDeals
          );
          setSelectedDeals([]);
          setIsAllSelectedGlobally(false);
        } catch (error) {
          // Error handled by mutation
        }
      }
    });
  };

  const handleBulkExport = () => {
    const csvContent = [
      ['Name', 'Company', 'Contact', 'Value', 'Stage', 'Status', 'Created'],
      ...filtered
        .filter(deal => selectedDeals.includes(deal.id))
        .map(deal => [
          deal.name,
          deal.company,
          deal.contact,
          deal.value.toString(),
          deal.stage,
          deal.status,
          deal.createdAt
        ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deals-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Deals exported successfully');
  };

  // Reset selection when filters change
  useEffect(() => {
    setSelectedDeals([]);
    setIsAllSelectedGlobally(false);
  }, [search, status, stage]);

  const deals: DealRow[] = useMemo(() => {
    // Handle different response formats from the API
    let dealsData: any[] = [];

    if (Array.isArray(dbDeals)) {
      dealsData = dbDeals;
    } else if (dbDeals && typeof dbDeals === 'object') {
      const dataObj = dbDeals as any;
      if (Array.isArray(dataObj.data)) {
        dealsData = dataObj.data;
      } else if (dataObj.deals && Array.isArray(dataObj.deals)) {
        dealsData = dataObj.deals;
      }
    }

    return dealsData.map((d: any) => {
      const stageKey = (d.stage || "qualification").toLowerCase();

      const companyName = d.company || d.companyName || d.company_name || "";
      const contactName = d.contactName || d.contact_name || d.name || "";
      const email = d.contactEmail || d.email || d.companyEmail || d.company_email || "";
      const phone = d.contactPhone || d.phone || d.companyPhone || d.company_phone || "";

      return {
        id: d.id,
        name: d.title || "Untitled Deal",
        stage: stageKey,
        status: d.status || d.stage || "open",
        value: Number(d.value) || 0,
        company: companyName,
        contact: contactName,
        email: email,
        phone: phone,
        createdAt: d.created_at,
        projectType: d.project_type,
      };
    });
  }, [dbDeals]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return deals
      .filter((deal) => {
        const matchesSearch = term
          ? deal.name.toLowerCase().includes(term) ||
          deal.company.toLowerCase().includes(term) ||
          deal.contact.toLowerCase().includes(term) ||
          deal.email.toLowerCase().includes(term)
          : true;
        const matchesStage = stage === "all" || deal.stage === stage;
        const matchesStatus = status === "all" || deal.status.toLowerCase() === status;
        return matchesSearch && matchesStage && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === "name") return a.name.localeCompare(b.name);
        if (sortBy === "value") return b.value - a.value;
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });
  }, [deals, search, stage, status, sortBy]);

  const columns: EntityColumn<DealRow>[] = [
    {
      key: "name",
      header: "Deal",
      sortable: true,
      render: (deal) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{deal.name}</span>
            <Badge variant="outline" className="bg-muted/50">
              {deal.stage.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <Mail className="h-3 w-3" />
            {deal.email ? (
              <a href={`mailto:${deal.email}`} className="hover:text-primary hover:underline transition-colors" onClick={(e) => e.stopPropagation()}>
                {deal.email}
              </a>
            ) : (
              "—"
            )}
          </p>
        </div>
      ),
    },
    {
      key: "company",
      header: "Company",
      render: (deal) => (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Building2 className="h-4 w-4" />
          {deal.company || "—"}
        </div>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      render: (deal) => (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {deal.phone || deal.contact ? (
            <ClickToCall
              phoneNumber={deal.phone || deal.contact}
              entityType="deal"
              entityId={deal.id}
              className="font-medium"
            />
          ) : (
            "—"
          )}
        </div>
      ),
    },
    {
      key: "value",
      header: "Value",
      align: "right",
      sortable: true,
      render: (deal) => <span className="font-semibold">{deal.value ? `$${Number(deal.value).toLocaleString()}` : "—"}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (deal) => (
        <Badge variant="outline" className={statusTone(deal.status)}>
          {deal.status || "Open"}
        </Badge>
      ),
    },
    {
      key: "createdAt",
      header: "Created",
      sortable: true,
      render: (deal) => (
        <span className="text-sm text-muted-foreground">
          {deal.createdAt ? new Date(deal.createdAt).toLocaleDateString() : "—"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (deal) => (
        <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1">

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => navigate(`/crm/deals/${deal.id}`)}>
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate(`/crm/deals/${deal.id}/edit`)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Deal
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  updateDeal.mutate({ id: deal.id, status: 'unqualified', stage: 'unqualified' });
                }}
              >
                <XCircle className="h-4 w-4 mr-2 text-orange-600" />
                Unqualify Deal
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={async () => {
                  if (await confirm('Are you sure you want to delete this deal?', { variant: 'destructive', title: 'Delete Deal' })) {
                    deleteDeal.mutate(deal.id);
                  }
                }}
                className="text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Deal
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  const handleCreate = () => navigate("/crm/deals/create");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Deals"
        description="Interactive pipeline of every deal with instant filters and automation shortcuts."
        meta={[
          { label: "Total", value: (dbDeals as any)?.pagination?.total || 0, tone: "info" },
          { label: "Selected", value: isAllSelectedGlobally ? (dbDeals as any)?.pagination?.total : selectedDeals.length, tone: "warning" },
        ]}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {(selectedDeals.length > 0 || isAllSelectedGlobally) && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleBulkExport}>
                  <Download className="h-4 w-4 mr-2" />
                  Export ({isAllSelectedGlobally ? (dbDeals as any)?.pagination?.total : selectedDeals.length})
                </Button>
                <Button variant="outline" size="sm" onClick={handleBulkDelete}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete ({isAllSelectedGlobally ? (dbDeals as any)?.pagination?.total : selectedDeals.length})
                </Button>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={() => navigate("/crm/leads/import?type=deal")}>
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => setView(view === "automation" ? "list" : "automation")}>
              <Layers className="h-4 w-4" />
              Automation
            </Button>
            <Button className="bg-primary" onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              New Deal
            </Button>
          </div>
        }
      />

      <DataToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search deal, company, contact, email"
        filters={[
          {
            label: "Stage",
            value: stage,
            onChange: setStage,
            options: [
              { label: "All stages", value: "all" },
              ...pipelineStages.map(s => ({ label: s.stage_label, value: s.stage_key }))
            ],
          },
          {
            label: "Status",
            value: status,
            onChange: setStatus,
            options: [
              { label: "All", value: "all" },
              { label: "Open", value: "open" },
              { label: "Won", value: "won" },
              { label: "Lost", value: "lost" },
            ],
          },
        ]}
        quickFilters={[
          { label: "Won", value: "won", active: status === "won", onToggle: setStatus },
          { label: "Open", value: "open", active: status === "open", onToggle: setStatus },
        ]}
        sortValue={sortBy}
        sortOptions={[
          { label: "Recent", value: "recent" },
          { label: "Name", value: "name" },
          { label: "Value", value: "value" },
        ]}
        onSortChange={setSortBy}
        view={view}
        viewOptions={[
          { id: "list", label: "List" },
          { id: "kanban", label: "Kanban" },
          { id: "activities", label: "Activities" },
          { id: "calendar", label: "Calendar" },
          { id: "automation", label: "Automation" },
        ]}
        onViewChange={(v) => setView(v as ViewType)}
      >
      </DataToolbar>

      {view === "list" && (
        <Card className="border-0 shadow-card">
          <CardContent className="p-4 lg:p-6">
            <EntityTable
              data={filtered}
              columns={columns}
              isLoading={isLoading}
              pageSize={pageSize}
              totalCount={(dbDeals as any)?.pagination?.total || filtered.length}
              currentPage={currentPage}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
              selectedRows={selectedDeals}
              onSelectionChange={(ids) => setSelectedDeals(ids as string[])}
              isAllSelectedGlobally={isAllSelectedGlobally}
              onGlobalSelectionChange={setIsAllSelectedGlobally}
              emptyState={
                <EmptyState
                  title="No deals yet"
                  description="Create or import deals to populate your pipeline."
                  actionLabel="Add deal"
                  onAction={handleCreate}
                  icon={<Sparkles className="h-6 w-6" />}
                />
              }
              onRowClick={(row) => navigate(`/crm/deals/${row.id}`)}
            />
          </CardContent>
        </Card>
      )}

      {!isLoading && view === "kanban" && (
        <DealsKanbanView deals={filtered as any} selectedStage={stage === "all" ? null : stage} onStageSelect={(s) => setStage(s || "all")} />
      )}

      {view === "activities" && <DealsActivitiesView />}
      {view === "calendar" && <DealsCalendarView />}

      {view === "automation" && (
        <Suspense fallback={<div className="text-center py-8 text-muted-foreground">Loading automation...</div>}>
          <WorkflowsPage />
        </Suspense>
      )}

      {isError && (
        <Card>
          <CardContent className="p-6">
            <EmptyState title="Failed to load deals" description="Check connection and try again." muted />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

