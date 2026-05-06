import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@/lib/utils";
import {
  Loader2, Save, ArrowLeft, Building2, CalendarDays, MessageSquare,
  ChevronDown, Sparkles, Tag, Users, Calendar as CalendarIcon, Briefcase
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useOrganizationProfiles } from "@/hooks/useTenantQuery";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/crm/ui/PageHeader";
import { useCreateLead } from "@/hooks/useCrmData";
import { CreatableSelect } from "@/components/crm/CreatableSelect";
import { CustomFieldsSection, DraggableFieldItem } from "@/components/crm/CustomFieldsSection";
import { FieldDragWrapper } from "@/components/crm/FieldDragWrapper";
import { DroppableSection } from "@/components/crm/DroppableSection";
import { GripVertical } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format, isValid } from "date-fns";
import { getCustomFieldTemplates, saveCustomFieldTemplates } from "@/utils/crm/customFieldsRegistry";
import { sanitizePayload } from "@/utils/crm/sanitize";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Badge } from "@/components/ui/badge";

const leadSchema = z.object({
  title: z.string().min(2, "Lead name is required"),
  stage: z.string().min(1, "Stage is required"),
  status: z.string().optional(),
  customerType: z.string().optional(),
  source: z.string().optional(),
  sourceInfo: z.string().optional(),
  value: z.string().optional(),
  currency: z.string().optional(),
  notes: z.string().nullable().optional().or(z.literal("")),
  designation: z.string().optional(),
  phone: z.string().optional(),
  phoneType: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  emailType: z.string().optional(),
  website: z.string().url("Invalid website URL").optional().or(z.literal("")),
  websiteType: z.string().optional(),
  address: z.string().optional(),
  companyName: z.string().optional(),
  companyPhone: z.string().optional(),
  companyEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  companySize: z.string().optional(),
  serviceInterested: z.string().optional(),
  decisionMaker: z.string().optional(),
  interactionNotes: z.string().nullable().optional().or(z.literal("")),
  lastContactedDate: z.string().optional(),
  nextFollowUpDate: z.string().optional(),
  createdAt: z.string().optional(),
  assignedTo: z.string().optional().nullable(),
  expectedCloseDate: z.string().optional(),
  pipeline: z.string().optional(),
  responsiblePerson: z.string().optional(),
  externalSourceId: z.string().optional(),
});

type LeadForm = z.infer<typeof leadSchema>;

const stageOptions = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "proposal", label: "Proposal Sent" },
  { value: "negotiation", label: "Negotiation" },
  { value: "unqualified", label: "Unqualified" },
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

