import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Trash2, Save, ArrowRightLeft, Phone, Mail, Globe,
  MapPin, Building2, User, Calendar, DollarSign, Tag, FileText,
  Activity, MessageSquare, Clock, Star, MoreHorizontal, Copy,
  CheckCircle, XCircle, AlertCircle, Zap, ChevronRight,
  TrendingUp, Users, Target, Award, Check, Briefcase, Calendar as CalendarIcon, Edit3, Send, PhoneCall, Eye, Filter, Search, Settings, Share2, Printer, Download, Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InteractionPanel } from "@/components/crm/InteractionPanel";
import { CreatableSelect } from "@/components/crm/CreatableSelect";
import { EntityFilesSection } from "@/components/crm/EntityFilesSection";
import { CustomFieldsSection, DraggableFieldItem } from "@/components/crm/CustomFieldsSection";
import { GripVertical } from "lucide-react";
import { FieldDragWrapper } from "@/components/crm/FieldDragWrapper";
import { DroppableSection } from "@/components/crm/DroppableSection";
import { mergeFieldsWithTemplates, saveCustomFieldTemplates } from "@/utils/crm/customFieldsRegistry";
import { sanitizePayload } from "@/utils/crm/sanitize";

import { WorkspaceShareModal } from "@/components/crm/leads/WorkspaceShareModal";
import { useLead, useInteractionHistory } from "@/hooks/useCrmInteractions";
import { useUpdateLead, useDeleteLead, useConvertLeadToDeal } from "@/hooks/useCrmMutations";
import { useCreateActivity } from "@/hooks/useCrmInteractions";
import { useLeadStats } from "@/hooks/useCrmData";
import { useOrganizationProfiles } from "@/hooks/useTenantQuery";
import { usePipelineStages, useCreatePipelineStage, useDeletePipelineStage, useUpdatePipelineStage } from "@/hooks/usePipelineStages";
import { useSoftphone } from "@/contexts/SoftphoneContext";
import { ClickToCall } from "@/components/telephony/ClickToCall";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, isValid } from "date-fns";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const defaultServiceOptions = [
  { value: "Web Development", label: "Web Development" },
  { value: "Mobile App Development", label: "Mobile App Development" },
  { value: "Digital Marketing", label: "Digital Marketing" },
  { value: "SEO Services", label: "SEO Services" },
  { value: "Consulting", label: "Consulting" },
  { value: "Design Services", label: "Design Services" },
  { value: "E-commerce Solutions", label: "E-commerce Solutions" },
  { value: "Cloud Services", label: "Cloud Services" }
];

const customerTypeOptions = [
  { value: "lead", label: "Lead" },
  { value: "prospect", label: "Prospect" },
  { value: "customer", label: "Customer" },
  { value: "partner", label: "Partner" },
];

const sourceOptions = [
  { value: "call", label: "Call" },
  { value: "website", label: "Website" },
  { value: "referral", label: "Referral" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "email", label: "Email" },
  { value: "event", label: "Event" },
  { value: "advertisement", label: "Advertisement" },
  { value: "partner", label: "Partner" },
  { value: "other", label: "Other" },
];

const companySizeOptions = [
  { value: "1-10", label: "1-10 employees" },
  { value: "11-50", label: "11-50 employees" },
  { value: "51-200", label: "51-200 employees" },
  { value: "201-500", label: "201-500 employees" },
  { value: "501-1000", label: "501-1000 employees" },
  { value: "1000+", label: "1000+ employees" },
];

const phoneTypeOptions = [
  { value: "work", label: "Work Phone" },
  { value: "mobile", label: "Mobile" },
  { value: "home", label: "Home" },
  { value: "other", label: "Other" },
];

const emailTypeOptions = [
  { value: "work", label: "Work" },
  { value: "personal", label: "Personal" },
  { value: "other", label: "Other" },
];

const websiteTypeOptions = [
  { value: "corporate", label: "Corporate" },
  { value: "personal", label: "Personal" },
  { value: "portfolio", label: "Portfolio" },
  { value: "other", label: "Other" },
];

const currencyOptions = [
  { value: "USD", label: "US Dollar" },
  { value: "EUR", label: "Euro" },
  { value: "GBP", label: "British Pound" },
  { value: "AED", label: "UAE Dirham" },
];

const yesNoOptions = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unknown", label: "Not selected" },
];
// Professional Field component for enterprise-level forms
interface FieldProps {
  label: string;
  value: string | undefined | null;
  onChange: (value: string) => void;
  editing: boolean;
  icon?: React.ReactNode;
  multiline?: boolean;
  type?: string;
  placeholder?: string;
  required?: boolean;
  entityId?: string;
}

function Field({ label, value, onChange, editing, icon, multiline, type = "text", placeholder, required, entityId }: FieldProps) {
  if (!editing && !value) {
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground flex items-center gap-1">
          {icon}
          {label}
          {required && <span className="text-red-500">*</span>}
        </Label>
        <div className="min-h-[2.5rem] px-3 py-2 border border-border rounded-lg bg-muted/40 flex items-center">
          <span className="text-muted-foreground italic">Not specified</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground flex items-center gap-1">
        {icon}
        {label}
        {required && <span className="text-red-500">*</span>}
      </Label>
      {editing ? (
        multiline ? (
          <Textarea
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="min-h-[100px] resize-none"
          />
        ) : (
          <Input
            type={type}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="h-10"
          />
        )
      ) : (
        <div className="min-h-[2.5rem] px-3 py-2 border border-border rounded-lg bg-muted/40 flex items-center overflow-hidden">
          {type === "tel" ? (
            <ClickToCall
              phoneNumber={value || ""}
              entityType="lead"
              entityId={entityId || ""}
              className="font-medium break-words w-full text-left"
            />
          ) : type === "email" ? (
            <a href={`mailto:${value}`} className="text-primary hover:underline font-medium break-words w-full">{value}</a>
          ) : type === "date" && value && isValid(new Date(value)) ? (
            <span className="text-foreground font-medium break-words w-full">
              {format(new Date(value), "MMM d, yyyy")}
            </span>
          ) : type === "datetime-local" && value && isValid(new Date(value)) ? (
            <span className="text-foreground font-medium break-words w-full">
              {format(new Date(value), "MMM d, yyyy HH:mm")}
            </span>
          ) : (
            <span className="text-foreground font-medium break-words w-full">{value}</span>
          )}
        </div>
      )}
    </div>
  );
}

function displayJsonValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === "string") return parsed;
      return JSON.stringify(parsed, null, 2);
    } catch {
      return value;
    }
  }
  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}
