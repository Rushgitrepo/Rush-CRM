import React from "react";
import { Plus, Trash2, Tag as TagIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CustomField {
  key: string;
  value: string;
}

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
  const addField = () => {
    onChange([...fields, { key: "", value: "" }]);
  };

  const removeField = (index: number) => {
    const newFields = [...fields];
    newFields.splice(index, 1);
    onChange(newFields);
  };

  const updateField = (index: number, updates: Partial<CustomField>) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], ...updates };
    onChange(newFields);
  };

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className=" p-4 md:p-6">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold flex items-center justify-between">
              {title}
              {editing && (
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={addField}
                  className="h-8 gap-2 border-primary/20 hover:bg-primary/5 hover:text-primary transition-all duration-200"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Field
                </Button>
              )}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 md:p-6 space-y-4">
        {fields.length === 0 ? (
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
            {fields.map((field, index) => (
              <div 
                key={index} 
                className="group flex flex-col sm:flex-row items-start sm:items-end gap-3 p-3 rounded-lg border border-slate-100 transition-all duration-200"
              >
                <div className="flex-1 w-full space-y-1.5">
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider ml-1">Field Name</Label>
                  <Input
                    placeholder="e.g. Preferred Language"
                    value={field.key}
                    onChange={(e) => updateField(index, { key: e.target.value })}
                    className="h-10  focus-visible:ring-primary/20"
                    disabled={!editing}
                  />
                </div>
                <div className="flex-1 w-full space-y-1.5">
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider ml-1">Value</Label>
                  <Input
                    placeholder="e.g. English"
                    value={field.value}
                    onChange={(e) => updateField(index, { value: e.target.value })}
                    className="h-10 border-slate-200 focus-visible:ring-primary/20"
                    disabled={!editing}
                  />
                </div>
                {editing && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeField(index)}
                    className="h-10 w-10 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors duration-200"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
