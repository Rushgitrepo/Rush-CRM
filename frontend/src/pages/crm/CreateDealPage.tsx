import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@/lib/utils";
import { Save, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/crm/ui/PageHeader";
import { EntitySearchSelect } from "@/components/crm/EntitySearchSelect";
import { CustomFieldsSection, DraggableFieldItem } from "@/components/crm/CustomFieldsSection";
import { FieldDragWrapper } from "@/components/crm/FieldDragWrapper";
import { DroppableSection } from "@/components/crm/DroppableSection";
import { CustomFieldInput } from "@/components/crm/CustomFieldInput";
import { GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useCustomFieldTemplates, useSaveCustomFieldTemplates, useContacts, useCompanies, useCreateDeal } from "@/hooks/useCrmData";
import { mergeFieldsWithTemplatesSync } from "@/utils/crm/customFieldsRegistry";
import { sanitizePayload } from "@/utils/crm/sanitize";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { User } from "lucide-react";
import { CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { isValid } from "date-fns";

const dealSchema = z.object({
  title: z.string().min(2, "Deal title required"),
  value: z.string().optional(),
  stage: z.string().min(1, "Pick a stage"),
  pipeline: z.string().optional(),
  status: z.string().optional(),
  notes: z.string().nullish().or(z.literal("")),
  currency: z.string().optional(),
  // Additional fields for better deal tracking
  contactName: z.string().optional(),
  companyName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  priority: z.string().optional(),
  source: z.string().optional(),
  availableToEveryone: z.boolean().default(true),
  clientType: z.string().optional(),
  projectType: z.string().optional(),
  scope: z.string().optional(),
  feedback: z.string().optional(),
  feedbackDetails: z.string().optional(),
  paymentMethod: z.string().optional(),
  invoiceLink: z.string().optional(),
  qaStatus: z.string().optional(),
  quotationReceived: z.string().optional(),
  hoursOfWork: z.string().optional(),
  hourlyRate: z.string().optional(),
  hourlyRateCurrency: z.string().optional(),
  proposalAmount: z.string().optional(),
  proposalCurrency: z.string().optional(),
  invoiceAmount: z.string().optional(),
  invoiceCurrency: z.string().optional(),
  sourceInfo: z.string().optional(),
  projectBlueprints: z.string().optional(),
  expectedCloseDate: z.string().optional(),
  nextFollowUpDate: z.string().optional(),
  assignedTo: z.string().optional(),
  externalSourceId: z.string().optional(),
  // Fields matching edit form
  probability: z.string().optional(),
  description: z.string().nullable().optional().or(z.literal("")),
  createdAt: z.string().optional(),
  designation: z.string().optional(),
  address: z.string().optional(),
  website: z.string().optional(),
  companyPhone: z.string().optional(),
  companyEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  companySize: z.string().optional(),
  agentName: z.string().optional(),
  decisionMaker: z.string().optional(),
  serviceInterested: z.string().optional(),
});

type DealForm = z.infer<typeof dealSchema>;

interface CustomField {
  id: string;
  key: string;
  value: string;
  type?: string;
  sectionId?: string;
}

const stageOptions = [
  { value: "qualification", label: "Qualification" },
  { value: "discovery", label: "Discovery" },
  { value: "proposal_sent", label: "Proposal Sent" },
  { value: "negotiation", label: "Negotiation" },
  { value: "close_deal", label: "Close Deal" },
];

const clientTypeOptions = [
  { value: "lead", label: "Lead" },
  { value: "prospect", label: "Prospect" },
  { value: "client", label: "Client" },
  { value: "partner", label: "Partner" },
];

const projectTypeOptions = [
  { value: "cost_estimation", label: "Cost Estimation" },
  { value: "fixed_price", label: "Fixed Price" },
  { value: "hourly", label: "Hourly" },
  { value: "quantity_takeoff", label: "Quantity Takeoff" },
  { value: "project_management", label: "Project Management" },
  { value: "design", label: "Design" },
];

const paymentMethodOptions = [
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cash", label: "Cash" },
  { value: "credit_card", label: "Credit Card" },
  { value: "paypal", label: "PayPal" },
  { value: "stripe", label: "Stripe" },
  { value: "other", label: "Other" },
];

const qaStatusOptions = [
  { value: "not_selected", label: "Not selected" },
  { value: "pending", label: "Pending" },
  { value: "in_review", label: "In Review" },
  { value: "passed", label: "Passed" },
  { value: "failed", label: "Failed" },
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
];

const companySizeOptions = [
  { value: "1-10", label: "1-10 employees" },
  { value: "11-50", label: "11-50 employees" },
  { value: "51-200", label: "51-200 employees" },
  { value: "201-500", label: "201-500 employees" },
  { value: "501-1000", label: "501-1000 employees" },
  { value: "1000+", label: "1000+ employees" },
];

export default function CreateDealPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const createDeal = useCreateDeal();
  const { data: contacts } = useContacts();
  const { data: companies } = useCompanies();

  const [contactId, setContactId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);

  // Load templates when profile is available
  const { data: templates, isLoading: templatesLoading } = useCustomFieldTemplates('deal');
  const saveTemplates = useSaveCustomFieldTemplates();

  useEffect(() => {
    if (templates) {
      setCustomFields(templates.map(t => ({
        id: `template-${Math.random().toString(36).substr(2, 9)}`,
        key: t.key,
        value: "",
        type: t.type,
        sectionId: t.sectionId || "custom-fields"
      })));
    }
  }, [templates]);

  const contactOptions = useMemo(() => {
    const data = (contacts as any)?.data || contacts || [];
    return (Array.isArray(data) ? data : []).map((c: any) => ({
      id: c.id,
      label: `${c.first_name || ""} ${c.last_name || ""}`.trim() || "(no name)",
      sublabel: c.email || c.phone,
    }));
  }, [contacts]);

  const companyOptions = useMemo(() => {
    const data = (companies as any)?.data || companies || [];
    return (Array.isArray(data) ? data : []).map((c: any) => ({
      id: c.id,
      label: c.name,
      sublabel: c.email || c.phone,
    }));
  }, [companies]);

  const form = useForm<DealForm>({
    resolver: zodResolver(dealSchema),
    defaultValues: {
      title: "",
      value: "",
      stage: "qualification",
      pipeline: "default",
      status: "open",
      notes: "",
      currency: "USD",
      contactName: "",
      companyName: "",
      phone: "",
      email: "",
      priority: "medium",
      source: "",
      availableToEveryone: true,
      clientType: "",
      projectType: "",
      scope: "",
      feedback: "",
      feedbackDetails: "",
      paymentMethod: "",
      invoiceLink: "",
      qaStatus: "",
      quotationReceived: "",
      hoursOfWork: "",
      hourlyRate: "",
      hourlyRateCurrency: "USD",
      proposalAmount: "",
      proposalCurrency: "USD",
      invoiceAmount: "",
      invoiceCurrency: "USD",
      sourceInfo: "",
      projectBlueprints: "",
      expectedCloseDate: "",
      nextFollowUpDate: "",
      assignedTo: "",
      externalSourceId: "",
      probability: "",
      description: "",
      createdAt: new Date().toISOString().split('T')[0],
      designation: "",
      address: "",
      website: "",
      companyPhone: "",
      companyEmail: "",
      companySize: "",
      agentName: "",
      decisionMaker: "",
      serviceInterested: "",
    },
  });

  const isSaving = createDeal.isPending;

  const handleFieldDropToSection = (fieldKey: string, fieldValue: string, sectionId: string, updatedFields?: CustomField[]) => {
    setCustomFields(prev => {
      const updated = updatedFields || prev.map(f => f.id === fieldKey ? { ...f, sectionId } : f);
      // Persist this change globally to the registry so new deals follow this layout
      saveTemplates.mutate({ entityType: 'deal', templates: updated });
      return updated;
    });
  };

  const renderDroppedFields = (sectionId: string, isTop = false) => {
    const sectionFields = customFields.filter(f => f.sectionId === sectionId);
    if (sectionFields.length === 0) return null;

    return (
      <div className={cn(
        "space-y-4",
        isTop ? "mb-6 pb-6 border-b border-dashed" : "mt-6 pt-6 border-t border-dashed",
        "border-border"
      )}>
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider bg-primary/5 text-primary border-primary/20">
            {isTop ? 'Top Custom Fields' : 'Custom Fields'}
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
                      <div className="p-1 cursor-grab active:cursor-grabbing text-primary hover:text-primary-foreground hover:bg-primary rounded transition-all opacity-0 group-hover:opacity-100">
                        <GripVertical className="h-3 w-3" />
                      </div>
                    </DraggableFieldItem>
                  </div>
                  <CustomFieldInput
                    field={field}
                    editing={true}
                    onUpdate={(updates) => {
                      setCustomFields(prev => prev.map(f => f.id === field.id ? { ...f, ...updates } : f));
                    }}
                    onDelete={() => {
                      setCustomFields(prev => prev.filter(f => f.id !== field.id));
                    }}
                    entityId="new"
                  />
                </div>
              </DraggableFieldItem>
            ))}
          </SortableContext>
        </div>
      </div>
    );
  };

  const onSubmit = (data: DealForm) => {
    const payload = {
      title: data.title,
      value: data.value ? Number(data.value) : undefined,
      stage: data.stage,
      pipeline: data.pipeline || 'default',
      status: data.status || data.stage,
      notes: data.notes,
      currency: data.currency,
      contact_id: contactId || undefined,
      company_id: companyId || undefined,
      contact_name: data.contactName,
      company_name: data.companyName,
      phone: data.phone,
      email: data.email,
      priority: data.priority,
      source: data.source,
      availableToEveryone: data.availableToEveryone,
      clientType: data.clientType,
      projectType: data.projectType,
      scope: data.scope,
      feedback: data.feedback,
      feedbackDetails: data.feedbackDetails,
      paymentMethod: data.paymentMethod,
      invoiceLink: data.invoiceLink,
      qaStatus: data.qaStatus,
      quotationReceived: data.quotationReceived,
      hoursOfWork: data.hoursOfWork,
      hourlyRate: data.hourlyRate ? Number(data.hourlyRate) : undefined,
      hourlyRateCurrency: data.hourlyRateCurrency,
      proposalAmount: data.proposalAmount ? Number(data.proposalAmount) : undefined,
      proposalCurrency: data.proposalCurrency,
      invoiceAmount: data.invoiceAmount ? Number(data.invoiceAmount) : undefined,
      invoiceCurrency: data.invoiceCurrency,
      sourceInfo: data.sourceInfo,
      projectBlueprints: data.projectBlueprints,
      expected_close_date: data.expectedCloseDate && isValid(new Date(data.expectedCloseDate)) ? new Date(data.expectedCloseDate).toISOString() : undefined,
      next_follow_up_date: data.nextFollowUpDate && isValid(new Date(data.nextFollowUpDate)) ? new Date(data.nextFollowUpDate).toISOString() : undefined,
      assigned_to: data.assignedTo || undefined,
      external_source_id: data.externalSourceId,
      probability: data.probability ? Number(data.probability) : undefined,
      description: data.description || null,
      created_at: data.createdAt && isValid(new Date(data.createdAt)) ? new Date(data.createdAt).toISOString() : undefined,
      designation: data.designation || null,
      address: data.address || null,
      website: data.website || null,
      company_phone: data.companyPhone || null,
      company_email: data.companyEmail || null,
      company_size: data.companySize || null,
      agent_name: data.agentName || null,
      decision_maker: data.decisionMaker || null,
      service_interested: data.serviceInterested || null,
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
    };

    createDeal.mutate(sanitizePayload(payload) as any, {
      onSuccess: () => {
        // Save these field definitions as templates for future deals
        saveTemplates.mutate({ entityType: 'deal', templates: customFields });
        
        toast.success("Deal created successfully", { description: data.title });
        navigate("/crm/deals");
      },
      onError: (err: any) => {
        toast.error("Failed to create deal", { description: err?.message || "Please try again" });
      },
    });
  };

  const saveButton = (
    <Button onClick={form.handleSubmit(onSubmit)} disabled={isSaving} className="gap-2">
      {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
      {isSaving ? "Saving..." : "Save deal"}
    </Button>
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      <PageHeader
        title="Create New Deal"
        description="Spin up a new deal with the key details and linked contacts."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate(-1)} disabled={isSaving}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <FieldDragWrapper
          customFields={customFields}
          onCustomFieldsChange={setCustomFields}
          onFieldDropToSection={handleFieldDropToSection}
          editing={true}
        >
          <div className="lg:col-span-2 space-y-4">
                <Card className="border shadow-sm overflow-hidden">
                  <DroppableSection id="deal-info-top" editing={true}>
                    <CardHeader className="border-b bg-muted/30 hover:bg-muted/50 transition-colors">
                      <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5 text-primary" />
                        Deal Information
                      </CardTitle>
                      <CardDescription>Primary deal details and status</CardDescription>
                    </CardHeader>
                  </DroppableSection>
                  <CardContent className="p-6">
                    <DroppableSection id="deal-info-top" editing={true}>
                      {renderDroppedFields("deal-info-top", true)}
                    </DroppableSection>

                    <DroppableSection id="deal-info" editing={true}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label>Deal title *</Label>
                          <Input
                            placeholder="New build proposal"
                            {...form.register("title")}
                            className={cn(form.formState.errors.title && "border-destructive")}
                          />
                          {form.formState.errors.title && <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label>Contact Name</Label>
                          <Input
                            placeholder="John Smith"
                            {...form.register("contactName")}
                            className={cn(form.formState.errors.contactName && "border-destructive")}
                          />
                          {form.formState.errors.contactName && <p className="text-xs text-destructive">{form.formState.errors.contactName.message}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label>Company Name</Label>
                          <Input
                            placeholder="Acme Inc"
                            {...form.register("companyName")}
                            className={cn(form.formState.errors.companyName && "border-destructive")}
                          />
                          {form.formState.errors.companyName && <p className="text-xs text-destructive">{form.formState.errors.companyName.message}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label>Email</Label>
                          <Input
                            type="email"
                            placeholder="john@example.com"
                            {...form.register("email")}
                            className={cn(form.formState.errors.email && "border-destructive")}
                          />
                          {form.formState.errors.email && <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label>Phone</Label>
                          <Input
                            placeholder="+1 555-0123"
                            {...form.register("phone")}
                            className={cn(form.formState.errors.phone && "border-destructive")}
                          />
                          {form.formState.errors.phone && <p className="text-xs text-destructive">{form.formState.errors.phone.message}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label>Deal Value</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              placeholder="25000"
                              {...form.register("value")}
                              className={cn(form.formState.errors.value && "border-destructive")}
                            />
                            <Select value={form.watch("currency") || "USD"} onValueChange={(v) => form.setValue("currency", v)}>
                              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                              <SelectContent>{currencyOptions.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          {form.formState.errors.value && <p className="text-xs text-destructive">{form.formState.errors.value.message}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label>Pipeline</Label>
                          <Select defaultValue="default" onValueChange={(v) => form.setValue("pipeline", v)}>
                            <SelectTrigger><SelectValue placeholder="Select pipeline" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="default">Standard Pipeline</SelectItem>
                              <SelectItem value="marketing">Marketing Pipeline</SelectItem>
                              <SelectItem value="sales">Sales Pipeline</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Stage</Label>
                          <Select defaultValue="qualification" onValueChange={(v) => { form.setValue("stage", v); form.setValue("status", v); }}>
                            <SelectTrigger className={cn(form.formState.errors.stage && "border-destructive")}><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {stageOptions.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          {form.formState.errors.stage && <p className="text-xs text-destructive">{form.formState.errors.stage.message}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label>Priority</Label>
                          <Select defaultValue="medium" onValueChange={(v) => form.setValue("priority", v)}>
                            <SelectTrigger className={cn(form.formState.errors.priority && "border-destructive")}><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="urgent">Urgent</SelectItem>
                            </SelectContent>
                          </Select>
                          {form.formState.errors.priority && <p className="text-xs text-destructive">{form.formState.errors.priority.message}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label>Expected Close Date</Label>
                          <Input
                            type="date"
                            {...form.register("expectedCloseDate")}
                            className={cn(form.formState.errors.expectedCloseDate && "border-destructive")}
                          />
                          {form.formState.errors.expectedCloseDate && <p className="text-xs text-destructive">{form.formState.errors.expectedCloseDate.message}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label>Next Follow-up Date</Label>
                          <Input
                            type="date"
                            {...form.register("nextFollowUpDate")}
                            className={cn(form.formState.errors.nextFollowUpDate && "border-destructive")}
                          />
                          {form.formState.errors.nextFollowUpDate && <p className="text-xs text-destructive">{form.formState.errors.nextFollowUpDate.message}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label>Responsible Person</Label>
                          <Select onValueChange={(v) => form.setValue("assignedTo", v)}>
                            <SelectTrigger><SelectValue placeholder="Select responsible..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="me">Me (Default)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>External Source ID</Label>
                          <Input
                            placeholder="e.g., EXT-12345"
                            {...form.register("externalSourceId")}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Probability (%)</Label>
                          <Input
                            type="number"
                            placeholder="0-100"
                            {...form.register("probability")}
                            className={cn(form.formState.errors.probability && "border-destructive")}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Created Date</Label>
                          <Input type="date" {...form.register("createdAt")} className="h-10" />
                        </div>
                      </div>

                      <div className="space-y-2 mt-4">
                        <Label>Description</Label>
                        <Textarea
                          rows={3}
                          placeholder="Deal description"
                          {...form.register("description")}
                        />
                      </div>

                      <div className="space-y-2 mt-4">
                        <Label>Notes</Label>
                        <Textarea
                          rows={4}
                          placeholder="Scope, risks, deliverables"
                          {...form.register("notes")}
                          className={cn(form.formState.errors.notes && "border-destructive")}
                        />
                        {form.formState.errors.notes && <p className="text-xs text-destructive">{form.formState.errors.notes.message}</p>}
                      </div>
                      {renderDroppedFields("deal-info")}
                    </DroppableSection>
                  </CardContent>
                </Card>

            <DroppableSection id="contact-company-info" editing={true}>
              <Card className="border shadow-sm rounded-xl">
                <CardHeader className="border-b">
                  <CardTitle>Contact & Company Details</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2 p-6">
                  <div className="space-y-2">
                    <Label>Designation</Label>
                    <Input placeholder="Job title / designation" {...form.register("designation")} />
                  </div>
                  <div className="space-y-2">
                    <Label>Website</Label>
                    <Input placeholder="https://example.com" {...form.register("website")} />
                  </div>
                  <div className="space-y-2">
                    <Label>Company Phone</Label>
                    <Input placeholder="+1 555-0123" {...form.register("companyPhone")} />
                  </div>
                  <div className="space-y-2">
                    <Label>Company Email</Label>
                    <Input type="email" placeholder="info@company.com" {...form.register("companyEmail")} className={cn(form.formState.errors.companyEmail && "border-destructive")} />
                    {form.formState.errors.companyEmail && <p className="text-xs text-destructive">{form.formState.errors.companyEmail.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Company Size</Label>
                    <Select value={form.watch("companySize") || ""} onValueChange={(v) => form.setValue("companySize", v)}>
                      <SelectTrigger><SelectValue placeholder="Select size" /></SelectTrigger>
                      <SelectContent>{companySizeOptions.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label>Address</Label>
                    <Textarea rows={2} placeholder="Full address" {...form.register("address")} />
                  </div>
                  {renderDroppedFields("contact-company-info")}
                </CardContent>
              </Card>
            </DroppableSection>

            <DroppableSection id="about-deal" editing={true}>
              <Card className="border shadow-sm rounded-xl">
                <CardHeader className="border-b">
                  <CardTitle>About Deal</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2 p-6">
                  <div className="space-y-2">
                    <Label>Client Type</Label>
                    <Select value={form.watch("clientType") || ""} onValueChange={(v) => form.setValue("clientType", v)}>
                      <SelectTrigger className={cn(form.formState.errors.clientType && "border-destructive")}>
                        <SelectValue placeholder="not selected" />
                      </SelectTrigger>
                      <SelectContent>{clientTypeOptions.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
                    </Select>
                    {form.formState.errors.clientType && <p className="text-xs text-destructive">{form.formState.errors.clientType.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Project Type</Label>
                    <Select value={form.watch("projectType") || ""} onValueChange={(v) => form.setValue("projectType", v)}>
                      <SelectTrigger className={cn(form.formState.errors.projectType && "border-destructive")}>
                        <SelectValue placeholder="not selected" />
                      </SelectTrigger>
                      <SelectContent>{projectTypeOptions.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
                    </Select>
                    {form.formState.errors.projectType && <p className="text-xs text-destructive">{form.formState.errors.projectType.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Available to everyone</Label>
                    <Select value={form.watch("availableToEveryone") ? "yes" : "no"} onValueChange={(v) => form.setValue("availableToEveryone", v === "yes")}>
                      <SelectTrigger className={cn(form.formState.errors.availableToEveryone && "border-destructive")}><SelectValue /></SelectTrigger>
                      <SelectContent>{yesNoOptions.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
                    </Select>
                    {form.formState.errors.availableToEveryone && <p className="text-xs text-destructive">{form.formState.errors.availableToEveryone.message}</p>}
                  </div>
                </CardContent>
                {renderDroppedFields("about-deal")}
              </Card>
            </DroppableSection>

            <DroppableSection id="more-section" editing={true}>
              <Card className="border shadow-sm rounded-xl">
                <CardHeader className="border-b">
                  <CardTitle>More</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2 p-6">
                  <div className="space-y-2">
                    <Label>Source</Label>
                    <Select onValueChange={(v) => form.setValue("source", v)}>
                      <SelectTrigger className={cn(form.formState.errors.source && "border-destructive")}>
                        <SelectValue placeholder="Not selected" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="website">Website</SelectItem>
                        <SelectItem value="referral">Referral</SelectItem>
                        <SelectItem value="linkedin">LinkedIn</SelectItem>
                        <SelectItem value="cold_call">Cold Call</SelectItem>
                        <SelectItem value="trade_show">Trade Show</SelectItem>
                        <SelectItem value="advertisement">Advertisement</SelectItem>
                        <SelectItem value="partner">Partner</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    {form.formState.errors.source && <p className="text-xs text-destructive">{form.formState.errors.source.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Source Information</Label>
                    <Textarea
                      rows={3}
                      placeholder="Source Information"
                      {...form.register("sourceInfo")}
                      className={cn(form.formState.errors.sourceInfo && "border-destructive")}
                    />
                    {form.formState.errors.sourceInfo && <p className="text-xs text-destructive">{form.formState.errors.sourceInfo.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>QA Status</Label>
                    <Select value={form.watch("qaStatus") || ""} onValueChange={(v) => form.setValue("qaStatus", v)}>
                      <SelectTrigger className={cn(form.formState.errors.qaStatus && "border-destructive")}>
                        <SelectValue placeholder="not selected" />
                      </SelectTrigger>
                      <SelectContent>{qaStatusOptions.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
                    </Select>
                    {form.formState.errors.qaStatus && <p className="text-xs text-destructive">{form.formState.errors.qaStatus.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Quotation Received</Label>
                    <Input
                      placeholder="Quotation Received"
                      {...form.register("quotationReceived")}
                      className={cn(form.formState.errors.quotationReceived && "border-destructive")}
                    />
                    {form.formState.errors.quotationReceived && <p className="text-xs text-destructive">{form.formState.errors.quotationReceived.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Sales Agent</Label>
                    <Input placeholder="Agent name" {...form.register("agentName")} />
                  </div>
                  <div className="space-y-2">
                    <Label>Decision Maker</Label>
                    <Input placeholder="Decision maker" {...form.register("decisionMaker")} />
                  </div>
                  <div className="space-y-2">
                    <Label>Service Interested</Label>
                    <Input placeholder="Service or product interested in" {...form.register("serviceInterested")} />
                  </div>
                  <div className="space-y-2">
                    <Label>Feedback</Label>
                    <Textarea rows={2} placeholder="Feedback" {...form.register("feedback")} />
                  </div>
                  <div className="space-y-2">
                    <Label>Project Feedback Details</Label>
                    <Textarea rows={2} placeholder="Detailed feedback" {...form.register("feedbackDetails")} />
                  </div>
                  {renderDroppedFields("more-section")}
                </CardContent>
              </Card>
            </DroppableSection>

            <DroppableSection id="budget-payment" editing={true}>
              <Card className="border shadow-sm rounded-xl">
                <CardHeader className="border-b">
                  <CardTitle>Budget & Payment</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2 p-6">
                  <div className="space-y-2">
                    <Label>Payment Method</Label>
                    <Select value={form.watch("paymentMethod") || ""} onValueChange={(v) => form.setValue("paymentMethod", v)}>
                      <SelectTrigger className={cn(form.formState.errors.paymentMethod && "border-destructive")}>
                        <SelectValue placeholder="not selected" />
                      </SelectTrigger>
                      <SelectContent>{paymentMethodOptions.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
                    </Select>
                    {form.formState.errors.paymentMethod && <p className="text-xs text-destructive">{form.formState.errors.paymentMethod.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Invoice Link</Label>
                    <Input
                      placeholder="Invoice link"
                      {...form.register("invoiceLink")}
                      className={cn(form.formState.errors.invoiceLink && "border-destructive")}
                    />
                    {form.formState.errors.invoiceLink && <p className="text-xs text-destructive">{form.formState.errors.invoiceLink.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Hourly Rate</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="0"
                        {...form.register("hourlyRate")}
                        className={cn(form.formState.errors.hourlyRate && "border-destructive")}
                      />
                      <Select value={form.watch("hourlyRateCurrency") || "USD"} onValueChange={(v) => form.setValue("hourlyRateCurrency", v)}>
                        <SelectTrigger className={cn("w-[130px]", form.formState.errors.hourlyRateCurrency && "border-destructive")}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>{currencyOptions.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    {form.formState.errors.hourlyRate && <p className="text-xs text-destructive">{form.formState.errors.hourlyRate.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Hours Of Work</Label>
                    <Input
                      placeholder="Hours of work"
                      {...form.register("hoursOfWork")}
                      className={cn(form.formState.errors.hoursOfWork && "border-destructive")}
                    />
                    {form.formState.errors.hoursOfWork && <p className="text-xs text-destructive">{form.formState.errors.hoursOfWork.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Proposal Amount</Label>
                    <div className="flex gap-2">
                      <Input type="number" placeholder="0" {...form.register("proposalAmount")} className={cn(form.formState.errors.proposalAmount && "border-destructive")} />
                      <Select value={form.watch("proposalCurrency") || "USD"} onValueChange={(v) => form.setValue("proposalCurrency", v)}>
                        <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                        <SelectContent>{currencyOptions.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Invoice Amount</Label>
                    <div className="flex gap-2">
                      <Input type="number" placeholder="0" {...form.register("invoiceAmount")} className={cn(form.formState.errors.invoiceAmount && "border-destructive")} />
                      <Select value={form.watch("invoiceCurrency") || "USD"} onValueChange={(v) => form.setValue("invoiceCurrency", v)}>
                        <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                        <SelectContent>{currencyOptions.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  {renderDroppedFields("budget-payment")}
                </CardContent>
              </Card>
            </DroppableSection>

            <DroppableSection id="project-details" editing={true}>
              <Card className="border shadow-sm rounded-xl">
                <CardHeader className="border-b">
                  <CardTitle>Project Details</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 p-6">
                  <div className="space-y-2">
                    <Label>Scope</Label>
                    <Textarea rows={3} placeholder="Project scope" {...form.register("scope")} />
                  </div>
                  <div className="space-y-2">
                    <Label>Project Blueprints</Label>
                    <Textarea rows={3} placeholder="Project blueprints / links" {...form.register("projectBlueprints")} />
                  </div>
                  {renderDroppedFields("project-details")}
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

        <div className="space-y-4">
          <Card className="border-0 shadow-card">
            <CardHeader>
              <CardTitle>Link people</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <EntitySearchSelect
                label="Contact"
                options={contactOptions}
                value={contactId}
                onChange={setContactId}
                placeholder="Search contacts"
                addNewLabel="Create contact"
                onAddNew={() => navigate("/crm/customers/contacts/create")}
              />
              <EntitySearchSelect
                label="Company"
                options={companyOptions}
                value={companyId}
                onChange={setCompanyId}
                placeholder="Search companies"
                addNewLabel="Create company"
                onAddNew={() => navigate("/crm/customers/companies/create")}
              />
            </CardContent>
          </Card>

          <Card className="border-0 shadow-card">
            <CardContent className="pt-6">
              {saveButton}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