// Enterprise-level pipeline stages with professional styling
const defaultPipelineStages = [
  {
    id: "new",
    label: "New Lead",
    color: "bg-primary",
    bgColor: "bg-primary/5",
    textColor: "text-primary",
    borderColor: "border-primary/20",
    icon: <AlertCircle className="h-4 w-4" />,
    description: "Fresh lead, needs initial contact"
  },
  {
    id: "contacted",
    label: "Contacted",
    color: "bg-yellow-500",
    bgColor: "bg-yellow-50",
    textColor: "text-yellow-700",
    borderColor: "border-yellow-200",
    icon: <PhoneCall className="h-4 w-4" />,
    description: "Initial contact made"
  },
  {
    id: "qualified",
    label: "Qualified",
    color: "bg-green-500",
    bgColor: "bg-green-50",
    textColor: "text-green-700",
    borderColor: "border-green-200",
    icon: <CheckCircle className="h-4 w-4" />,
    description: "Lead meets criteria"
  },
  {
    id: "proposal",
    label: "Proposal Sent",
    color: "bg-purple-500",
    bgColor: "bg-purple-50",
    textColor: "text-purple-700",
    borderColor: "border-purple-200",
    icon: <Send className="h-4 w-4" />,
    description: "Proposal delivered"
  },
  {
    id: "negotiation",
    label: "Negotiation",
    color: "bg-orange-500",
    bgColor: "bg-orange-50",
    textColor: "text-orange-700",
    borderColor: "border-orange-200",
    icon: <Target className="h-4 w-4" />,
    description: "Terms being discussed"
  },
  {
    id: "unqualified",
    label: "Unqualified",
    color: "bg-red-500",
    bgColor: "bg-red-50",
    textColor: "text-red-700",
    borderColor: "border-red-200",
    icon: <XCircle className="h-4 w-4" />,
    description: "Does not meet criteria"
  },
];

const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'qualified': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'contacted': return 'bg-primary/5 text-primary border-primary/20';
    case 'unqualified': return 'bg-red-50 text-red-700 border-red-200';
    case 'new': return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'proposal': return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'negotiation': return 'bg-orange-50 text-orange-700 border-orange-200';
    default: return ' text-muted-foreground ';
  }
};

