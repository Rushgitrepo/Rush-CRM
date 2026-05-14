import { useState } from "react";
import { useUniboxEmails, useUniboxStats, UNIBOX_STATUSES, type UniboxEmail } from "@/hooks/useUniboxEmails";
import { useUniboxPermission } from "@/hooks/useUniboxPermission";
import { ConvertToLeadDialog } from "@/components/unibox/ConvertToLeadDialog";
import { UniboxPermissionsManager } from "@/components/unibox/UniboxPermissionsManager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Mail,
  UserPlus,
  Clock,
  ShieldAlert,
  Inbox,
  Star,
  StarOff,
  Archive,
  ArchiveRestore,
  Search,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  Calendar,
  Users,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useInstantlySettings } from "@/hooks/useInstantlySettings";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  Lead: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  Interested: "bg-green-500/10 text-green-600 border-green-500/20",
  "Meeting Booked": "bg-purple-500/10 text-purple-600 border-purple-500/20",
  Closed: "bg-muted text-muted-foreground border-border",
  "Out of Office": "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  "Not Interested": "bg-destructive/10 text-destructive border-destructive/20",
  "Wrong Person": "bg-orange-500/10 text-orange-600 border-orange-500/20",
  Converted: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-500/10 text-red-600 border-red-500/20",
  normal: "bg-gray-500/10 text-gray-600 border-gray-500/20",
  low: "bg-blue-500/10 text-blue-600 border-blue-500/20",
};

