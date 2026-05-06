import React from "react";
import { Plus, Trash2, Tag as TagIcon, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";

interface CustomField {
  id: string;
  key: string;
  value: string;
  sectionId?: string;
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
  const { isOver, setNodeRef } = useDroppable({
    id: "custom-fields",
    disabled: !editing,
  });

  const addField = () => {
    const newId = `field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    onChange([...fields, { id: newId, key: "", value: "", sectionId: "custom-fields" }]);
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
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={addField}
                  className="h-8 gap-2  hover:bg-primary/5 hover:text-primary transition-all duration-200"
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
            {activeFields.map((field, index) => (
              <div 
                key={field.id} 
                className="group flex flex-col sm:flex-row items-start sm:items-end gap-3 p-3 rounded-lg border  border-black-800 transition-all duration-200"
              >
                {editing && (
                  <DraggableFieldItem fieldKey={field.id}>
                    <button className="p-1 cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600">
                      <GripVertical className="h-4 w-4" />
                    </button>
                  </DraggableFieldItem>
                )}
                <div className="flex-1 w-full space-y-1.5">
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider ml-1">Field Name</Label>
                  <Input
                    placeholder="e.g. Preferred Language"
                    value={field.key}
                    onChange={(e) => updateField(field.id, { key: e.target.value })}
                    className="h-10  focus-visible:ring-primary/20"
                    disabled={!editing}
                  />
                </div>
                <div className="flex-1 w-full space-y-1.5">
                  <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider ml-1">Value</Label>
                  <Input
                    placeholder="e.g. English"
                    value={field.value}
                    onChange={(e) => updateField(field.id, { value: e.target.value })}
                    className="h-10 border-slate-200 focus-visible:ring-primary/20"
                    disabled={!editing}
                  />
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
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DraggableFieldItem({ fieldKey, children }: { fieldKey: string; children: React.ReactNode }) {
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
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}
