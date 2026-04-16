import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Loader2, Save, ArrowLeft, Building2, CalendarDays, MessageSquare,
  ChevronDown, Sparkles, Tag
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/crm/ui/PageHeader";
import { useCreateLead } from "@/hooks/useCrmData";
import { CustomFieldsSection } from "@/components/crm/CustomFieldsSection";
import { useToast } from "@/components/ui/use-toast";

const leadSchema = z.object({
  title: z.string().min(2, "Lead name is required"),
  stage: z.string().min(1, "Stage is required"),
  status: z.string().optional(),
  customerType: z.string().optional(),
  source: z.string().optional(),
  sourceInfo: z.string().optional(),
  value: z.string().optional(),
  currency: z.string().optional(),
  notes: z.string().optional(),
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
  interactionNotes: z.string().optional(),
  lastContactedDate: z.string().optional(),
  nextFollowUpDate: z.string().optional(),
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
}: {
  label: string;
  placeholder?: string;
  fieldProps: any;
  type?: string;
  rightAddon?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      <div className="flex items-stretch gap-2">
        <Input type={type} placeholder={placeholder} {...fieldProps} className="h-11" />
        {rightAddon}
      </div>
    </div>
  );
}

function LabeledTextarea({
  label,
  placeholder,
  fieldProps,
  rows = 4,
}: {
  label: string;
  placeholder?: string;
  fieldProps: any;
  rows?: number;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      <Textarea rows={rows} placeholder={placeholder} {...fieldProps} />
    </div>
  );
}

