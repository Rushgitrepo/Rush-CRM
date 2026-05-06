import { Plus, Trash2, Tag as TagIcon, GripVertical, FileText, List, Clock, Calendar, MapPin, Globe, File, DollarSign, CheckCircle, TrendingUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";

interface CustomField {
  id: string;
  key: string;
  value: string;
  type?: string;
  sectionId?: string;
}

const fieldTypes = [
  { id: "string", title: "String", description: "Text fields can contain any information: text, numbers, etc.", icon: <FileText className="h-4 w-4" /> },
  { id: "list", title: "List", description: "Allows a user to select one or more list items.", icon: <List className="h-4 w-4" /> },
  { id: "datetime", title: "Date/Time", description: "Enables a user to specify date and time.", icon: <Clock className="h-4 w-4" /> },
  { id: "date", title: "Date", description: "Selects a date using a built-in calendar.", icon: <Calendar className="h-4 w-4" /> },
  { id: "address", title: "Address", description: "Stores address information.", icon: <MapPin className="h-4 w-4" /> },
  { id: "link", title: "Link", description: "Specifies web links.", icon: <Globe className="h-4 w-4" /> },
  { id: "file", title: "File", description: "This field stores images and documents.", icon: <File className="h-4 w-4" /> },
  { id: "money", title: "Money", description: "Specifies amounts of money with currency.", icon: <DollarSign className="h-4 w-4" /> },
  { id: "boolean", title: "Yes/No", description: "Binary (yes or no) replies.", icon: <CheckCircle className="h-4 w-4" /> },
  { id: "number", title: "Number", description: "Contains numeric data for reports.", icon: <TrendingUp className="h-4 w-4" /> },
];

interface CustomFieldsSectionProps {
  fields: CustomField[];
  onChange: (fields: CustomField[]) => void;
  title?: string;
  description?: string;
  editing?: boolean;
  className?: string;
}

export function CustomFieldsSection({
  fields,
  onChange,
  title = "Custom Fields",
  description = "Add any additional dynamic data points for this record.",
  editing = false,
  className
}: CustomFieldsSectionProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: "custom-fields",
    disabled: !editing,
  });

  const addField = (type: string = "string") => {
    const newId = `field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    onChange([...fields, { id: newId, key: "", value: "", type, sectionId: "custom-fields" }]);
  };

  const removeField = (id: string) => {
    onChange(fields.filter(f => f.id !== id));
  };

  const updateField = (id: string, updates: Partial<CustomField>) => {
    onChange(fields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const activeFields = fields.filter(f => !f.sectionId || f.sectionId === "custom-fields");

  return (
    <Card ref={setNodeRef} className={cn(
      "overflow-hidden relative",
      className,
      isOver && editing && "ring-2 ring-primary ring-offset-2 bg-primary/5"
    )}>
      {isOver && editing && (
        <div className="absolute inset-0 pointer-events-none bg-primary/10 rounded-lg border-2 border-dashed border-primary flex items-center justify-center z-10">
          <span className="text-sm font-medium text-primary bg-white px-3 py-1 rounded-full shadow-lg">
            Drop field here
          </span>
        </div>
      )}
      <CardHeader className=" p-4 md:p-6">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold flex items-center justify-between">
              {title}
              {editing && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-2 hover:bg-primary/5 hover:text-primary transition-all duration-200"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Field
                      <ChevronDown className="h-3 w-3 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[320px] p-2 max-h-[400px] overflow-y-auto">
                    <div className="grid gap-1">
                      {fieldTypes.map((type) => (
                        <DropdownMenuItem
                          key={type.id}
                          onClick={() => addField(type.id)}
                          className="flex items-start gap-3 p-3 cursor-pointer focus:bg-muted"
                        >
                          <div className="mt-1 text-primary">{type.icon}</div>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-sm">{type.title}</span>
                            <span className="text-xs text-muted-foreground leading-relaxed">
                              {type.description}
                            </span>
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 md:p-6 space-y-4">
        {activeFields.length === 0 ? (
          <div className="text-center py-8 px-4 rounded-lg">
            <p className="text-sm text-slate-500 italic">No custom fields added yet.</p>
            {editing && (
              <Button
                type="button"
                variant="link"
                onClick={addField}
                className="mt-2 text-primary"
              >
                Click here to add the first field
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-3">
            {activeFields.map((field) => (
              <DraggableFieldItem key={field.id} fieldKey={field.id}>
                <div className="group flex flex-col sm:flex-row items-start sm:items-end gap-3 p-3 rounded-lg border border-black-800 transition-all duration-200">
                  {editing && (
                    <DraggableFieldItem fieldKey={field.id} isHandle>
                      <div className="p-2 text-slate-400 hover:text-slate-600">
                        <GripVertical className="h-4 w-4" />
                      </div>
                    </DraggableFieldItem>
                  )}
                  <div className="flex-1 w-full space-y-1.5">
                    <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider ml-1">Field Name</Label>
                    <Input
                      placeholder="e.g. Preferred Language"
                      value={field.key}
                      onChange={(e) => updateField(field.id, { key: e.target.value })}
                      className="h-10 focus-visible:ring-primary/20"
                      disabled={!editing}
                    />
                  </div>
                  <div className="flex-1 w-full space-y-1.5">
                    <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider ml-1">Value</Label>
                    {field.type === "boolean" ? (
                      <Select
                        value={field.value}
                        onValueChange={(v) => updateField(field.id, { value: v })}
                        disabled={!editing}
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
                        placeholder={field.type === "money" ? "0.00" : "e.g. English"}
                        value={field.value}
                        onChange={(e) => updateField(field.id, { value: e.target.value })}
                        className="h-10 border-slate-200 focus-visible:ring-primary/20"
                        disabled={!editing}
                      />
                    )}
                  </div>
                  {editing && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeField(field.id)}
                      className="h-10 w-10 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors duration-200"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </DraggableFieldItem>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DraggableFieldItem({ fieldKey, children, isHandle = false }: { fieldKey: string; children: React.ReactNode; isHandle?: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: fieldKey });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  if (isHandle) {
    return (
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        {children}
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style}>
      {children}
    </div>
  );
}
