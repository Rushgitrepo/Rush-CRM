import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Sparkles, Mail, Phone, Building2, Filter, Download, Upload, MoreHorizontal, Edit, Trash2, Eye, Globe, XCircle, CheckCircle } from "lucide-react";
import { useLeads, useDeleteLead, useBulkDeleteLeads, useUsers } from "@/hooks/useCrmData";
import { useUpdateLead } from "@/hooks/useCrmMutations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { LeadsKanbanView } from "@/components/crm/leads/LeadsKanbanView";
import { LeadsActivitiesView } from "@/components/crm/leads/LeadsActivitiesView";
import { LeadsCalendarView } from "@/components/crm/leads/LeadsCalendarView";
import { WorkspaceFilter } from "@/components/crm/leads/WorkspaceFilter";
import { PageHeader } from "@/components/crm/ui/PageHeader";
import { DataToolbar } from "@/components/crm/ui/DataToolbar";
import { EntityTable, EntityColumn } from "@/components/crm/ui/EntityTable";
import { EmptyState } from "@/components/crm/ui/EmptyState";
import { AdvancedSearch } from "@/components/crm/ui/AdvancedSearch";
import { useCustomDialog } from "@/contexts/DialogContext";
import { toast } from "sonner";
import { ClickToCall } from "@/components/telephony/ClickToCall";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { usePersistentState } from "@/hooks/usePersistentState";
import { cn } from "@/lib/utils";

const statusTone = (status?: string) => {
  const s = (status || "").toLowerCase();
  if (s === "qualified") return "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50";
  if (s === "contacted") return "bg-primary/10 dark:bg-primary/20 text-primary border-primary/20 dark:border-primary/50";
  if (s === "unqualified") return "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50";
  return "bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/50";
};

type ViewType = "kanban" | "list" | "activities" | "calendar";

type LeadRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  status: string;
  source: string;
  value: number;
  type: "inbound" | "planned";
  createdAt: string;
  responsiblePersonName?: string;
  responsiblePersonAvatar?: string;
};