const getStatusIcon = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'qualified': return <CheckCircle className="h-4 w-4" />;
    case 'contacted': return <PhoneCall className="h-4 w-4" />;
    case 'unqualified': return <XCircle className="h-4 w-4" />;
    case 'new': return <AlertCircle className="h-4 w-4" />;
    case 'proposal': return <Send className="h-4 w-4" />;
    case 'negotiation': return <Target className="h-4 w-4" />;
    default: return <Clock className="h-4 w-4" />;
  }
};
export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: lead, isLoading, error } = useLead(id!);
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();
  const convertLeadToDeal = useConvertLeadToDeal();
  const createActivity = useCreateActivity();
  const { dialNumber } = useSoftphone();
  const { data: leadStats } = useLeadStats();
  const { data: members = [] } = useOrganizationProfiles();

  const [editing, setEditing] = useState(() => window.location.pathname.endsWith('/edit'));
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [customFields, setCustomFields] = useState<{ id: string; key: string; value: string; type?: string; sectionId?: string }[]>([]);

  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [showStageManager, setShowStageManager] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editingStageName, setEditingStageName] = useState("");
  const { data: dbStages = [] } = usePipelineStages();
  const createStage = useCreatePipelineStage();
  const deleteStage = useDeletePipelineStage();
  const updateStage = useUpdatePipelineStage();

  const customDbStages = dbStages
    .filter(s => !defaultPipelineStages.some(d => d.id === s.stage_key))
    .map(s => ({
      id: s.stage_key,
      label: s.stage_label,
      color: "bg-gray-500",
      bgColor: "bg-muted/40",
      textColor: "text-foreground",
      borderColor: "border-border",
      icon: <Target className="h-4 w-4" />,
      description: "Custom stage",
      dbId: s.id,
    }));

  const pipelineStages = [...defaultPipelineStages, ...customDbStages];
  const [sidebarTab, setSidebarTab] = useState("activity");
  const [interactionTab, setInteractionTab] = useState("activity");
  const activitySectionRef = useRef<HTMLDivElement>(null);

  const handleScrollToActivity = (tab: string = "activity", innerTab: string = "activity") => {
    setSidebarTab(tab);
    setInteractionTab(innerTab);
    setTimeout(() => {
      activitySectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    if (!lead) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(lead, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `lead_${lead.id}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    toast.success("Lead data exported successfully");
  };

  useEffect(() => {
    if (lead) {
      setForm({
        title: lead.title,
        stage: lead.stage,
        status: lead.status,
        assigned_to: lead.assigned_to,
        company_name: lead.company_name,
        designation: lead.designation,
        phone: lead.phone,
        email: lead.email,
        website: lead.website,
        address: lead.address,
        company_phone: lead.company_phone,
        company_email: lead.company_email,
        interaction_notes: lead.interaction_notes,
        service_interested: lead.service_interested,
        value: lead.value,
        currency: lead.currency,
        source: lead.source,
        source_info: lead.source_info,
        agent_name: lead.agent_name,
        customer_type: lead.customer_type,
        company_size: lead.company_size,
        decision_maker: lead.decision_maker,
        // Additional imported fields
        notes: lead.notes,
        priority: lead.priority,
        pipeline: lead.pipeline,
        tags: lead.tags,
        expected_close_date: lead.expected_close_date && isValid(new Date(lead.expected_close_date)) ? format(new Date(lead.expected_close_date), "yyyy-MM-dd") : "",
        last_contacted_date: lead.last_contacted_date && isValid(new Date(lead.last_contacted_date)) ? format(new Date(lead.last_contacted_date), "yyyy-MM-dd") : "",
        next_follow_up_date: lead.next_follow_up_date && isValid(new Date(lead.next_follow_up_date)) ? format(new Date(lead.next_follow_up_date), "yyyy-MM-dd") : "",
        first_message: lead.first_message,
        last_touch: lead.last_touch,
        phone_type: lead.phone_type,
        email_type: lead.email_type,
        website_type: lead.website_type,
        responsible_person: lead.responsible_person,
        external_source_id: lead.external_source_id,
        createdAt: lead.created_at && isValid(new Date(lead.created_at)) ? format(new Date(lead.created_at), "yyyy-MM-dd'T'HH:mm") : "",
      });

      if (lead.custom_fields && typeof lead.custom_fields === 'object') {
        const fields = Object.entries(lead.custom_fields).map(([k, v]) => {
          if (v && typeof v === 'object' && 'value' in v) {
            return { 
              id: k, 
              id: `template-${k.replace(/\s+/g, '-').toLowerCase()}-${Math.random().toString(36).substr(2, 5)}`, 
              key: k, 
              value: String((v as any).value), 
              type: (v as any).type || 'string',
              sectionId: (v as any).sectionId 
            };
          }
          return { id: `template-${k.replace(/\s+/g, '-').toLowerCase()}-${Math.random().toString(36).substr(2, 5)}`, key: k, value: String(v), type: 'string', sectionId: 'custom-fields' };
        });
        // Merge with templates to show empty "standard" custom fields
        const mergedFields = mergeFieldsWithTemplates('lead', fields);
        setCustomFields(mergedFields);
      } else {
        // No custom fields on record, show templates
        setCustomFields(mergeFieldsWithTemplates('lead', []));
      }
    }
  }, [lead]);

  const handleSave = () => {
    const changes: Record<string, unknown> = {};
    Object.entries(form).forEach(([key, val]) => {
      if (val !== (lead as Record<string, unknown>)[key]) changes[key] = val;
    });

    const customFieldsObj = customFields.reduce((acc, field) => {
      if (field.key.trim()) acc[field.key.trim()] = { 
        value: field.value, 
        type: field.type || 'string',
        sectionId: field.sectionId 
      };
      return acc;
    }, {} as Record<string, { value: string; type: string; sectionId?: string }>);

    const leadCustomFields = lead.custom_fields || {};
    const customFieldsChanged = JSON.stringify(customFieldsObj) !== JSON.stringify(leadCustomFields);

    if (Object.keys(changes).length === 0 && !customFieldsChanged) {
      saveCustomFieldTemplates('lead', customFields);
      setEditing(false);
      return;
    }

    const formattedChanges: Record<string, unknown> = { ...changes };
    if (formattedChanges.last_contacted_date) formattedChanges.last_contacted_date = new Date(formattedChanges.last_contacted_date as string).toISOString();
    if (formattedChanges.next_follow_up_date) formattedChanges.next_follow_up_date = new Date(formattedChanges.next_follow_up_date as string).toISOString();
    if (formattedChanges.expected_close_date) formattedChanges.expected_close_date = new Date(formattedChanges.expected_close_date as string).toISOString();
    if (formattedChanges.createdAt) formattedChanges.createdAt = new Date(formattedChanges.createdAt as string).toISOString();

    updateLead.mutate(sanitizePayload({
      id: lead.id,
      ...formattedChanges,
      customFields: customFieldsObj
    }), {
      onSuccess: () => {
        saveCustomFieldTemplates('lead', customFields);
        setEditing(false);
      },
    });
  };

  const handleConvertToDeal = () => {
    convertLeadToDeal.mutate(lead.id, {
      onSuccess: (data: any) => {
        setShowConvertDialog(false);
        navigate(`/crm/deals/${data.dealId || data.id}`);
      },
    });
  };

  const handleDelete = () => {
    deleteLead.mutate(lead.id, {
      onSuccess: () => {
        setShowDeleteDialog(false);
        navigate('/crm/leads');
      },
    });
  };

  const handleStageChange = (newStage: string) => {
    setForm(prev => ({ ...prev, stage: newStage }));
    if (!editing) {
      updateLead.mutate({ id: lead.id, stage: newStage }, {
        onSuccess: () => {
          const stageName = pipelineStages.find(s => s.id === newStage)?.label || newStage;
          createActivity.mutate({
            entityType: 'lead',
            entityId: lead.id,
            activityType: 'stage_change',
            title: `Stage changed to ${stageName}`,
            description: `Lead pipeline stage updated to ${stageName}`,
          });
        }
      });
    }
  };

  const set = (key: string, val: unknown) => setForm(prev => ({ ...prev, [key]: val }));

  const handleFieldDropToSection = (fieldKey: string, fieldValue: string, sectionId: string) => {
    console.log(`Field ${fieldKey} moved to ${sectionId}`);
  };

  const renderDroppedFields = (sectionId: string) => {
    const sectionFields = customFields.filter(f => f.sectionId === sectionId);
    if (sectionFields.length === 0) return null;

    const updateField = (id: string, updates: Partial<CustomField>) => {
      setCustomFields(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
    };

    return (
      <div className="mt-6 pt-6 border-t border-dashed border-border space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider bg-primary/5 text-primary border-primary/20">
            Custom Fields
          </Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sectionFields.map((field) => (
            <div key={field.id} className="group relative">
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{field.key}</Label>
                {editing && (
                  <DraggableFieldItem fieldKey={field.id}>
                    <div className="p-1 cursor-grab active:cursor-grabbing text-primary hover:text-primary-foreground hover:bg-primary rounded transition-all">
                      <GripVertical className="h-3.5 w-3.5" />
                    </div>
                  </DraggableFieldItem>
                )}
              </div>
              
              {editing ? (
                field.type === "boolean" ? (
                  <Select
                    value={field.value}
                    onValueChange={(v) => updateField(field.id, { value: v })}
                  >
                    <SelectTrigger className="h-10 border-slate-200">
                      <SelectValue placeholder="Select Yes/No" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Yes">Yes</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type={field.type === "date" ? "date" : field.type === "datetime" ? "datetime-local" : field.type === "number" || field.type === "money" ? "number" : "text"}
                    placeholder={field.type === "money" ? "0.00" : "Enter value..."}
                    value={field.value}
                    onChange={(e) => updateField(field.id, { value: e.target.value })}
                    className="h-10 border-slate-200 focus-visible:ring-primary/20"
                  />
                )
              ) : (
                <div className="min-h-[2.5rem] px-3 py-2 border border-border rounded-lg bg-slate-50/50 flex items-center">
                  <span className="text-foreground font-medium">{field.value}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center  p-8 rounded-2xl shadow-xl border ">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Loading Lead Details</h3>
          <p className="text-muted-foreground">Please wait while we fetch the information...</p>
        </div>
      </div>
    );
  }

  if (!lead && !deleteLead.isPending && !deleteLead.isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-primary/5 flex items-center justify-center">
        <div className="text-center  p-8 rounded-2xl shadow-xl border  max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Lead Not Found</h2>
          <p className="text-muted-foreground mb-6">The lead you're looking for doesn't exist or may have been removed.</p>
          <Button onClick={() => navigate('/crm/leads')} className="bg-primary hover:bg-primary/90 text-white px-6 py-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Leads
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen ">
      {/* Enterprise Header with Breadcrumb Navigation */}
      <div className=" border-b  shadow-sm">
        <div className="px-6 py-4">
          {/* Professional Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm  mb-6">
            <span className="hover:text-muted-foreground cursor-pointer">CRM</span>
            <ChevronRight className="h-4 w-4" />
            <span className="hover:text-muted-foreground cursor-pointer" onClick={() => navigate('/crm/leads')}>Leads</span>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground font-medium">{lead.title}</span>
          </nav>

          {/* Header Content */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/crm/leads")}
                className="gap-2 text-muted-foreground hover:text-foreground hover:bg-muted self-start md:self-auto"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Leads
              </Button>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="relative">
                  <Avatar className="h-14 w-14 ring-4 ring-white shadow-lg">
                    <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${lead.title}`} />
                    <AvatarFallback className="bg-foreground text-white font-bold text-lg">
                      {lead.title?.split(' ').map(n => n[0]).join('').toUpperCase() || 'L'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-2 border-white rounded-full"></div>
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-3 mb-1">
                    <h1 className="text-xl md:text-2xl font-bold text-white break-words max-w-[200px] sm:max-w-none">{lead.title}</h1>
                    <Badge className={cn("gap-1 px-3 py-1 font-medium whitespace-nowrap", getStatusColor(lead.status))}>
                      {getStatusIcon(lead.status)}
                      {lead.status || 'New Lead'}
                    </Badge>

                    {!editing && (
                      <div className="flex items-center gap-2 ml-2">
                        {lead.phone && (
                          <ClickToCall
                            phoneNumber={lead.phone}
                            entityType="lead"
                            entityId={id}
                            className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white border-none shadow-sm transition-all hover:scale-105 active:scale-95"
                          />
                        )}
                        {lead.email && (
                          <Button
                            variant="default"
                            size="sm"
                            className="h-8 gap-1.5 bg-primary hover:bg-primary/90 text-white text-xs shadow-sm transition-all hover:scale-105 active:scale-95"
                            asChild
                          >
                            <a href={`mailto:${lead.email}`}>
                              <Mail className="h-3.5 w-3.5" />
                              Email
                            </a>
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                    <div className="flex items-center gap-2 text-white-600">
                      <Building2 className="h-4 w-4 shrink-0" />
                      <span className="font-medium break-words">{lead.company_name || 'No Company'}</span>
                    </div>
                    {lead.value && (
                      <div className="flex items-center gap-1 text-emerald-600 font-semibold">
                        <DollarSign className="h-4 w-4" />
                        <span>${Number(lead.value).toLocaleString()}</span>
                      </div>
                    )}
                    {lead.created_at && (
                      <div className="flex items-center gap-1  whitespace-nowrap">
                        <CalendarIcon className="h-4 w-4" />
                        <span>Created {format(new Date(form.createdAt as string || lead.created_at), 'MMM d, yyyy')}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            {/* Professional Action Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              {editing ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => { setEditing(false); setForm({ ...lead }); }}
                    className="gap-2  text-muted-foreground"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={updateLead.isPending}
                    className="gap-2 bg-primary hover:bg-primary/90 text-white shadow-lg"
                  >
                    <Save className="h-4 w-4" />
                    {updateLead.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setEditing(true)}
                    className="gap-2 "
                  >
                    <Edit3 className="h-4 w-4" />
                    Edit Lead
                  </Button>

                  {lead.status === 'converted' || lead.converted_to_deal_id ? (
                    <Button
                      className="gap-2 bg-muted text-muted-foreground hover:bg-muted border  shadow-sm"
                      onClick={() => navigate(`/crm/deals/${lead.converted_to_deal_id || ''}`)}
                    >
                      <Target className="h-4 w-4 text-emerald-600" />
                      View Converted Deal
                    </Button>
                  ) : (
                    <Button
                      className="gap-2 bg-primary hover:bg-primary/90 text-white shadow-lg"
                      onClick={() => setShowConvertDialog(true)}
                    >
                      <ArrowRightLeft className="h-4 w-4" />
                      Convert to Deal
                    </Button>
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" className="h-10 w-10   hover: hover:border-primary transition-all shadow-sm group">
                        <MoreHorizontal className="h-5 w-5  group-hover:text-foreground transition-colors" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-80 max-h-[450px] overflow-y-auto p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.2)]  z-[100]  rounded-xl animate-in fade-in-0 transform-gpu zoom-in-95">
                      <DropdownMenuLabel className="px-2.5 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em]">Communication</DropdownMenuLabel>
                      {lead.email && (
                        <DropdownMenuItem
                          className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer hover: transition-all group"
                          onSelect={() => copyToClipboard(lead.email, 'Email')}
                        >
                          <div className="p-2 bg-blue-50 rounded-md group-hover:bg-blue-100 transition-colors">
                            <Mail className="h-4 w-4 text-blue-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-sm text-foreground">Copy Email Address</p>
                            <p className="text-xs  truncate">{lead.email}</p>
                          </div>
                        </DropdownMenuItem>
                      )}
                      {lead.phone && (
                        <DropdownMenuItem
                          className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer hover: transition-all group"
                          onSelect={() => copyToClipboard(lead.phone, 'Phone')}
                        >
                          <div className="p-2 bg-emerald-50 rounded-md group-hover:bg-emerald-100 transition-colors">
                            <Phone className="h-4 w-4 text-emerald-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-sm text-foreground">Copy Phone Number</p>
                            <p className="text-xs ">{lead.phone}</p>
                          </div>
                        </DropdownMenuItem>
                      )}

                      <DropdownMenuSeparator className="my-1.5 bg-muted" />

                      <DropdownMenuLabel className="px-2.5 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em]">Quick Jump</DropdownMenuLabel>
                      <DropdownMenuItem
                        className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer hover: transition-all group"
                        onSelect={() => handleScrollToActivity("activity")}
                      >
                        <div className="p-2 bg-purple-50 rounded-md group-hover:bg-purple-100 transition-colors">
                          <Eye className="h-4 w-4 text-purple-600" />
                        </div>
                        <p className="font-semibold text-sm text-foreground flex-1">View Activity Timeline</p>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer hover:bg-orange-50/50 transition-all group"
                        onSelect={() => handleScrollToActivity("activity", "booking")}
                      >
                        <div className="p-2 bg-orange-50 rounded-md group-hover:bg-orange-100 transition-colors">
                          <Calendar className="h-4 w-4 text-orange-600" />
                        </div>
                        <p className="font-semibold text-sm text-foreground flex-1">Schedule Meeting</p>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer hover:bg-indigo-50/50 transition-all group"
                        onSelect={() => handleScrollToActivity("activity", "message")}
                      >
                        <div className="p-2 bg-indigo-50 rounded-md group-hover:bg-indigo-100 transition-colors">
                          <MessageSquare className="h-4 w-4 text-indigo-600" />
                        </div>
                        <p className="font-semibold text-sm text-foreground flex-1">Send Message</p>
                      </DropdownMenuItem>

                      <DropdownMenuSeparator className="my-1.5 bg-muted" />

                      <DropdownMenuLabel className="px-2.5 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em]">Reports & Data</DropdownMenuLabel>
                      <DropdownMenuItem
                        className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer hover: transition-all group"
                        onSelect={handlePrint}
                      >
                        <div className="p-2 bg-orange-50 rounded-md group-hover:bg-orange-100 transition-colors">
                          <Printer className="h-4 w-4 text-orange-600" />
                        </div>
                        <p className="font-semibold text-sm text-foreground flex-1">Print Lead Details</p>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer hover: transition-all group"
                        onSelect={handleExport}
                      >
                        <div className="p-2 bg-emerald-50 rounded-md group-hover:bg-emerald-100 transition-colors">
                          <Download className="h-4 w-4 text-emerald-600" />
                        </div>
                        <p className="font-semibold text-sm text-foreground flex-1">Export as JSON</p>
                      </DropdownMenuItem>

                      <DropdownMenuSeparator className="my-1.5 bg-muted" />

                      <DropdownMenuLabel className="px-2.5 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em]">Access & Admin</DropdownMenuLabel>
                      <DropdownMenuItem
                        className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer hover: transition-all group"
                        onSelect={() => setShowWorkspaceModal(true)}
                      >
                        <div className="p-2 bg-muted rounded-md group-hover:bg-muted transition-colors">
                          <Share2 className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className="font-semibold text-sm text-foreground flex-1">Manage Workspace Access</p>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer hover:bg-orange-50 group transition-all"
                        onSelect={() => {
                          updateLead.mutate({ id: lead.id, status: 'unqualified', stage: 'unqualified' }, {
                            onSuccess: () => {
                              toast.success("Lead marked as unqualified");
                              createActivity.mutate({
                                entityType: 'lead',
                                entityId: lead.id,
                                activityType: 'status_change',
                                title: 'Marked as Unqualified',
                                description: 'Lead has been moved to the unqualified section',
                              });
                            }
                          });
                        }}
                      >
                        <div className="p-2 bg-orange-50 rounded-md group-hover:bg-orange-100 transition-colors">
                          <XCircle className="h-4 w-4 text-orange-600" />
                        </div>
                        <p className="font-semibold text-sm text-orange-600 flex-1">Mark as Unqualified</p>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer hover:bg-red-50 text-red-600 transition-all group"
                        onSelect={() => setShowDeleteDialog(true)}
                      >
                        <div className="p-2 bg-red-50 rounded-md group-hover:bg-red-100 transition-colors">
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </div>
                        <p className="font-semibold text-sm flex-1">Delete Lead</p>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Enterprise Pipeline Progress Tracker */}
      <div className="px-6 pb-6">
        <div className="rounded-xl p-6 border ">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white-900">Lead Progress Pipeline</h3>
              <p className="text-sm text-white-600">Track your lead through the sales process</p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => setShowStageManager(true)}
              >
                <Settings className="h-3.5 w-3.5" />
                Manage Stages
              </Button>
              <div className="text-right">
                <div className="text-sm ">Progress</div>
                <div className="text-lg font-bold text-white-900">
                  {Math.round(((pipelineStages.findIndex(s => s.id === (form.stage || lead.stage)) + 1) / pipelineStages.length) * 100)}%
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-200">
            <div className="flex gap-3 min-w-[800px] md:min-w-0">
              {pipelineStages.map((stage, index) => {
                const isActive = (form.stage || lead.stage) === stage.id;
                const isPassed = pipelineStages.findIndex(s => s.id === (form.stage || lead.stage)) > index;
                const isUnqualified = stage.id === 'unqualified' && isActive;
                return (
                  <div
                    key={stage.id}
                    onClick={() => handleStageChange(stage.id)}
                    className={cn(
                      "flex-1 relative cursor-pointer transition-all duration-300 rounded-xl p-4 border-2 group",
                      isActive && !isUnqualified
                        ? `${stage.bgColor} ${stage.borderColor} ${stage.textColor} shadow-lg transform scale-105`
                        : isActive && isUnqualified
                          ? "bg-red-50 border-red-200 text-red-700 shadow-lg"
                          : isPassed && !isUnqualified
                            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                            : "   hover: hover:"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all",
                        isActive && !isUnqualified
                          ? stage.color + " text-white shadow-md"
                          : isActive && isUnqualified
                            ? "bg-red-500 text-white shadow-md"
                            : isPassed && !isUnqualified
                              ? "bg-emerald-500 text-white shadow-md"
                              : "bg-muted text-muted-foreground group-hover:bg-muted-foreground"
                      )}>
                        {isPassed && !isUnqualified ? (
                          <CheckCircle className="h-5 w-5" />
                        ) : isActive ? (
                          stage.icon
                        ) : (
                          index + 1
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{stage.label}</p>
                        <p className="text-xs opacity-75">{stage.description}</p>
                      </div>
                    </div>
                    {isActive && (
                      <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-current rounded-full shadow-lg"></div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>


      {/* Enterprise Metrics Dashboard - Full Width Above Grid */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border shadow-sm bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-xl">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">Total Leads</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-foreground">{leadStats?.overview?.total_leads ?? '—'}</span>
                    <span className="text-xs text-muted-foreground">{leadStats?.overview?.qualified_leads ?? 0} qualified</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-xl">
                  <Target className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1">Pipeline Value</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-foreground">
                      ${leadStats?.overview?.total_value ? Number(leadStats.overview.total_value).toLocaleString() : '0'}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-100 rounded-xl">
                  <Clock className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-1">Days Active</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-foreground">
                      {lead.created_at ? Math.floor((new Date().getTime() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24)) : 0}
                    </span>
                    <span className="text-xs text-muted-foreground">days</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 rounded-xl">
                  <Activity className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-purple-600 uppercase tracking-widest mb-1">Last Update</p>
                  <p className="text-sm font-medium">{lead.last_touch ? format(new Date(lead.last_touch), 'MMM d, yyyy') : 'No interactions'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column - Lead Details */}
          <div className="lg:col-span-7 space-y-8">

            {/* Professional Form Sections */}
            <FieldDragWrapper
              customFields={customFields}
              onCustomFieldsChange={setCustomFields}
              onFieldDropToSection={handleFieldDropToSection}
              editing={editing}
            >
              <div className="space-y-8">
                {/* Lead and Company Details */}
                <DroppableSection id="lead-company-details" editing={editing}>
                  <Card className="border   shadow-sm">
                    <CardHeader className="border-b bg-muted/30 rounded-t-lg">
                      <CardTitle className="flex items-center gap-3 text-xl">
                        Lead and Company Details
                      </CardTitle>
                      <CardDescription>Core contact, company, and ownership details.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-b pb-8 mb-8">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-foreground flex items-center gap-2">
                            <Briefcase className="h-4 w-4" />
                            Pipeline
                          </Label>
                          <Select value={(form.pipeline as string) || "default"} onValueChange={(v) => set("pipeline", v)} disabled={!editing}>
                            <SelectTrigger className="h-10 border-border focus:border-primary focus:ring-2 focus:ring-primary/20">
                              <SelectValue placeholder="Select pipeline" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="default">Standard Pipeline</SelectItem>
                              <SelectItem value="marketing">Marketing Pipeline</SelectItem>
                              <SelectItem value="sales">Sales Pipeline</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-foreground">Stage</Label>
                          <Select value={(form.stage as string) || ""} onValueChange={(v) => set("stage", v)} disabled={!editing}>
                            <SelectTrigger className="h-10 border-border focus:border-primary focus:ring-2 focus:ring-primary/20">
                              <SelectValue placeholder="Select stage" />
                            </SelectTrigger>
                            <SelectContent>
                              {pipelineStages.map(stage => (
                                <SelectItem key={stage.id} value={stage.id}>{stage.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-foreground">Customer Type</Label>
                          <Select value={(form.customer_type as string) || ""} onValueChange={(v) => set("customer_type", v)} disabled={!editing}>
                            <SelectTrigger className="h-10 border-border focus:border-primary focus:ring-2 focus:ring-primary/20">
                              <SelectValue placeholder="not selected" />
                            </SelectTrigger>
                            <SelectContent>
                              {customerTypeOptions.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Lead owner
                          </label>
                          {editing ? (
                            <Select
                              value={form.assigned_to || "unassigned"}
                              onValueChange={(v) => set("assigned_to", v === "unassigned" ? null : v)}
                            >
                              <SelectTrigger className="bg-background border-border">
                                <SelectValue placeholder="Select owner..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unassigned">Unassigned</SelectItem>
                                {members.map((m) => (
                                  <SelectItem key={m.id} value={m.id}>
                                    <div className="flex items-center gap-2">
                                      <Avatar className="h-5 w-5">
                                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                          {m.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                        </AvatarFallback>
                                      </Avatar>
                                      {m.full_name}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="h-10 px-3 py-2 border rounded-lg bg-muted/40 flex items-center gap-2">
                              {form.assigned_to ? (
                                <>
                                  <Avatar className="h-6 w-6">
                                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                      {members.find(m => m.id === form.assigned_to)?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-foreground font-medium">
                                    {members.find(m => m.id === form.assigned_to)?.full_name || 'Assigned User'}
                                  </span>
                                </>
                              ) : (
                                <span className="text-muted-foreground italic">Unassigned</span>
                              )}
                            </div>
                          )}
                        </div>

                        <Field
                          label="Created Date"
                          value={editing ? (form.createdAt as string) : (form.createdAt ? format(new Date(form.createdAt as string), 'MMM d, yyyy HH:mm') : 'Not specified')}
                          onChange={(v) => set("createdAt", v)}
                          editing={editing}
                          type="datetime-local"
                          icon={<CalendarIcon className="h-4 w-4" />}
                          entityId={id}
                        />

                        <Field
                          label="Lead name"
                          value={form.title as string}
                          onChange={(v) => set("title", v)}
                          editing={editing}
                          icon={<User className="h-4 w-4" />}
                          required
                          entityId={id}
                        />
                        <Field
                          label="Company name"
                          value={form.company_name as string}
                          onChange={(v) => set("company_name", v)}
                          editing={editing}
                          icon={<Building2 className="h-4 w-4" />}
                          entityId={id}
                        />
                        <Field
                          label="Designation"
                          value={form.designation as string}
                          onChange={(v) => set("designation", v)}
                          editing={editing}
                          icon={<Briefcase className="h-4 w-4" />}
                          entityId={id}
                        />
                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-foreground">Personal Number</Label>
                          <div className="flex items-stretch gap-2">
                            {editing ? (
                              <Input
                                value={(form.phone as string) || ""}
                                onChange={(e) => set("phone", e.target.value)}
                                placeholder="+1 (555) 123-4567"
                                className="h-10 border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all flex-1"
                              />
                            ) : (
                              <div className="h-10 px-3 py-2 border border-border rounded-lg bg-muted/40 flex items-center flex-1">
                                {(form.phone as string) ? (
                                  <ClickToCall
                                    phoneNumber={form.phone as string}
                                    entityType="lead"
                                    entityId={id}
                                    className="text-sm font-medium text-foreground"
                                  />
                                ) : (
                                  <span className="text-muted-foreground italic">Not specified</span>
                                )}
                              </div>
                            )}
                            <Select value={(form.phone_type as string) || ""} onValueChange={(v) => set("phone_type", v)} disabled={!editing}>
                              <SelectTrigger className="h-10 w-[160px] border-border">
                                <SelectValue placeholder="Work Phone" />
                              </SelectTrigger>
                              <SelectContent>
                                {phoneTypeOptions.map(opt => (
                                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-foreground">Personal E-mail</Label>
                          <div className="flex items-stretch gap-2">
                            {editing ? (
                              <Input
                                type="email"
                                value={(form.email as string) || ""}
                                onChange={(e) => set("email", e.target.value)}
                                placeholder="john@example.com"
                                className="h-10 border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all flex-1"
                              />
                            ) : (
                              <div className="h-10 px-3 py-2 border border-border rounded-lg bg-muted/40 flex items-center flex-1 overflow-hidden">
                                {(form.email as string) ? (
                                  <a href={`mailto:${form.email}`} className="text-primary hover:underline font-medium break-words w-full">{form.email as string}</a>
                                ) : (
                                  <span className="text-muted-foreground italic">Not specified</span>
                                )}
                              </div>
                            )}
                            <Select value={(form.email_type as string) || ""} onValueChange={(v) => set("email_type", v)} disabled={!editing}>
                              <SelectTrigger className="h-10 w-[140px] border-border">
                                <SelectValue placeholder="Work" />
                              </SelectTrigger>
                              <SelectContent>
                                {emailTypeOptions.map(opt => (
                                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-foreground">Website</Label>
                          <div className="flex items-stretch gap-2">
                            {editing ? (
                              <Input
                                value={(form.website as string) || ""}
                                onChange={(e) => set("website", e.target.value)}
                                placeholder="https://example.com"
                                className="h-10 border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all flex-1"
                              />
                            ) : (
                              <div className="h-10 px-3 py-2 border border-border rounded-lg bg-muted/40 flex items-center flex-1 overflow-hidden">
                                {(form.website as string) ? (
                                  <a href={String(form.website)} target="_blank" rel="noreferrer" className="text-primary hover:underline font-medium break-words w-full">{form.website as string}</a>
                                ) : (
                                  <span className="text-muted-foreground italic">Not specified</span>
                                )}
                              </div>
                            )}
                            <Select value={(form.website_type as string) || ""} onValueChange={(v) => set("website_type", v)} disabled={!editing}>
                              <SelectTrigger className="h-10 w-[160px] border-border">
                                <SelectValue placeholder="Corporate" />
                              </SelectTrigger>
                              <SelectContent>
                                {websiteTypeOptions.map(opt => (
                                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="md:col-span-2 space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium text-foreground flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              Address
                            </Label>
                            <span className="text-xs text-primary">expand</span>
                          </div>
                          {editing ? (
                            <Textarea
                              value={(form.address as string) || ""}
                              onChange={(e) => set("address", e.target.value)}
                              className="min-h-[84px] resize-none border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                              placeholder="Address"
                            />
                          ) : (
                            <div className="min-h-[84px] px-3 py-2 border border-border rounded-lg bg-muted/40 flex items-start overflow-hidden">
                              <span className="whitespace-pre-wrap break-words text-foreground font-medium w-full">
                                {(form.address as string) || <span className="text-muted-foreground italic">Not specified</span>}
                              </span>
                            </div>
                          )}
                        </div>

                        <Field
                          label="Company Phone Number"
                          value={form.company_phone as string}
                          onChange={(v) => set("company_phone", v)}
                          editing={editing}
                          type="tel"
                          icon={<Phone className="h-4 w-4" />}
                          entityId={id}
                        />
                        <Field
                          label="Company Email"
                          value={form.company_email as string}
                          onChange={(v) => set("company_email", v)}
                          editing={editing}
                          icon={<Mail className="h-4 w-4" />}
                          entityId={id}
                        />
                      </div>
                      {renderDroppedFields("lead-company-details")}
                    </CardContent>
                  </Card>
                </DroppableSection>
                {/* Activity & Interaction Tracking */}
                <DroppableSection id="activity-tracking" editing={editing}>
                  <Card className="border   shadow-sm">
                    <CardHeader className="border-b bg-muted/30 rounded-t-lg">
                      <CardTitle className="flex items-center gap-3 text-xl">
                        Activity & Interaction Tracking
                      </CardTitle>
                      <CardDescription>Track touchpoints and follow-up timing.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <Field
                          label="Last Contacted Date"
                          value={form.last_contacted_date as string}
                          onChange={(v) => set("last_contacted_date", v)}
                          editing={editing}
                          type="date"
                          icon={<CalendarIcon className="h-4 w-4" />}
                          entityId={id}
                        />
                        <Field
                          label="Next Follow-up Date"
                          value={form.next_follow_up_date as string}
                          onChange={(v) => set("next_follow_up_date", v)}
                          editing={editing}
                          type="date"
                          icon={<CalendarIcon className="h-4 w-4" />}
                          entityId={id}
                        />
                        <div className="md:col-span-2">
                          <Field
                            label="All Interaction Notes With Dates"
                            value={form.interaction_notes as string}
                            onChange={(v) => set("interaction_notes", v)}
                            editing={editing}
                            multiline
                            icon={<FileText className="h-4 w-4" />}
                            placeholder="Add interaction notes..."
                            entityId={id}
                          />
                        </div>
                      </div>
                      {renderDroppedFields("activity-tracking")}
                    </CardContent>
                  </Card>
                </DroppableSection>

                {/* Qualification & Opportunity */}
                <DroppableSection id="qualification-opportunity" editing={editing}>
                  <Card className="border   shadow-sm">
                    <CardHeader className="border-b bg-muted/30 rounded-t-lg">
                      <CardTitle className="flex items-center gap-3 text-xl">

                        Qualification & Opportunity
                      </CardTitle>
                      <CardDescription>Capture the sales potential and buying intent.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-foreground flex items-center gap-1">
                            <Star className="h-4 w-4" />
                            Service Interested
                          </Label>
                          <CreatableSelect
                            label="Service Interested"
                            value={(form.service_interested as string) || ""}
                            onChange={(v) => set("service_interested", v)}
                            options={defaultServiceOptions}
                            disabled={!editing}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-foreground">Company Size</Label>
                          <Select value={(form.company_size as string) || ""} onValueChange={(v) => set("company_size", v)} disabled={!editing}>
                            <SelectTrigger className="h-10 border-border focus:border-primary focus:ring-2 focus:ring-primary/20">
                              <SelectValue placeholder="Company Size" />
                            </SelectTrigger>
                            <SelectContent>
                              {companySizeOptions.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-foreground">Estimated Opportunity Value</Label>
                          <div className="flex items-stretch gap-2">
                            <Input
                              type="number"
                              value={form.value !== undefined && form.value !== null ? String(form.value) : ""}
                              onChange={(e) => set("value", e.target.value ? Number(e.target.value) : null)}
                              disabled={!editing}
                              placeholder="0"
                              className="h-10 border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all flex-1"
                            />
                            <Select value={(form.currency as string) || ""} onValueChange={(v) => set("currency", v)} disabled={!editing}>
                              <SelectTrigger className="h-10 w-[170px] border-border">
                                <SelectValue placeholder="US Dollar" />
                              </SelectTrigger>
                              <SelectContent>
                                {currencyOptions.map(opt => (
                                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-foreground">Decision Maker Identified</Label>
                          <Select value={(form.decision_maker as string) || ""} onValueChange={(v) => set("decision_maker", v)} disabled={!editing}>
                            <SelectTrigger className="h-10 border-border focus:border-primary focus:ring-2 focus:ring-primary/20">
                              <SelectValue placeholder="not selected" />
                            </SelectTrigger>
                            <SelectContent>
                              {yesNoOptions.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <Field
                          label="Expected Close Date"
                          value={form.expected_close_date as string}
                          onChange={(v) => set("expected_close_date", v)}
                          editing={editing}
                          type="date"
                          icon={<CalendarIcon className="h-4 w-4" />}
                          entityId={id}
                        />

                        <Field
                          label="Responsible Person"
                          value={form.responsible_person as string}
                          onChange={(v) => set("responsible_person", v)}
                          editing={editing}
                          icon={<User className="h-4 w-4" />}
                          entityId={id}
                        />
                      </div>
                      {renderDroppedFields("qualification-opportunity")}
                    </CardContent>
                  </Card>
                </DroppableSection>

                {/* Source */}
                <DroppableSection id="source-section" editing={editing}>
                  <Card className="border   shadow-sm">
                    <CardHeader className="border-b bg-muted/30 rounded-t-lg">
                      <CardTitle className="flex items-center gap-3 text-xl">
                        Source
                      </CardTitle>
                      <CardDescription>Record where the lead came from and any source context.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <Field
                          label="Created on"
                          value={editing ? (form.createdAt as string) : (lead.created_at ? format(new Date(lead.created_at), "MMM d, yyyy") : "Not specified")}
                          onChange={(v) => set("createdAt", v)}
                          editing={editing}
                          type="datetime-local"
                          icon={<CalendarIcon className="h-4 w-4" />}
                          entityId={id}
                        />

                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-foreground">Source</Label>
                          <Select value={(form.source as string) || ""} onValueChange={(v) => set("source", v)} disabled={!editing}>
                            <SelectTrigger className="h-10 border-border focus:border-primary focus:ring-2 focus:ring-primary/20">
                              <SelectValue placeholder="Call" />
                            </SelectTrigger>
                            <SelectContent>
                              {sourceOptions.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="md:col-span-2 space-y-2">
                          <Label className="text-sm font-medium text-foreground">Source Information</Label>
                          {editing ? (
                            <Textarea
                              value={displayJsonValue(form.source_info)}
                              onChange={(e) => set("source_info", e.target.value)}
                              placeholder="Source Information"
                              className="min-h-[110px] resize-none border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                            />
                          ) : (
                            <div className="min-h-[110px] px-3 py-2 border border-border rounded-lg bg-muted/40 whitespace-pre-wrap text-foreground">
                              {displayJsonValue(form.source_info) || <span className="text-muted-foreground italic">Not specified</span>}
                            </div>
                          )}
                        </div>

                        <div className="md:col-span-2 space-y-2">
                          <Label className="text-sm font-medium text-foreground">Additional Notes</Label>
                          {editing ? (
                            <Textarea
                              value={(form.notes as string) || ""}
                              onChange={(e) => set("notes", e.target.value)}
                              placeholder="Add any extra context"
                              className="min-h-[110px] resize-none border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                            />
                          ) : (
                            <div className="min-h-[110px] px-3 py-2 border border-border rounded-lg bg-muted/40 whitespace-pre-wrap text-foreground font-medium">
                              {(form.notes as string) || <span className="text-muted-foreground italic">No additional notes</span>}
                            </div>
                          )}
                        </div>
                        <Field
                          label="External Source ID"
                          value={form.external_source_id as string}
                          onChange={(v) => set("external_source_id", v)}
                          editing={editing}
                          icon={<Target className="h-4 w-4" />}
                          placeholder="e.g. CRM-123"
                          entityId={id}
                        />
                      </div>
                      {renderDroppedFields("source-section")}
                    </CardContent>
                  </Card>
                </DroppableSection>

                <CustomFieldsSection
                  fields={customFields}
                  onChange={setCustomFields}
                  editing={editing}
                  className={!editing ? "opacity-90 pointer-events-none" : "animate-in fade-in slide-in-from-bottom-2 duration-300"}
                />

              </div>
            </FieldDragWrapper>
          </div>

          {/* Right Sidebar - Activity & Actions */}
          <div className="lg:col-span-5 space-y-6 sticky top-24">
            {/* Quick Actions Card - Top Position for Alignment */}
            <Card className="shadow-lg border-0 bg-background/60 backdrop-blur-sm">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  Lead Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 grid grid-cols-2 gap-3">
                {lead.phone && (
                  <ClickToCall
                    phoneNumber={lead.phone}
                    entityType="lead"
                    entityId={lead.id}
                    className="w-full"
                    customTrigger={
                      <Button variant="outline" className="w-full justify-start gap-2 h-10 border hover:bg-muted/50">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate">Call</span>
                      </Button>
                    }
                  />
                )}
                {lead.email && (
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 h-10 border hover:bg-muted/50"
                    onClick={() => window.open(`mailto:${lead.email}`, '_blank')}
                  >
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">Email</span>
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 h-10 border hover:bg-muted/50"
                  onClick={() => handleScrollToActivity("activity", "booking")}
                >
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">Schedule</span>
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 h-10 border hover:bg-muted/50"
                  onClick={() => setShowConvertDialog(true)}
                >
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">Convert</span>
                </Button>
              </CardContent>
            </Card>

            {/* Activity & Documents Dashboard */}
            <Card ref={activitySectionRef} className="shadow-lg border-0 overflow-hidden flex flex-col h-[750px]">
              <CardHeader className="pb-0 border-b bg-muted/20">
                <div className="flex items-center justify-between pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    Activity & Files
                  </CardTitle>
                </div>
                <Tabs value={sidebarTab} onValueChange={setSidebarTab} className="w-full">
                  <TabsList className="grid grid-cols-2 w-full h-12 bg-muted/20 p-1 rounded-md">
                    <TabsTrigger value="activity" className="text-sm">Timeline</TabsTrigger>
                    <TabsTrigger value="files" className="text-sm">Files</TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-hidden">
                <Tabs value={sidebarTab} className="h-full flex flex-col">
                  <TabsContent
                    value="activity"
                    forceMount={true}
                    className={cn(
                      "m-0 p-0 flex-1 overflow-y-auto",
                      sidebarTab !== "activity" && "hidden"
                    )}
                  >
                    <div className="p-4">
                      <InteractionPanel
                        entityType="lead"
                        entityId={lead.id}
                        activeTab={interactionTab}
                        onTabChange={setInteractionTab}
                        defaultPhone={lead.phone}
                      />
                    </div>
                  </TabsContent>
                  <TabsContent
                    value="files"
                    forceMount={true}
                    className={cn(
                      "m-0 p-0 flex-1 overflow-y-auto",
                      sidebarTab !== "files" && "hidden"
                    )}
                  >
                    <div className="p-4">
                      <EntityFilesSection entityType="lead" entityId={lead.id} />
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

          </div>
        </div>
      </div>



      {/* Stage Manager Dialog */}
      <Dialog open={showStageManager} onOpenChange={setShowStageManager}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              Manage Pipeline Stages
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              {defaultPipelineStages.map(s => (
                <div key={s.id} className="flex items-center justify-between px-3 py-2 rounded-lg border bg-muted/30">
                  <span className="text-sm font-medium">{s.label}</span>
                  <Badge variant="outline" className="text-[10px]">Default</Badge>
                </div>
              ))}
              {customDbStages.map(s => (
                <div key={s.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-primary/5">
                  {editingStageId === (s as any).dbId ? (
                    <>
                      <Input
                        value={editingStageName}
                        onChange={e => setEditingStageName(e.target.value)}
                        className="h-7 text-sm flex-1"
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter' && editingStageName.trim()) {
                            updateStage.mutate({ id: (s as any).dbId, stageName: editingStageName.trim() }, {
                              onSuccess: () => setEditingStageId(null)
                            });
                          }
                          if (e.key === 'Escape') setEditingStageId(null);
                        }}
                      />
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-primary"
                        disabled={!editingStageName.trim() || updateStage.isPending}
                        onClick={() => updateStage.mutate({ id: (s as any).dbId, stageName: editingStageName.trim() }, { onSuccess: () => setEditingStageId(null) })}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground"
                        onClick={() => setEditingStageId(null)}>
                        <XCircle className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm font-medium flex-1">{s.label}</span>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-primary"
                        onClick={() => { setEditingStageId((s as any).dbId); setEditingStageName(s.label); }}>
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => deleteStage.mutate((s as any).dbId)}
                        disabled={deleteStage.isPending}>
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-2 border-t">
              <Input
                placeholder="New stage name..."
                value={newStageName}
                onChange={e => setNewStageName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newStageName.trim()) {
                    createStage.mutate({ stageName: newStageName.trim() }, { onSuccess: () => setNewStageName("") });
                  }
                }}
                className="h-9"
              />
              <Button
                size="sm"
                className="gap-1.5 shrink-0"
                disabled={!newStageName.trim() || createStage.isPending}
                onClick={() => createStage.mutate({ stageName: newStageName.trim() }, { onSuccess: () => setNewStageName("") })}
              >
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStageManager(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Workspace Share Modal */}
      <WorkspaceShareModal
        leadId={lead.id}
        leadTitle={lead.title}
        currentWorkspaceName={lead.workspace_name}
        open={showWorkspaceModal}
        onClose={() => setShowWorkspaceModal(false)}
        onSuccess={() => {
          // Optionally refresh lead data or related associations
        }}
      />

      {/* Convert to Deal Confirmation Dialog */}
      <AlertDialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Target className="h-6 w-6 text-primary" />
              Convert Lead to Deal
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground py-2">
              This will create a new deal from this lead's information and move it to your deals pipeline. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConvertToDeal}
              disabled={convertLeadToDeal.isPending}
              className="bg-primary hover:bg-primary/80 h-10 px-6 font-semibold"
            >
              {convertLeadToDeal.isPending ? "Converting..." : "Yes, Convert to Deal"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Lead Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-xl font-bold text-red-600">
              <AlertCircle className="h-6 w-6" />
              Delete Lead
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground py-2">
              Are you sure you want to delete this lead? This action cannot be undone and will remove all associated data including activities, notes, and files.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteLead.isPending}
              className="bg-red-600 hover:bg-red-700 h-10 px-6 font-semibold"
            >
              {deleteLead.isPending ? "Deleting..." : "Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Workspace Management Modal */}
      <AlertDialog open={showWorkspaceModal} onOpenChange={setShowWorkspaceModal}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Share2 className="h-6 w-6 text-primary" />
              Workspace Access Control
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground py-2">
              Manage who has access to this lead and its associated files. You can invite team members, set permissions, and track who is currently viewing this record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex items-center justify-between p-3  rounded-lg border ">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">U</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-semibold">You (Owner)</p>
                  <p className="text-xs ">Full Access</p>
                </div>
              </div>
              <Badge variant="outline" className=" ">Owner</Badge>
            </div>
            <p className="text-xs text-center text-muted-foreground italic">Collaborative workspace features are coming soon to Rush CRM.</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowWorkspaceModal(false)} className="bg-primary hover:bg-primary/90 h-10 px-8 font-semibold">
              Close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
