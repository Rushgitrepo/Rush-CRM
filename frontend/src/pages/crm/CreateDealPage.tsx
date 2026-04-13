import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save, Loader2, ArrowLeft, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/crm/ui/PageHeader";
import { EntitySearchSelect } from "@/components/crm/EntitySearchSelect";
import { CustomFieldsSection } from "@/components/crm/CustomFieldsSection";
import { useContacts, useCompanies, useCreateDeal } from "@/hooks/useCrmData";
import { useToast } from "@/components/ui/use-toast";

const dealSchema = z.object({
  title: z.string().min(2, "Deal title required"),
  value: z.string().optional(),
  stage: z.string().min(1, "Pick a stage"),
  status: z.string().optional(),
  notes: z.string().optional(),
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
});

type DealForm = z.infer<typeof dealSchema>;

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

export default function CreateDealPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const createDeal = useCreateDeal();
  const { data: contacts } = useContacts();
  const { data: companies } = useCompanies();

  const [contactId, setContactId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [customFields, setCustomFields] = useState<{ key: string; value: string }[]>([]);

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
    },
  });

  const isSaving = createDeal.isPending;

  const onSubmit = (data: DealForm) => {
    const payload = {
      title: data.title,
      value: data.value ? Number(data.value) : undefined,
      stage: data.stage,
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
      customFields: customFields.reduce((acc, field) => {
        if (field.key.trim()) {
          acc[field.key.trim()] = field.value;
        }
        return acc;
      }, {} as Record<string, string>),
    };

    createDeal.mutate(payload as any, {
      onSuccess: () => {
        toast({ title: "Deal created", description: data.title });
        navigate("/crm/deals");
      },
      onError: (err: any) => {
        toast({ title: "Failed to create deal", description: err?.message || "Please try again", variant: "destructive" });
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
    <div className="space-y-6">
      <PageHeader
        title="Create Deal"
        description="Spin up a new deal with the key details and linked contacts."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate(-1)} disabled={isSaving}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            {saveButton}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-0 shadow-card">
            <CardHeader>
              <CardTitle>Deal details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Deal title *</Label>
                  <Input placeholder="New build proposal" {...form.register("title")} />
                </div>
                <div className="space-y-2">
                  <Label>Contact Name</Label>
                  <Input placeholder="John Smith" {...form.register("contactName")} />
                </div>
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input placeholder="Acme Inc" {...form.register("companyName")} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" placeholder="john@example.com" {...form.register("email")} />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input placeholder="+1 555-0123" {...form.register("phone")} />
                </div>
                <div className="space-y-2">
                  <Label>Value</Label>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <Input type="number" placeholder="25000" {...form.register("value")} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Stage</Label>
                  <Select defaultValue="qualification" onValueChange={(v) => { form.setValue("stage", v); form.setValue("status", v); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {stageOptions.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select defaultValue="medium" onValueChange={(v) => form.setValue("priority", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea rows={4} placeholder="Scope, risks, deliverables" {...form.register("notes")} />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white shadow-sm rounded-xl">
            <CardHeader className="border-b border-slate-200 bg-slate-50/80">
              <CardTitle>About Deal</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 p-6">
              <div className="space-y-2">
                <Label>Client Type</Label>
                <Select value={form.watch("clientType") || ""} onValueChange={(v) => form.setValue("clientType", v)}>
                  <SelectTrigger><SelectValue placeholder="not selected" /></SelectTrigger>
                  <SelectContent>{clientTypeOptions.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Project Type</Label>
                <Select value={form.watch("projectType") || ""} onValueChange={(v) => form.setValue("projectType", v)}>
                  <SelectTrigger><SelectValue placeholder="not selected" /></SelectTrigger>
                  <SelectContent>{projectTypeOptions.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Available to everyone</Label>
                <Select value={form.watch("availableToEveryone") ? "yes" : "no"} onValueChange={(v) => form.setValue("availableToEveryone", v === "yes")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{yesNoOptions.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white shadow-sm rounded-xl">
            <CardHeader className="border-b border-slate-200 bg-slate-50/80">
              <CardTitle>More</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 p-6">
              <div className="space-y-2">
                <Label>Source</Label>
                <Select onValueChange={(v) => form.setValue("source", v)}>
                  <SelectTrigger><SelectValue placeholder="Not selected" /></SelectTrigger>
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
              </div>
              <div className="space-y-2">
                <Label>Source Information</Label>
                <Textarea rows={3} placeholder="Source Information" {...form.register("sourceInfo")} />
              </div>
              <div className="space-y-2">
                <Label>QA Status</Label>
                <Select value={form.watch("qaStatus") || ""} onValueChange={(v) => form.setValue("qaStatus", v)}>
                  <SelectTrigger><SelectValue placeholder="not selected" /></SelectTrigger>
                  <SelectContent>{qaStatusOptions.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Quotation Received</Label>
                <Input placeholder="Quotation Received" {...form.register("quotationReceived")} />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white shadow-sm rounded-xl">
            <CardHeader className="border-b border-slate-200 bg-slate-50/80">
              <CardTitle>Budget & Payment</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 p-6">
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={form.watch("paymentMethod") || ""} onValueChange={(v) => form.setValue("paymentMethod", v)}>
                  <SelectTrigger><SelectValue placeholder="not selected" /></SelectTrigger>
                  <SelectContent>{paymentMethodOptions.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Invoice Link</Label>
                <Input placeholder="Invoice link" {...form.register("invoiceLink")} />
              </div>
              <div className="space-y-2">
                <Label>Hourly Rate</Label>
                <div className="flex gap-2">
                  <Input type="number" placeholder="0" {...form.register("hourlyRate")} />
                  <Select value={form.watch("hourlyRateCurrency") || "USD"} onValueChange={(v) => form.setValue("hourlyRateCurrency", v)}>
                    <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{currencyOptions.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Hours Of Work</Label>
                <Input placeholder="Hours of work" {...form.register("hoursOfWork")} />
              </div>
            </CardContent>
          </Card>

          <CustomFieldsSection 
            fields={customFields} 
            onChange={setCustomFields} 
          />
        </div>

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