function InlineSelect({
  value,
  onChange,
  placeholder,
  options,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className || "w-[160px] h-11"}>
        <SelectValue placeholder={placeholder || "Select"} />
      </SelectTrigger>
      <SelectContent>
        {options.map(opt => (
          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
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
    },
  });

  const [customFields, setCustomFields] = useState<{ key: string; value: string }[]>([]);

  const isSaving = createLead.isPending;
  const { handleSubmit, register, setValue, watch } = form;

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
      lastContactedDate: data.lastContactedDate || null,
      nextFollowUpDate: data.nextFollowUpDate || null,
      lastTouch: new Date().toISOString(),
      customFields: customFields.reduce((acc, field) => {
        if (field.key.trim()) {
          acc[field.key.trim()] = field.value;
        }
        return acc;
      }, {} as Record<string, string>),
    } as Record<string, unknown>;

    createLead.mutate(payload, {
      onSuccess: () => {
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
            {saveButton}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card className="border border-slate-200 shadow-sm rounded-xl">
            <CardHeader className="border-b border-slate-200 ">
              <SectionTitle
                icon={Building2}
                title="Lead and Company Details"
                description="Core contact, company, and ownership details."
              />
            </CardHeader>
            <CardContent className="space-y-5 p-6">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">Stage</Label>
                  <Select value={watch("stage")} onValueChange={v => { setValue("stage", v); setValue("status", v); }}>
                    <SelectTrigger className="h-10 border-slate-200 ">
                      <SelectValue placeholder="Select stage" />
                    </SelectTrigger>
                    <SelectContent>
                      {stageOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">Customer Type</Label>
                  <Select value={watch("customerType")} onValueChange={v => setValue("customerType", v)}>
                    <SelectTrigger className="h-10 border-slate-200 ">
                      <SelectValue placeholder="not selected" />
                    </SelectTrigger>
                    <SelectContent>
                      {customerTypeOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <LabeledInput label="Lead name" placeholder="Lead #" fieldProps={register("title")} />
                <LabeledInput label="Company name" placeholder="Company name" fieldProps={register("companyName")} />
                <LabeledInput label="Designation" placeholder="Job title / designation" fieldProps={register("designation")} />

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">Personal Number</Label>
                  <div className="flex items-stretch gap-2">
                    <Input placeholder="+1 555 0123" className="h-11 flex-1" {...register("phone")} />
                    <InlineSelect
                      value={watch("phoneType")}
                      onChange={v => setValue("phoneType", v)}
                      placeholder="Work Phone"
                      options={phoneTypeOptions}
                      className="w-[160px] h-11"
                    />
                    <Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0 text-muted-foreground">
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">Personal E-mail</Label>
                  <div className="flex items-stretch gap-2">
                    <Input type="email" placeholder="name@example.com" className="h-11 flex-1" {...register("email")} />
                    <InlineSelect
                      value={watch("emailType")}
                      onChange={v => setValue("emailType", v)}
                      placeholder="Work"
                      options={emailTypeOptions}
                      className="w-[160px] h-11"
                    />
                    <Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0 text-muted-foreground">
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">Website</Label>
                  <div className="flex items-stretch gap-2">
                    <Input placeholder="https://example.com" className="h-11 flex-1" {...register("website")} />
                    <InlineSelect
                      value={watch("websiteType")}
                      onChange={v => setValue("websiteType", v)}
                      placeholder="Corporate"
                      options={websiteTypeOptions}
                      className="w-[160px] h-11"
                    />
                    <Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0 text-muted-foreground">
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="md:col-span-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium text-foreground">Address</Label>
                    <span className="text-xs text-primary">expand</span>
                  </div>
                  <Textarea
                    placeholder="Address"
                    {...register("address")}
                    className="min-h-[84px]"
                  />
                </div>

                <LabeledInput label="Company Phone Number" placeholder="+1 555 0123" fieldProps={register("companyPhone")} />
                <LabeledInput label="Company Email" placeholder="info@company.com" fieldProps={register("companyEmail")} type="email" />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate  shadow-sm rounded-xl">
            <CardHeader className="border-b border-slate-200 ">
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
                  <Input type="date" {...register("lastContactedDate")} className="h-10 border-slate-200 " />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">Next Follow-up Date</Label>
                  <Input type="date" {...register("nextFollowUpDate")} className="h-10 border-slate-200 " />
                </div>
              </div>

              <LabeledTextarea
                label="All Interaction Notes With Dates"
                placeholder="Add interaction notes..."
                fieldProps={register("interactionNotes")}
                rows={8}
              />
            </CardContent>
          </Card>

          <Card className="border border-slate-200  shadow-sm rounded-xl">
            <CardHeader className="border-b border-slate-200 ">
              <SectionTitle
                icon={Sparkles}
                title="Qualification & Opportunity"
                description="Capture the sales potential and buying intent."
              />
            </CardHeader>
            <CardContent className="space-y-5 p-6">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">Service Interested</Label>
                  <Select value={watch("serviceInterested")} onValueChange={v => setValue("serviceInterested", v)}>
                    <SelectTrigger className="h-10 border-slate-200 ">
                      <SelectValue placeholder="Select service..." />
                    </SelectTrigger>
                    <SelectContent>
                      {serviceOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">Company Size</Label>
                  <Select value={watch("companySize")} onValueChange={v => setValue("companySize", v)}>
                    <SelectTrigger className="h-10 border-slate-200 ">
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
                    <Input type="number" placeholder="0" {...register("value")} className="h-10 flex-1 border-slate-200 " />
                    <InlineSelect
                      value={watch("currency")}
                      onChange={v => setValue("currency", v)}
                      placeholder="US Dollar"
                      options={currencyOptions}
                      className="w-[170px] h-10 border-slate-200 "
                    />
                  </div>
                </div>

                <LabeledInput
                  label="Decision Maker Identified"
                  placeholder="not selected"
                  fieldProps={register("decisionMaker")}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200  shadow-sm rounded-xl">
            <CardHeader className="border-b border-slate-200 ">
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
                  <div className="h-10 rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 flex items-center">
                    Will be set automatically
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-foreground">Source</Label>
                  <Select value={watch("source")} onValueChange={v => setValue("source", v)}>
                    <SelectTrigger className="h-10 border-slate-200 ">
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
                  <Textarea
                    placeholder="Source Information"
                    {...register("sourceInfo")}
                    className="min-h-[110px] border-slate-200 "
                  />
                </div>

                <div className="md:col-span-2 space-y-2">
                  <Label className="text-sm font-medium text-foreground">Additional Notes</Label>
                  <Textarea
                    placeholder="Add any extra context"
                    {...register("notes")}
                    className="min-h-[110px] border-slate-200 "
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <CustomFieldsSection 
            fields={customFields} 
            onChange={setCustomFields} 
          />
        </div>

        <div className="space-y-6">
          <Card className="border border-slate-200  shadow-sm sticky top-6 rounded-xl">
            <CardHeader className="border-b border-slate-200 ">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquare className="h-5 w-5 text-primary" />
                Lead Preview
              </CardTitle>
              <CardDescription>
                You are now adding a lead. Complete the fields and save when ready.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <div className="rounded-lg border border-slate-200  p-4">
                <p className="text-sm font-medium text-slate-900">Add a new activity</p>
                <p className="mt-1 text-sm text-slate-600">
                  Plan your next action on the lead to keep follow-up details in one place.
                </p>
              </div>

              <div className="space-y-3 rounded-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Stage</span>
                  <span className="text-sm font-medium">{watch("stage") || "new"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Source</span>
                  <span className="text-sm font-medium">{watch("source") || "call"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Opportunity</span>
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