export default function LeadsPage() {
  const navigate = useNavigate();
  const [view, setView] = usePersistentState<ViewType>("leads_view", "list");
  const [search, setSearch] = usePersistentState("leads_search", "");
  const [status, setStatus] = usePersistentState("leads_status", "all");
  const [type, setType] = usePersistentState("leads_type", "all");
  const [workspaceFilter, setWorkspaceFilter] = usePersistentState("leads_workspace", "all");
  const { confirm } = useCustomDialog();
  const [sortBy, setSortBy] = usePersistentState("leads_sortBy", "recent");
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [isAllSelectedGlobally, setIsAllSelectedGlobally] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = usePersistentState("leads_currentPage", 1);
  const [pageSize, setPageSize] = usePersistentState("leads_pageSize", 100);
  const [startDate, setStartDate] = usePersistentState<string>("leads_startDate", "");
  const [endDate, setEndDate] = usePersistentState<string>("leads_endDate", "");
  const [priorityFilter, setPriorityFilter] = usePersistentState("leads_priority", "all");
  const [sourceFilter, setSourceFilter] = usePersistentState("leads_source", "all");
  const [assignedToFilter, setAssignedToFilter] = usePersistentState("leads_assignedTo", "all");
  const [tagsFilter, setTagsFilter] = usePersistentState("leads_tags", "");
  const [campaignFilter, setCampaignFilter] = usePersistentState("leads_campaign", "");

  const { data: dbLeads, isLoading, isError } = useLeads({
    search,
    status: status !== "all" ? status : undefined,
    type: type !== "all" ? type : undefined,
    workspaceId: workspaceFilter !== "all" ? workspaceFilter : undefined,
    page: currentPage,
    limit: pageSize,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    priority: priorityFilter !== "all" ? priorityFilter : undefined,
    source: sourceFilter !== "all" ? sourceFilter : undefined,
    assignedTo: assignedToFilter !== "all" ? assignedToFilter : undefined,
    tags: tagsFilter || undefined,
    campaign: campaignFilter || undefined,
  });
  const { data: users = [] } = useUsers({ department: 'Sales', includeSelf: true });
  const { data: pipelineStages = [] } = usePipelineStages();
  const deleteLead = useDeleteLead();
  const bulkDeleteLeads = useBulkDeleteLeads();
  const updateLead = useUpdateLead();

  const leads: LeadRow[] = useMemo(() => {
    // Handle different response formats from the API
    let leadsData: any[] = [];

    if (Array.isArray(dbLeads)) {
      leadsData = dbLeads;
    } else if (dbLeads && typeof dbLeads === 'object') {
      const dataObj = dbLeads as any;
      if (Array.isArray(dataObj.data)) {
        leadsData = dataObj.data;
      } else if (dataObj.leads && Array.isArray(dataObj.leads)) {
        leadsData = dataObj.leads;
      }
    }

    return leadsData.map((l: any) => {
      const inferredType = ((l.source || "").toLowerCase().includes("inbound") || (l.channel || "").includes("web")) ? "inbound" : "planned";
      return {
        id: l.id,
        name: l.title || l.name || "Untitled",
        email: l.email || "",
        phone: l.phone || l.company_phone || "",
        company: l.company_name || l.company || "",
        status: l.status || "new",
        stage: l.stage || l.status || "new",
        source: l.source || l.lead_source || "",
        value: Number(l.value) || 0,
        type: inferredType,
        createdAt: l.created_at,
        responsiblePersonName: l.responsible_person_name,
        responsiblePersonAvatar: l.responsible_person_avatar,
      };
    });
  }, [dbLeads]);

  // Reset selection when filters change
  useEffect(() => {
    setSelectedLeads([]);
    setIsAllSelectedGlobally(false);
  }, [search, status, type, workspaceFilter, startDate, endDate]);

  const filtered = useMemo(() => {
    // Since backend handles filtering, we just sort if needed
    return [...leads].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "value") return b.value - a.value;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [leads, sortBy]);

  const handleCreate = () => navigate("/crm/leads/create");


  const handleBulkDelete = () => {
    if (selectedLeads.length === 0 && !isAllSelectedGlobally) return;

    const count = isAllSelectedGlobally ? (dbLeads as any)?.pagination?.total : selectedLeads.length;

    confirm(`Are you sure you want to delete ${count} leads? This action cannot be undone.`, {
      title: "Bulk Delete Leads",
      confirmLabel: "Delete",
      variant: "destructive",
    }).then((confirmed) => {
      if (confirmed) {
        bulkDeleteLeads.mutate(
          isAllSelectedGlobally 
            ? { all: true, filters: { search, status, type, workspaceId: workspaceFilter } }
            : selectedLeads, 
          {
            onSuccess: () => {
              setSelectedLeads([]);
              setIsAllSelectedGlobally(false);
            },
          }
        );
      }
    });
  };

  const handleBulkExport = () => {
    const csvContent = [
      ['Name', 'Email', 'Phone', 'Company', 'Status', 'Source', 'Value', 'Created'],
      ...filtered
        .filter(lead => selectedLeads.includes(lead.id))
        .map(lead => [
          lead.name,
          lead.email,
          lead.phone,
          lead.company,
          lead.status,
          lead.source,
          lead.value.toString(),
          lead.createdAt
        ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Leads exported successfully');
  };

  const columns: EntityColumn<LeadRow>[] = [
    {
      key: "name",
      header: "Lead",
      sortable: true,
      render: (lead) => (
        <div className="space-y-0.5 max-w-[250px]">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="font-semibold truncate">{lead.name}</span>
            <Badge variant="outline" className={cn(statusTone(lead.stage), "whitespace-nowrap flex-shrink-0 uppercase")}>
              {lead.stage || "New"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <Mail className="h-3 w-3" />
            {lead.email ? (
              <span 
                className="hover:text-primary hover:underline transition-colors cursor-pointer" 
                onClick={(e) => {
                  e.stopPropagation();
                  navigate("/collaboration/mail", { state: { composeTo: lead.email } });
                }}
              >
                {lead.email}
              </span>
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
      render: (lead) => (
        <div className="flex items-center gap-2 text-sm text-muted-foreground max-w-[180px]">
          <Building2 className="h-4 w-4 shrink-0" />
          <span className="truncate">{lead.company || "—"}</span>
        </div>
      ),
    },
    {
      key: "source",
      header: "Source",
      sortable: true,
      render: (lead) => <span className="text-sm text-muted-foreground">{lead.source || "—"}</span>,
    },
    {
      key: "value",
      header: "Value",
      align: "right",
      sortable: true,
      render: (lead) => (
        <span className="font-semibold">
          {lead.value ? `$${Number(lead.value).toLocaleString()}` : "—"}
        </span>
      ),
    },
    {
      key: "responsible",
      header: "Responsible",
      render: (lead) => (
        <div className="flex items-center gap-2">
          {lead.responsiblePersonName ? (
            <>
              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border border-border/50">
                {lead.responsiblePersonAvatar ? (
                  <img src={lead.responsiblePersonAvatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[10px] font-bold text-primary">
                    {lead.responsiblePersonName.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </span>
                )}
              </div>
              <span className="text-xs font-medium truncate max-w-[100px]">{lead.responsiblePersonName}</span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
      ),
    },
    {
      key: "phone",
      header: "Contact",
      render: (lead) => (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {lead.phone ? (
            <ClickToCall
              phoneNumber={lead.phone}
              entityType="lead"
              entityId={lead.id}
              className="font-medium"
            />
          ) : (
            "—"
          )}
        </div>
      ),
    },
    {
      key: "createdAt",
      header: "Created",
      sortable: true,
      render: (lead) => (
        <span className="text-sm text-muted-foreground">
          {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : "—"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (lead) => (
        <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/crm/leads/${lead.id}`)}>
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/crm/leads/${lead.id}/edit`)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Lead
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  updateLead.mutate({ id: lead.id, status: 'unqualified', stage: 'unqualified' });
                }}
              >
                <CheckCircle className="h-4 w-4 mr-2 text-emerald-600" />
                Unqualify Lead
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async (e) => {
                  e.stopPropagation();
                  if (await confirm('Are you sure you want to delete this lead?', { variant: 'destructive', title: 'Delete Lead' })) {
                    deleteLead.mutate(lead.id);
                  }
                }}
                className="text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description="A live, filterable pipeline of every lead with fast actions."
        meta={[
          { label: "Total", value: (dbLeads as any)?.pagination?.total || 0, tone: "info" },
          { label: "Selected", value: isAllSelectedGlobally ? (dbLeads as any)?.pagination?.total : selectedLeads.length, tone: "warning" },
        ]}
        actions={
          <div className="flex gap-2">
            {(selectedLeads.length > 0 || isAllSelectedGlobally) && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleBulkExport}>
                  <Download className="h-4 w-4 mr-2" />
                  Export ({isAllSelectedGlobally ? (dbLeads as any)?.pagination?.total : selectedLeads.length})
                </Button>
                <Button variant="outline" size="sm" onClick={handleBulkDelete}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete ({isAllSelectedGlobally ? (dbLeads as any)?.pagination?.total : selectedLeads.length})
                </Button>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={() => navigate('/crm/leads/external-sources')}>
              <Globe className="h-4 w-4 mr-2" />
              External Sources
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/crm/leads/import?type=lead')}>
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            <Button className="bg-primary" onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              New Lead
            </Button>
          </div>
        }
      />

      <DataToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search everything (lead, company, contact, email, notes...)"
        filters={[
          {
            label: "Status",
            value: status,
            onChange: setStatus,
            options: [
              { label: "All Statuses", value: "all" },
              { label: "New", value: "new" },
              { label: "Contacted", value: "contacted" },
              { label: "Qualified", value: "qualified" },
              { label: "Converted", value: "converted" },
              { label: "Disqualified", value: "disqualified" },
            ],
          },
          {
            label: "Type",
            value: type,
            onChange: setType,
            options: [
              { label: "All types", value: "all" },
              { label: "Inbound", value: "inbound" },
              { label: "Planned", value: "planned" },
            ],
          }, {
            label: "Priority",
            value: priorityFilter,
            onChange: setPriorityFilter,
            options: [
              { label: "All Priority", value: "all" },
              { label: "Low", value: "low" },
              { label: "Medium", value: "medium" },
              { label: "High", value: "high" },
              { label: "Urgent", value: "urgent" },
            ],
          },
          {
            label: "Source",
            value: sourceFilter,
            onChange: setSourceFilter,
            options: [
              { label: "All Sources", value: "all" },
              { label: "Website", value: "Website" },
              { label: "Referral", value: "Referral" },
              { label: "Cold Call", value: "Cold Call" },
              { label: "LinkedIn", value: "LinkedIn" },
              { label: "Email", value: "Email" },
              { label: "Other", value: "Other" },
            ],
          },
          {
            label: "Responsible Person",
            value: assignedToFilter,
            onChange: setAssignedToFilter,
            options: [
              ...(users?.map(u => ({ label: u.full_name || u.email, value: u.id })) || [])
            ]
          },
          {
            label: "Workspace",
            type: "custom",
            value: workspaceFilter,
            onChange: setWorkspaceFilter,
            render: () => (
              <WorkspaceFilter
                value={workspaceFilter}
                onChange={setWorkspaceFilter}
              />
            )
          },
          {
            label: "Campaign",
            type: "input",
            value: campaignFilter,
            onChange: setCampaignFilter
          },
          {
            label: "Tags",
            type: "input",
            value: tagsFilter,
            onChange: setTagsFilter
          },
          {
            label: "From",
            type: "date",
            value: startDate,
            onChange: setStartDate
          },
          {
            label: "To",
            type: "date",
            value: endDate,
            onChange: setEndDate
          }
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
        ]}
        onViewChange={(v) => setView(v as ViewType)}
      >
      </DataToolbar>

      {view === "list" && (
        <Card >
          <CardContent className="p-4 lg:p-6">
            <EntityTable
              data={filtered}
              columns={columns}
              isLoading={isLoading}
              pageSize={pageSize}
              totalCount={(dbLeads as any)?.pagination?.total || filtered.length}
              currentPage={currentPage}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
              selectedRows={selectedLeads}
              onSelectionChange={(ids) => {
                setSelectedLeads(ids as string[]);
                if (ids.length === 0) setIsAllSelectedGlobally(false);
              }}
              isAllSelectedGlobally={isAllSelectedGlobally}
              onGlobalSelectionChange={setIsAllSelectedGlobally}
              emptyState={
                <EmptyState
                  title="No leads yet"
                  description="Import or create your first lead to get started."
                  actionLabel="Add lead"
                  onAction={handleCreate}
                  icon={<Sparkles className="h-6 w-6" />}
                />
              }
              onRowClick={(row) => navigate(`/crm/leads/${row.id}`)}
            />
          </CardContent>
        </Card>
      )}

      {!isLoading && view === "kanban" && (
        <LeadsKanbanView leads={filtered as any} onCreateLead={handleCreate} selectedStage={status} />
      )}

      {view === "activities" && <LeadsActivitiesView />}
      {view === "calendar" && <LeadsCalendarView />}

      {isError && (
        <Card>
          <CardContent className="p-6">
            <EmptyState title="Failed to load leads" description="Check connection and try again." muted />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