const serviceOptions = [
  { value: "Web Development", label: "Web Development" },
  { value: "Mobile App Development", label: "Mobile App Development" },
  { value: "Digital Marketing", label: "Digital Marketing" },
  { value: "SEO Services", label: "SEO Services" },
  { value: "Consulting", label: "Consulting" },
  { value: "Design Services", label: "Design Services" },
  { value: "E-commerce Solutions", label: "E-commerce Solutions" },
  { value: "Cloud Services", label: "Cloud Services" },
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

function SectionTitle({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-lg bg-slate-100 p-2.5">
        <Icon className="h-5 w-5 text-slate-700" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function LabeledInput({
  label,
  placeholder,
  fieldProps,
  type = "text",
  rightAddon,
  error,
}: {
  label: string;
  placeholder?: string;
  fieldProps: any;
  type?: string;
  rightAddon?: React.ReactNode;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      <div className="flex items-stretch gap-2">
        <Input
          type={type}
          placeholder={placeholder}
          {...fieldProps}
          className={cn("h-11", error && "border-destructive focus-visible:ring-destructive")}
        />
        {rightAddon}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function LabeledTextarea({
  label,
  placeholder,
  fieldProps,
  rows = 4,
  error,
}: {
  label: string;
  placeholder?: string;
  fieldProps: any;
  rows?: number;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      <Textarea
        rows={rows}
        placeholder={placeholder}
        {...fieldProps}
        className={cn(error && "border-destructive focus-visible:ring-destructive")}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function InlineSelect({
  value,
  onChange,
  placeholder,
  options,
  className,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  options: { value: string; label: string }[];
  className?: string;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className={cn(className || "w-[160px] h-11", error && "border-destructive")}>
          <SelectValue placeholder={placeholder || "Select"} />
        </SelectTrigger>
        <SelectContent>
          {options.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="text-[10px] text-destructive px-1">{error}</p>}
    </div>
  );
}

export default function CreateLeadPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const createLead = useCreateLead();

  const form = useForm<LeadForm>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      title: "",
      stage: "new",
      status: "new",
      customerType: "",
      source: "call",
      sourceInfo: "",
      value: "",
      currency: "USD",
      notes: "",
      designation: "",
      phone: "",
      phoneType: "work",
      email: "",
      emailType: "work",
      website: "",
      websiteType: "corporate",
      address: "",
      companyName: "",
      companyPhone: "",
      companyEmail: "",
      companySize: "",
      serviceInterested: "",
      decisionMaker: "",
      interactionNotes: "",
      lastContactedDate: "",
      nextFollowUpDate: "",
      createdAt: new Date().toISOString().split('T')[0],
      assignedTo: null,
      expectedCloseDate: "",
      pipeline: "default",
    },
  });

  const { data: members = [] } = useOrganizationProfiles();
  const { data: dbStages = [] } = usePipelineStages();

  const customDbStages = dbStages
    .filter(s => !stageOptions.some(d => d.value === s.stage_key))
    .map(s => ({
      value: s.stage_key,
      label: s.stage_label,
    }));

  const allStageOptions = [...stageOptions, ...customDbStages];

  const [contactId, setContactId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [customFields, setCustomFields] = useState<{ id: string; key: string; value: string; type?: string; sectionId?: string }[]>(() => {
    const templates = getCustomFieldTemplates('lead');
    return templates.map(t => ({
      id: `template-${Math.random().toString(36).substr(2, 9)}`,
      key: t.key,
      value: "",
      type: t.type,
      sectionId: "custom-fields"
    }));
  });

  const isSaving = createLead.isPending;
  const { handleSubmit, register, setValue, watch, formState: { errors } } = form;

  const onSubmit = (data: LeadForm) => {
    const payload = {
      title: data.title,
      stage: data.stage,
      status: data.status || data.stage,
      customerType: data.customerType || null,
      source: data.source || null,
      sourceInfo: data.sourceInfo || null,
      value: data.value ? Number(data.value) : undefined,
      currency: data.currency || "USD",
      notes: data.notes || null,
      designation: data.designation || null,
      phone: data.phone || null,
      phoneType: data.phoneType || null,
      email: data.email || null,
      emailType: data.emailType || null,
      website: data.website || null,
      websiteType: data.websiteType || null,
      address: data.address || null,
      companyName: data.companyName || null,
      companyPhone: data.companyPhone || null,
      companyEmail: data.companyEmail || null,
      companySize: data.companySize || null,
      serviceInterested: data.serviceInterested || null,
      decisionMaker: data.decisionMaker || null,
      interactionNotes: data.interactionNotes || null,
      lastContactedDate: data.lastContactedDate && isValid(new Date(data.lastContactedDate)) ? new Date(data.lastContactedDate).toISOString() : null,
      nextFollowUpDate: data.nextFollowUpDate && isValid(new Date(data.nextFollowUpDate)) ? new Date(data.nextFollowUpDate).toISOString() : null,
      expectedCloseDate: data.expectedCloseDate && isValid(new Date(data.expectedCloseDate)) ? new Date(data.expectedCloseDate).toISOString() : null,
      createdAt: data.createdAt && isValid(new Date(data.createdAt)) ? new Date(data.createdAt).toISOString() : new Date().toISOString(),
      lastTouch: new Date().toISOString(),
      assignedTo: data.assignedTo || null,
      pipeline: data.pipeline || 'default',
      responsiblePerson: data.responsiblePerson || null,
      externalSourceId: data.externalSourceId || null,
      customFields: customFields.reduce((acc, field) => {
        if (field.key.trim()) {
          acc[field.key.trim()] = { 
            value: field.value, 
            type: field.type || 'string',
            sectionId: field.sectionId || 'custom-fields'
          };
        }
        return acc;
      }, {} as Record<string, any>),
    } as Record<string, unknown>;

    createLead.mutate(sanitizePayload(payload), {
      onSuccess: () => {
        // Save these field definitions as templates for future leads
        saveCustomFieldTemplates('lead', customFields);
        
        toast({ title: "Lead created", description: data.title });
        navigate("/crm/leads");
      },
      onError: (err: any) => {
        toast({
          title: "Failed to create lead",
          description: err?.message || "Please try again",
          variant: "destructive",
        });
      },
    });
  };

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
          <SortableContext items={sectionFields.map(f => f.id)} strategy={verticalListSortingStrategy}>
            {sectionFields.map((field) => (
              <DraggableFieldItem key={field.id} fieldKey={field.id}>
                <div className="group relative">
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{field.key}</Label>
                    <DraggableFieldItem fieldKey={field.id} isHandle>
                      <div className="p-1 cursor-grab active:cursor-grabbing text-primary hover:text-primary-foreground hover:bg-primary rounded transition-all">
                        <GripVertical className="h-3.5 w-3.5" />
                      </div>
                    </DraggableFieldItem>
                  </div>
                  
                  {field.type === "boolean" ? (
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
                  )}
                </div>
              </DraggableFieldItem>
            ))}
          </SortableContext>
        </div>
      </div>
    );
  };

  const saveButton = (
    <Button onClick={handleSubmit(onSubmit)} disabled={isSaving} className="gap-2">
      {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
      {isSaving ? "Saving..." : "Save lead"}
    </Button>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Lead"
        description="Capture a new lead with custom fields support."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate(-1)} disabled={isSaving}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <FieldDragWrapper
          customFields={customFields}
          onCustomFieldsChange={setCustomFields}
          onFieldDropToSection={handleFieldDropToSection}
          editing={true}
        >
          <div className="space-y-6">
            <DroppableSection id="lead-company-details" editing={true}>
              <Card className="border shadow-sm rounded-xl">
                <CardHeader className="border-b">
                  <SectionTitle
                    icon={Building2}
                    title="Lead and Company Details"
                    description="Core contact, company, and ownership details."
                  />
                </CardHeader>
                <CardContent className="space-y-5 p-6">
                  <div className="grid gap-5 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground flex items-center gap-2">
                        <Briefcase className="h-4 w-4" />
                        Pipeline
                      </Label>
                      <Select value={watch("pipeline") || "default"} onValueChange={v => setValue("pipeline", v)}>
                        <SelectTrigger className="h-10">
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
                      <Select value={watch("stage")} onValueChange={v => { setValue("stage", v); setValue("status", v); }}>
                        <SelectTrigger className={cn("h-10", errors.stage && "border-destructive")}>
                          <SelectValue placeholder="Select stage" />
                        </SelectTrigger>
                        <SelectContent>
                          {allStageOptions.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.stage && <p className="text-xs text-destructive">{errors.stage.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Lead owner
                      </Label>
                      <Select value={watch("assignedTo") || "unassigned"} onValueChange={v => setValue("assignedTo", v === "unassigned" ? null : v)}>
                        <SelectTrigger className={cn("h-10", errors.assignedTo && "border-destructive")}>
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
                      {errors.assignedTo && <p className="text-xs text-destructive">{errors.assignedTo.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">Customer Type</Label>
                      <Select value={watch("customerType")} onValueChange={v => setValue("customerType", v)}>
                        <SelectTrigger className={cn("h-10", errors.customerType && "border-destructive")}>
                          <SelectValue placeholder="not selected" />
                        </SelectTrigger>
                        <SelectContent>
                          {customerTypeOptions.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.customerType && <p className="text-xs text-destructive">{errors.customerType.message}</p>}
                    </div>

                    <LabeledInput label="Lead name" placeholder="Lead #" fieldProps={register("title")} error={errors.title?.message} />
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <LabeledInput label="Company name" placeholder="Company name" fieldProps={register("companyName")} error={errors.companyName?.message} />
                    <LabeledInput label="Designation" placeholder="Job title / designation" fieldProps={register("designation")} error={errors.designation?.message} />

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">Personal Number</Label>
                      <div className="flex items-stretch gap-2">
                        <Input
                          placeholder="+1 555 0123"
                          className={cn("h-11 flex-1", errors.phone && "border-destructive")}
                          {...register("phone")}
                        />
                        <InlineSelect
                          value={watch("phoneType")}
                          onChange={v => setValue("phoneType", v)}
                          placeholder="Work Phone"
                          options={phoneTypeOptions}
                          className="w-[160px] h-11"
                          error={errors.phoneType?.message}
                        />
                        <Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0 text-muted-foreground">
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </div>
                      {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">Personal E-mail</Label>
                      <div className="flex items-stretch gap-2">
                        <Input
                          type="email"
                          placeholder="name@example.com"
                          className={cn("h-11 flex-1", errors.email && "border-destructive")}
                          {...register("email")}
                        />
                        <InlineSelect
                          value={watch("emailType")}
                          onChange={v => setValue("emailType", v)}
                          placeholder="Work"
                          options={emailTypeOptions}
                          className="w-[160px] h-11"
                          error={errors.emailType?.message}
                        />
                        <Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0 text-muted-foreground">
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </div>
                      {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">Website</Label>
                      <div className="flex items-stretch gap-2">
                        <Input
                          placeholder="https://example.com"
                          className={cn("h-11 flex-1", errors.website && "border-destructive")}
                          {...register("website")}
                        />
                        <InlineSelect
                          value={watch("websiteType")}
                          onChange={v => setValue("websiteType", v)}
                          placeholder="Corporate"
                          options={websiteTypeOptions}
                          className="w-[160px] h-11"
                          error={errors.websiteType?.message}
                        />
                        <Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0 text-muted-foreground">
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </div>
                      {errors.website && <p className="text-xs text-destructive">{errors.website.message}</p>}
                    </div>

                    <div className="md:col-span-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium text-foreground">Address</Label>
                        <span className="text-xs text-primary">expand</span>
                      </div>
                      <Textarea
                        placeholder="Address"
                        {...register("address")}
                        className={cn("min-h-[84px]", errors.address && "border-destructive")}
                      />
                      {errors.address && <p className="text-xs text-destructive">{errors.address.message}</p>}
                    </div>

                    <LabeledInput label="Company Phone Number" placeholder="+1 555 0123" fieldProps={register("companyPhone")} error={errors.companyPhone?.message} />
                    <LabeledInput label="Company Email" placeholder="info@company.com" fieldProps={register("companyEmail")} type="email" error={errors.companyEmail?.message} />
                  </div>
                  {renderDroppedFields("lead-company-details")}
                </CardContent>
              </Card>
            </DroppableSection>

            <DroppableSection id="activity-tracking" editing={true}>
              <Card className="border shadow-sm rounded-xl">
                <CardHeader className="border-b">
                  <SectionTitle
                    icon={CalendarDays}
                    title="Activity & Interaction Tracking"
                    description="Track touchpoints and follow-up timing."
                  />
                </CardHeader>
                <CardContent className="space-y-5 p-6">
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">Last Contacted Date</Label>
                      <Input type="date" {...register("lastContactedDate")} className={cn("h-10", errors.lastContactedDate && "border-destructive")} />
                      {errors.lastContactedDate && <p className="text-xs text-destructive">{errors.lastContactedDate.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">Next Follow-up Date</Label>
                      <Input type="date" {...register("nextFollowUpDate")} className={cn("h-10", errors.nextFollowUpDate && "border-destructive")} />
                      {errors.nextFollowUpDate && <p className="text-xs text-destructive">{errors.nextFollowUpDate.message}</p>}
                    </div>
                  </div>

                  <LabeledTextarea
                    label="All Interaction Notes With Dates"
                    placeholder="Add interaction notes..."
                    fieldProps={register("interactionNotes")}
                    rows={8}
                    error={errors.interactionNotes?.message}
                  />
                  {renderDroppedFields("activity-tracking")}
                </CardContent>
              </Card>
            </DroppableSection>

            <DroppableSection id="qualification-opportunity" editing={true}>
              <Card className="border shadow-sm rounded-xl">
                <CardHeader className="border-b">
                  <SectionTitle
                    icon={Sparkles}
                    title="Qualification & Opportunity"
                    description="Capture the sales potential and buying intent."
                  />
                </CardHeader>
                <CardContent className="space-y-5 p-6">
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        Service Interested
                      </Label>
                      <CreatableSelect
                        label="Service Interested"
                        value={watch("serviceInterested") || ""}
                        onChange={(v) => setValue("serviceInterested", v)}
                        options={serviceOptions}
                        disabled={false}
                      />
                      {errors.serviceInterested && <p className="text-xs text-destructive">{errors.serviceInterested.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">Company Size</Label>
                      <Select value={watch("companySize")} onValueChange={v => setValue("companySize", v)}>
                        <SelectTrigger className={cn("h-10", errors.companySize && "border-destructive")}>
                          <SelectValue placeholder="Company Size" />
                        </SelectTrigger>
                        <SelectContent>
                          {companySizeOptions.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.companySize && <p className="text-xs text-destructive">{errors.companySize.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">Estimated Opportunity Value</Label>
                      <div className="flex items-stretch gap-2">
                        <Input
                          type="number"
                          placeholder="0"
                          {...register("value")}
                          className={cn("h-10 flex-1", errors.value && "border-destructive")}
                        />
                        <InlineSelect
                          value={watch("currency")}
                          onChange={v => setValue("currency", v)}
                          placeholder="US Dollar"
                          options={currencyOptions}
                          className="w-[170px] h-10"
                          error={errors.currency?.message}
                        />
                      </div>
                      {errors.value && <p className="text-xs text-destructive">{errors.value.message}</p>}
                    </div>

                    <LabeledInput
                      label="Decision Maker Identified"
                      placeholder="not selected"
                      fieldProps={register("decisionMaker")}
                      error={errors.decisionMaker?.message}
                    />

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4" />
                        Expected Close Date
                      </Label>
                      <Input type="date" {...register("expectedCloseDate")} className={cn("h-10", errors.expectedCloseDate && "border-destructive")} />
                      {errors.expectedCloseDate && <p className="text-xs text-destructive">{errors.expectedCloseDate.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">Responsible Person</Label>
                      <Input placeholder="Responsible Person" {...register("responsiblePerson")} className="h-10" />
                    </div>
                  </div>
                  {renderDroppedFields("qualification-opportunity")}
                </CardContent>
              </Card>
            </DroppableSection>

            <DroppableSection id="source-section" editing={true}>
              <Card className="border shadow-sm rounded-xl">
                <CardHeader className="border-b">
                  <SectionTitle
                    icon={Tag}
                    title="Source"
                    description="Record where the lead came from and any source context."
                  />
                </CardHeader>
                <CardContent className="space-y-5 p-6">
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">Created on</Label>
                      <Input 
                        type="date" 
                        {...register("createdAt")} 
                        className={cn("h-10", errors.createdAt && "border-destructive")} 
                      />
                      {errors.createdAt && <p className="text-xs text-destructive">{errors.createdAt.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">Source</Label>
                      <Select value={watch("source")} onValueChange={v => setValue("source", v)}>
                        <SelectTrigger className={cn("h-10", errors.source && "border-destructive")}>
                          <SelectValue placeholder="Call" />
                        </SelectTrigger>
                        <SelectContent>
                          {sourceOptions.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.source && <p className="text-xs text-destructive">{errors.source.message}</p>}
                    </div>

                    <div className="md:col-span-2 space-y-2">
                      <Label className="text-sm font-medium text-foreground">Source Information</Label>
                      <Textarea
                        placeholder="Source Information"
                        {...register("sourceInfo")}
                        className={cn("min-h-[110px]", errors.sourceInfo && "border-destructive")}
                      />
                      {errors.sourceInfo && <p className="text-xs text-destructive">{errors.sourceInfo.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-foreground">External Source ID</Label>
                      <Input placeholder="e.g. CRM-123" {...register("externalSourceId")} className="h-10" />
                    </div>

                    <div className="md:col-span-2 space-y-2">
                      <Label className="text-sm font-medium text-foreground">Additional Notes</Label>
                      <Textarea
                        placeholder="Add any extra context"
                        {...register("notes")}
                        className={cn("min-h-[110px]", errors.notes && "border-destructive")}
                      />
                      {errors.notes && <p className="text-xs text-destructive">{errors.notes.message}</p>}
                    </div>
                  </div>
                  {renderDroppedFields("source-section")}
                </CardContent>
              </Card>
            </DroppableSection>

            <CustomFieldsSection
              fields={customFields}
              onChange={setCustomFields}
              editing={true}
            />
          </div>
        </FieldDragWrapper>

        <div className="space-y-6">
          <Card className="border shadow-sm sticky top-6 rounded-xl">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquare className="h-5 w-5 text-primary" />
                Lead Preview
              </CardTitle>
              <CardDescription>
                You are now adding a lead. Complete the fields and save when ready.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <div className="rounded-lg border p-4">
                <p className="text-sm font-medium text-foreground">Add a new activity</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Plan your next action on the lead to keep follow-up details in one place.
                </p>
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Stage</span>
                  <span className="text-sm font-medium">{watch("stage") || "new"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Source</span>
                  <span className="text-sm font-medium">{watch("source") || "call"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Opportunity</span>
                  <span className="text-sm font-medium">
                    {watch("currency") || "USD"} {watch("value") || "0"}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {saveButton}
                <Button variant="outline" onClick={() => navigate("/crm/leads")} disabled={isSaving}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
