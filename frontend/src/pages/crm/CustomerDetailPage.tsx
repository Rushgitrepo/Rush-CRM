import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  ArrowLeft, Pencil, Trash2, Save, Phone, Mail, Building2, User, 
  Calendar, DollarSign, Tag, FileText, Activity, MessageSquare, 
  Clock, Star, MoreHorizontal, ExternalLink, CheckCircle, 
  AlertCircle, ChevronRight, TrendingUp, Users, Target, Award,
  Briefcase, History, Plus, Edit3, Send, BarChart3,
  Search, Settings, X, Check, ArrowUp, Zap, MapPin
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { InteractionPanel } from "@/components/crm/InteractionPanel";
import { useCustomer, useUpdateCustomer, useDeleteCustomer } from "@/hooks/useCrmData";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from "@/components/ui/alert-dialog";

// Professional Field component
interface FieldProps {
  label: string;
  value: string | number | undefined | null;
  onChange: (value: string) => void;
  editing: boolean;
  icon?: React.ReactNode;
  multiline?: boolean;
  type?: string;
  placeholder?: string;
}

function Field({ label, value, onChange, editing, icon, multiline, type = "text", placeholder }: FieldProps) {
  if (!editing && !value && value !== 0) {
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-500 flex items-center gap-1.5 font-jakarta capitalize">
          {icon}
          {label}
        </Label>
        <div className="min-h-[2.5rem] px-3 py-2 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 flex items-center transition-all">
          <span className="text-slate-400 text-sm italic">Not specified</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 group">
      <Label className="text-sm font-medium text-slate-700 flex items-center gap-1.5 font-jakarta capitalize group-hover:text-blue-600 transition-colors">
        {icon}
        {label}
      </Label>
      {editing ? (
        multiline ? (
          <Textarea
            value={value?.toString() || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="min-h-[100px] resize-none border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all rounded-xl"
          />
        ) : (
          <Input
            type={type}
            value={value?.toString() || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="h-11 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all rounded-xl"
          />
        )
      ) : (
        <div className="min-h-[2.75rem] px-4 py-2.5 border border-slate-200 rounded-xl bg-white shadow-sm flex items-center group-hover:border-blue-200 group-hover:shadow-md transition-all">
          <span className="text-slate-900 font-medium break-words w-full text-sm">{value}</span>
        </div>
      )}
    </div>
  );
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: customer, isLoading } = useCustomer(id!);
  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    if (customer) setForm({ ...customer });
  }, [customer]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-blue-100"></div>
            <div className="absolute inset-0 rounded-full border-4 border-t-blue-600 animate-spin"></div>
          </div>
          <p className="text-slate-500 font-jakarta font-medium animate-pulse">Loading experience...</p>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mb-6">
          <AlertCircle className="h-12 w-12 text-red-500" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Customer Hidden or Removed</h1>
        <p className="text-slate-500 max-w-sm mb-8">This client profile could not be retrieved. It may have been archived or deleted.</p>
        <Button onClick={() => navigate('/crm/customers')} size="lg" className="rounded-full bg-slate-900 hover:bg-slate-800 h-14 px-8">
          <ArrowLeft className="h-5 w-5 mr-3" />
          Return to Portfolio
        </Button>
      </div>
    );
  }

  const handleSave = () => {
    updateCustomer.mutate({ id: customer.id, ...form }, {
      onSuccess: () => setEditing(false)
    });
  };

  const handleDelete = () => {
    deleteCustomer.mutate(customer.id, {
      onSuccess: () => {
        toast.success("Client archived successfully");
        navigate('/crm/customers');
      },
      onError: () => toast.error("Failed to archive client")
    });
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Dynamic Glassmorphic Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
        <div className="max-w-[1400px] mx-auto px-6 py-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-5">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigate("/crm/customers")}
                className="h-10 w-10 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-900 shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              
              <div className="flex items-center gap-4 truncate">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-[1px] shadow-lg shadow-blue-200 shrink-0">
                  <div className="w-full h-full rounded-[14px] bg-white flex items-center justify-center overflow-hidden">
                    <span className="text-lg font-bold text-blue-700">
                      {customer.name?.charAt(0).toUpperCase() || 'C'}
                    </span>
                  </div>
                </div>
                <div className="truncate">
                  <div className="flex items-center gap-3">
                    <h1 className="text-xl font-bold text-slate-900 truncate tracking-tight">{customer.name}</h1>
                    <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-100 hover:bg-emerald-500/20 transition-colors uppercase tracking-widest text-[10px] font-bold py-1">
                      {customer.status || "Client"}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-400 font-jakarta font-medium flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5" />
                    {customer.industry || "No Industry Specified"}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {editing ? (
                <>
                  <Button variant="outline" onClick={() => { setEditing(false); setForm({ ...customer }); }} className="rounded-full border-slate-200 px-6 h-11">
                    Discard
                  </Button>
                  <Button onClick={handleSave} className="rounded-full bg-blue-600 hover:bg-blue-700 px-8 h-11 shadow-lg shadow-blue-200">
                    <Save className="h-4 w-4 mr-2" />
                    Secure Changes
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setEditing(true)} className="rounded-full border-slate-200 h-11 px-6 hover:bg-slate-50 transition-all">
                    <Edit3 className="h-4 w-4 mr-2 text-slate-400" />
                    Edit Details
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-11 w-11 rounded-full border border-slate-200">
                        <MoreHorizontal className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl shadow-xl border-slate-100">
                      <DropdownMenuSeparator className="my-2 bg-slate-100" />
                      
                      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                        <AlertDialogTrigger asChild>
                          <DropdownMenuItem 
                            onSelect={(e) => e.preventDefault()}
                            className="text-red-500 focus:text-red-600 rounded-xl py-2.5"
                          >
                            <Trash2 className="h-4 w-4 mr-3" />
                            Delete Client
                          </DropdownMenuItem>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="max-w-md rounded-3xl border-0 shadow-2xl">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-3 text-red-600">
                              <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center">
                                <AlertCircle className="h-5 w-5" />
                              </div>
                              Delete Client?
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-slate-500 pt-2 leading-relaxed">
                              This action will delete <span className="font-bold text-slate-900">{customer.name}</span> from the archive. This client's data will be preserved but removed from your active portfolio.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="pt-6">
                            <AlertDialogCancel className="rounded-full border-slate-200 h-11 px-6">Keep Active</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={handleDelete}
                              className="rounded-full bg-red-600 hover:bg-red-700 h-11 px-8 text-white shadow-lg shadow-red-200"
                            >
                              Confirm Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Content Area */}
          <div className="lg:col-span-8 space-y-8">
            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <Card className="border-0 shadow-sm bg-blue-600 p-[1px] rounded-3xl group overflow-hidden">
                <div className="w-full h-full bg-white rounded-[23px] p-6 group-hover:bg-blue-50/20 transition-all">
                  <p className="text-sm font-jakarta font-semibold text-slate-400 mb-2">Total Revenue</p>
                  <div className="flex items-center gap-2">
                    <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
                      ${Number(customer.total_revenue || 0).toLocaleString()}
                    </h3>
                    <TrendingUp className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div className="mt-4 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 w-3/4 rounded-full"></div>
                  </div>
                </div>
              </Card>

              <Card className="border-0 shadow-sm p-6 rounded-3xl bg-white hover:bg-indigo-50/10 transition-all">
                <p className="text-sm font-jakarta font-semibold text-slate-400 mb-2">Lifetime Value</p>
                <div className="flex items-center gap-2">
                  <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
                    ${Number(customer.lifetime_value || 0).toLocaleString()}
                  </h3>
                  <Award className="h-5 w-5 text-indigo-500" />
                </div>
                <p className="text-xs text-slate-400 mt-3 font-medium flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 text-indigo-400" />
                  Calculated from closed wins
                </p>
              </Card>

              <Card className="border-0 shadow-sm p-6 rounded-3xl bg-white hover:bg-emerald-50/10 transition-all">
                <p className="text-sm font-jakarta font-semibold text-slate-400 mb-2">Client Tier</p>
                <div className="flex items-center gap-2">
                  <h3 className="text-2xl font-bold text-slate-900 tracking-tight capitalize">
                    {customer.tier || "Standard"}
                  </h3>
                  <Zap className="h-5 w-5 text-amber-500" />
                </div>
                <p className="text-xs text-slate-400 mt-3 font-medium">Strategic Relationship Level</p>
              </Card>
            </div>

            {/* Content Tabs */}
            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList className="bg-slate-100/50 p-1 rounded-2xl h-12 inline-flex border border-slate-200/40">
                <TabsTrigger value="overview" className="rounded-xl px-8 data-[state=active]:bg-white data-[state=active]:shadow-sm font-jakarta font-semibold text-sm">
                  Global Overview
                </TabsTrigger>
                <TabsTrigger value="activities" className="rounded-xl px-8 data-[state=active]:bg-white data-[state=active]:shadow-sm font-jakarta font-semibold text-sm">
                  Interaction History
                </TabsTrigger>
                <TabsTrigger value="docs" className="rounded-xl px-8 data-[state=active]:bg-white data-[state=active]:shadow-sm font-jakarta font-semibold text-sm">
                  Intelligence & Notes
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-8 animate-in fade-in duration-500">
                <Card className="border-0 shadow-card rounded-3xl overflow-hidden bg-white">
                  <CardHeader className="px-8 pt-8 flex-row justify-between items-center bg-slate-50/50">
                    <div>
                      <CardTitle className="text-xl tracking-tight text-slate-900">Portfolio Intelligence</CardTitle>
                      <CardDescription className="text-slate-400 mt-1">Core business and relational data points.</CardDescription>
                    </div>
                    <Badge variant="outline" className="rounded-full bg-white border-slate-200 text-slate-400 font-jakarta font-bold text-[10px] py-1 px-4">
                      UUID: {customer.id.slice(0, 8)}...
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                      <Field 
                        label="Primary Client Name" 
                        value={form.name} 
                        onChange={(v) => setForm({ ...form, name: v })} 
                        editing={editing} 
                        icon={<User className="h-4 w-4" />} 
                        placeholder="e.g. Acme Global Holdings"
                      />
                      <Field 
                        label="Client Ecosystem" 
                        value={form.industry} 
                        onChange={(v) => setForm({ ...form, industry: v })} 
                        editing={editing} 
                        icon={<Building2 className="h-4 w-4" />} 
                        placeholder="e.g. Construction & Design"
                      />
                      <Field 
                        label="Digital Gateway" 
                        value={form.email} 
                        onChange={(v) => setForm({ ...form, email: v })} 
                        editing={editing} 
                        icon={<Mail className="h-4 w-4" />} 
                        placeholder="contact@example.com"
                      />
                      <Field 
                        label="Direct Hotline" 
                        value={form.phone} 
                        onChange={(v) => setForm({ ...form, phone: v })} 
                        editing={editing} 
                        icon={<Phone className="h-4 w-4" />} 
                        placeholder="+1 (555) 000-0000"
                      />
                      <Field 
                        label="Account Tiering" 
                        value={form.tier} 
                        onChange={(v) => setForm({ ...form, tier: v })} 
                        editing={editing} 
                        icon={<Award className="h-4 w-4" />} 
                        placeholder="e.g. Enterprise / Strategic"
                      />
                      <Field 
                        label="Relationship Status" 
                        value={form.status} 
                        onChange={(v) => setForm({ ...form, status: v })} 
                        editing={editing} 
                        icon={<Activity className="h-4 w-4" />} 
                        placeholder="Active / Retainer"
                      />
                    </div>
                    
                    <div className="mt-12">
                      <Field 
                        label="Executive Summaries & Intelligence" 
                        value={form.notes} 
                        onChange={(v) => setForm({ ...form, notes: v })} 
                        editing={editing} 
                        multiline 
                        icon={<FileText className="h-4 w-4" />} 
                        placeholder="Detailed background, preferences, and strategic goals for this client account..."
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="activities" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <InteractionPanel 
                  entityType="customer" 
                  entityId={customer.id} 
                />
              </TabsContent>

              <TabsContent value="docs" className="animate-in fade-in duration-500">
                <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl shadow-sm border-2 border-dashed border-slate-100">
                  <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
                    <FileText className="h-8 w-8 text-blue-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Intelligence Documents</h3>
                  <p className="text-slate-400 text-sm max-w-xs text-center mt-2">Upload strategist reports, market analysis, or agreement copies specific to this client.</p>
                  <Button variant="outline" className="mt-6 rounded-full px-6 h-11 border-slate-200">
                    <Plus className="h-4 w-4 mr-2" />
                    Enrich Knowledge Base
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar Area */}
          <div className="lg:col-span-4 space-y-8">
            {/* Relationship Intelligence Card */}
            <Card className="border-0 shadow-card rounded-3xl bg-slate-900 text-white overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full -mr-16 -mt-16 blur-2xl"></div>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg tracking-tight font-jakarta flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-400" />
                  Portfolio Metadata
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 hover:border-white/20 transition-all cursor-default">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center">
                        <History className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest leading-none mb-1">Onboarding Date</p>
                        <p className="text-sm font-semibold">{format(new Date(customer.created_at), 'MMMM dd, yyyy')}</p>
                      </div>
                    </div>
                  </div>
                  <Separator className="bg-white/5 my-4" />
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Last Interaction</p>
                      <p className="text-xs font-medium">2 hours ago</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Loyalty Score</p>
                      <p className="text-xs font-medium text-emerald-400">9.4 / 10</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-blue-400 uppercase tracking-widest">Linked Assets</h4>
                  <div className="space-y-2">
                    {customer.converted_from_deal_id && (
                      <Button 
                        variant="ghost" 
                        onClick={() => navigate(`/crm/deals/${customer.converted_from_deal_id}`)}
                        className="w-full justify-between h-12 rounded-xl bg-white/5 hover:bg-white/10 text-white font-jakarta text-xs font-semibold px-4 border border-white/5"
                      >
                        <span className="flex items-center gap-2">
                          <Zap className="h-3.5 w-3.5 text-blue-400" />
                          Originating Deal
                        </span>
                        <ChevronRight className="h-4 w-4 text-slate-500" />
                      </Button>
                    )}
                    {customer.company_id && (
                      <Button 
                        variant="ghost" 
                        onClick={() => navigate(`/crm/customers/companies/${customer.company_id}`)}
                        className="w-full justify-between h-12 rounded-xl bg-white/5 hover:bg-white/10 text-white font-jakarta text-xs font-semibold px-4 border border-white/5"
                      >
                        <span className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 text-indigo-400" />
                          Parent Entity
                        </span>
                        <ChevronRight className="h-4 w-4 text-slate-500" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Strategic Tags */}
            <Card className="border-0 shadow-card rounded-3xl p-8 bg-white">
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Strategic Tags</h4>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                  <Settings className="h-4 w-4 text-slate-400" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {Array.isArray(customer.tags) && customer.tags.length > 0 ? (
                  customer.tags.map((tag: string) => (
                    <Badge key={tag} className="bg-slate-50 text-slate-600 border-slate-100 hover:bg-blue-50 hover:text-blue-600 transition-colors py-1.5 px-4 rounded-lg font-jakarta font-semibold text-[11px]">
                      {tag}
                    </Badge>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center w-full py-8 text-center border-2 border-dashed border-slate-50 rounded-2xl">
                    <Tag className="h-8 w-8 text-slate-100 mb-2" />
                    <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">No tags classified</p>
                  </div>
                )}
              </div>
              <Button variant="outline" className="w-full mt-6 rounded-xl border-slate-100 h-11 text-xs font-bold font-jakarta text-slate-500 hover:text-blue-600 hover:border-blue-100">
                <Plus className="h-3.5 w-3.5 mr-2" />
                Add Segment Tag
              </Button>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

// Missing Lucide import for v4 icons I used
function Share2(props: any) {
  return <ExternalLink {...props} />;
}