export default function UniboxPage() {
  const { hasPermission, isOwner, isLoading: permLoading } = useUniboxPermission();
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<UniboxEmail | null>(null);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

  const uniboxData = useUniboxEmails({
    status: statusFilter,
    search: searchQuery,
    starred: showStarredOnly,
    unread: showUnreadOnly,
    page: currentPage,
    limit: ITEMS_PER_PAGE
  });

  const {
    emails,
    total,
    totalPages,
    isLoading,
    updateStatus,
    toggleStarred,
    markAsRead,
    toggleArchive,
    convertToLead,
    syncInstantly
  } = uniboxData;

  // Reset page when filters change
  const handleFilterChange = (newFilter: string) => {
    setStatusFilter(newFilter);
    setCurrentPage(1);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  const { data: stats } = useUniboxStats();
  const { settings, updateSettings } = useInstantlySettings();

  if (permLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!hasPermission) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-center">
        <ShieldAlert className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-2xl font-bold text-foreground">Access Denied</h2>
        <p className="text-muted-foreground max-w-md">
          You don't have permission to access the Unibox Mailbox. Contact your administrator to request access.
        </p>
      </div>
    );
  }

  const handleConvert = async (data: {
    title: string;
    company_name: string;
    company_email: string;
    company_phone: string;
    interaction_notes: string;
  }) => {
    if (!selectedEmail) return;
    await convertToLead.mutateAsync({ emailId: selectedEmail.id, leadData: data });
    setConvertDialogOpen(false);
    setSelectedEmail(null);
  };

  const mailboxContent = (
    <>
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-4">
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-lg font-semibold">{stats.total}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              <div>
                <p className="text-xs text-muted-foreground">Unread</p>
                <p className="text-lg font-semibold">{stats.unread}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-600" />
              <div>
                <p className="text-xs text-muted-foreground">Starred</p>
                <p className="text-lg font-semibold">{stats.starred}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-xs text-muted-foreground">Leads</p>
                <p className="text-lg font-semibold">{stats.leads}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-xs text-muted-foreground">Interested</p>
                <p className="text-lg font-semibold">{stats.interested}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-purple-600" />
              <div>
                <p className="text-xs text-muted-foreground">Meetings</p>
                <p className="text-lg font-semibold">{stats.meetings}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              <div>
                <p className="text-xs text-muted-foreground">Converted</p>
                <p className="text-lg font-semibold">{stats.converted}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-indigo-600" />
              <div>
                <p className="text-xs text-muted-foreground">To Leads</p>
                <p className="text-lg font-semibold">{stats.converted_to_leads}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-12 gap-4 h-[calc(100vh-16rem)]">
        <Card className="col-span-3 p-3 flex flex-col">
          <h3 className="text-sm font-semibold text-foreground mb-3">Search & Filters</h3>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search emails..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="space-y-2 mb-4">
            <Button
              variant={showUnreadOnly ? "default" : "ghost"}
              size="sm"
              onClick={() => {
                setShowUnreadOnly(!showUnreadOnly);
                setCurrentPage(1);
              }}
              className="w-full justify-start gap-2"
            >
              <EyeOff className="h-4 w-4" />
              Unread Only
            </Button>
            <Button
              variant={showStarredOnly ? "default" : "ghost"}
              size="sm"
              onClick={() => {
                setShowStarredOnly(!showStarredOnly);
                setCurrentPage(1);
              }}
              className="w-full justify-start gap-2"
            >
              <Star className="h-4 w-4" />
              Starred Only
            </Button>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground mb-2">Status</p>
            <button
              onClick={() => handleFilterChange("All")}
              className={cn(
                "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
                statusFilter === "All"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <div className="flex items-center gap-2">
                <Inbox className="h-4 w-4" />
                All
              </div>
            </button>
            {UNIBOX_STATUSES.map((status) => (
              <button
                key={status}
                onClick={() => handleFilterChange(status)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
                  statusFilter === status
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                {status}
              </button>
            ))}
          </div>
        </Card>

        <Card className="col-span-4 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Emails ({total || 0})
            </h3>
          </div>
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="p-3 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : !emails || emails.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <Mail className="h-8 w-8 mb-2" />
                <p className="text-sm">No emails found</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {emails.map((email) => (
                  <button
                    key={email.id}
                    onClick={() => {
                      setSelectedEmail(email);
                      if (!email.is_read) {
                        markAsRead.mutate({ emailId: email.id, is_read: true });
                      }
                    }}
                    className={cn(
                      "w-full text-left p-3 hover:bg-accent/50 transition-colors relative",
                      selectedEmail?.id === email.id && "bg-accent",
                      !email.is_read && "bg-blue-50/50 dark:bg-blue-950/20"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className={cn(
                            "text-sm truncate",
                            !email.is_read ? "font-semibold text-foreground" : "font-medium text-foreground"
                          )}>
                            {email.sender_name || email.sender_email}
                          </p>
                          {email.is_starred && (
                            <Star className="h-3 w-3 text-yellow-500 fill-current" />
                          )}
                          {!email.is_read && (
                            <div className="w-2 h-2 bg-blue-600 rounded-full" />
                          )}
                        </div>
                        <p className={cn(
                          "text-sm truncate",
                          !email.is_read ? "font-medium text-foreground" : "text-foreground"
                        )}>
                          {email.subject || "(No subject)"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {(email.body_text || email.body || "").substring(0, 80)}
                        </p>
                        {email.priority && email.priority !== 'normal' && (
                          <Badge className={cn("text-[10px] px-1.5 py-0 mt-1", PRIORITY_COLORS[email.priority] || "")}>
                            {email.priority.toUpperCase()}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(email.received_at), "MMM d")}
                        </span>
                        <Badge className={cn("text-[10px] px-1.5 py-0", STATUS_COLORS[email.status] || "")}>
                          {email.status}
                        </Badge>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>

          {totalPages && totalPages > 1 && (
            <div className="p-3 border-t border-border bg-muted/20 flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1 || isLoading}
              >
                Previous
              </Button>
              <div className="text-xs text-muted-foreground font-medium">
                Page {currentPage} of {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages || isLoading}
              >
                Next
              </Button>
            </div>
          )}
        </Card>

        <Card className="col-span-5 flex flex-col overflow-hidden">
          {selectedEmail ? (
            <>
              <div className="p-4 border-b border-border space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold text-foreground truncate">
                      {selectedEmail.subject || "(No subject)"}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      From: <span className="text-foreground">{selectedEmail.sender_name || ""}</span>{" "}
                      &lt;{selectedEmail.sender_email}&gt;
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(selectedEmail.received_at), "PPpp")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={cn("shrink-0", STATUS_COLORS[selectedEmail.status] || "")}>
                      {selectedEmail.status}
                    </Badge>
                    {selectedEmail.priority && selectedEmail.priority !== 'normal' && (
                      <Badge className={cn("shrink-0", PRIORITY_COLORS[selectedEmail.priority] || "")}>
                        {selectedEmail.priority.toUpperCase()}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleStarred.mutate({
                      emailId: selectedEmail.id,
                      is_starred: !selectedEmail.is_starred
                    })}
                    className="gap-1"
                  >
                    {selectedEmail.is_starred ? (
                      <StarOff className="h-4 w-4" />
                    ) : (
                      <Star className="h-4 w-4" />
                    )}
                    {selectedEmail.is_starred ? "Unstar" : "Star"}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => markAsRead.mutate({
                      emailId: selectedEmail.id,
                      is_read: !selectedEmail.is_read
                    })}
                    className="gap-1"
                  >
                    {selectedEmail.is_read ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                    {selectedEmail.is_read ? "Mark Unread" : "Mark Read"}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleArchive.mutate({
                      emailId: selectedEmail.id,
                      is_archived: !selectedEmail.is_archived
                    })}
                    className="gap-1"
                  >
                    {selectedEmail.is_archived ? (
                      <ArchiveRestore className="h-4 w-4" />
                    ) : (
                      <Archive className="h-4 w-4" />
                    )}
                    {selectedEmail.is_archived ? "Unarchive" : "Archive"}
                  </Button>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <Select
                    value={selectedEmail.status}
                    onValueChange={(val) => {
                      updateStatus.mutate({ emailId: selectedEmail.id, status: val });
                    }}
                  >
                    <SelectTrigger className="w-[180px] h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIBOX_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {!selectedEmail.converted_to_lead_id && (
                    <Button
                      size="sm"
                      onClick={() => setConvertDialogOpen(true)}
                      className="gap-1"
                    >
                      <UserPlus className="h-4 w-4" />
                      Convert to Lead
                    </Button>
                  )}
                  {selectedEmail.converted_to_lead_id && (
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                      ✓ Converted to Lead
                    </Badge>
                  )}
                </div>
              </div>

              <ScrollArea className="flex-1 p-4">
                {selectedEmail.body_html ? (
                  <div
                    className="prose prose-sm max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: selectedEmail.body_html }}
                  />
                ) : selectedEmail.body_text ? (
                  <pre className="text-sm whitespace-pre-wrap font-sans">
                    {selectedEmail.body_text}
                  </pre>
                ) : (
                  <p className="text-sm text-muted-foreground">(No content)</p>
                )}
              </ScrollArea>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Mail className="h-12 w-12 mb-3" />
              <p className="text-sm">Select an email to view details</p>
            </div>
          )}
        </Card>
      </div>
    </>
  );

  return (
    <div className="space-y-4">
      {isOwner ? (
        <Tabs defaultValue="mailbox" className="w-full">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Unibox Mailbox</h1>
              <p className="text-muted-foreground">Manage emails from Instantly.ai and convert to leads</p>
            </div>
            <div className="flex items-center gap-6">
              {settings && (
                <div className="flex items-center gap-2 mr-2">
                  <Switch
                    id="auto-add-leads"
                    checked={settings.auto_add_leads}
                    onCheckedChange={(checked) => updateSettings.mutate({ auto_add_leads: checked })}
                  />
                  <Label htmlFor="auto-add-leads" className="text-sm font-medium cursor-pointer">
                    Auto-add Leads
                  </Label>
                </div>
              )}
              <Button
                variant="outline"
                onClick={() => syncInstantly.mutate()}
                disabled={syncInstantly.isPending}
                className="gap-2"
              >
                <TrendingUp className={cn("h-4 w-4", syncInstantly.isPending && "animate-spin")} />
                {syncInstantly.isPending ? "Syncing..." : "Sync Instantly"}
              </Button>
              <TabsList>
                <TabsTrigger value="mailbox">Mailbox</TabsTrigger>
                <TabsTrigger value="permissions">Access Management</TabsTrigger>
              </TabsList>
            </div>
          </div>

          <TabsContent value="mailbox" className="space-y-4">
            {mailboxContent}
          </TabsContent>

          <TabsContent value="permissions">
            <UniboxPermissionsManager />
          </TabsContent>
        </Tabs>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Unibox Mailbox</h1>
              <p className="text-muted-foreground">Manage emails from Instantly.ai and convert to leads</p>
            </div>
            <div className="flex items-center gap-6">
              {settings && (
                <div className="flex items-center gap-2 mr-2">
                  <Switch
                    id="auto-add-leads-guest"
                    checked={settings.auto_add_leads}
                    onCheckedChange={(checked) => updateSettings.mutate({ auto_add_leads: checked })}
                  />
                  <Label htmlFor="auto-add-leads-guest" className="text-sm font-medium cursor-pointer">
                    Auto-add Leads
                  </Label>
                </div>
              )}
              <Button
                variant="outline"
                onClick={() => syncInstantly.mutate()}
                disabled={syncInstantly.isPending}
                className="gap-2"
              >
                <TrendingUp className={cn("h-4 w-4", syncInstantly.isPending && "animate-spin")} />
                {syncInstantly.isPending ? "Syncing..." : "Sync Instantly"}
              </Button>
            </div>
          </div>
          {mailboxContent}
        </>
      )}

      <ConvertToLeadDialog
        email={selectedEmail}
        open={convertDialogOpen}
        onOpenChange={setConvertDialogOpen}
        onConvert={handleConvert}
        isConverting={convertToLead.isPending}
      />
    </div>
  );
}
