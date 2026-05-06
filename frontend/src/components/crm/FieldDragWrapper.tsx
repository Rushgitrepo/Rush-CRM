import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { toast } from "sonner";
import { useState } from "react";

interface CustomField {
  id: string;
  key: string;
  value: string;
  sectionId?: string;
}

interface FieldDragWrapperProps {
  children: React.ReactNode;
  customFields: CustomField[];
  onCustomFieldsChange: (fields: CustomField[]) => void;
  onFieldDropToSection: (fieldKey: string, fieldValue: string, sectionId: string) => void;
  editing: boolean;
}

export function FieldDragWrapper({
  children,
  customFields,
  onCustomFieldsChange,
  onFieldDropToSection,
  editing,
}: FieldDragWrapperProps) {
  const [activeField, setActiveField] = useState<CustomField | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const field = customFields.find((f) => f.id === active.id);
    if (field) {
      setActiveField(field);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveField(null);

    if (!over) {
      console.log("Dropped outside any target");
      return;
    }

    const fieldId = active.id as string;
    let targetSectionId = over.id as string;

    if (!editing) return;

    // Find the field in customFields
    const fieldIndex = customFields.findIndex((f) => f.id === fieldId);
    if (fieldIndex === -1) return;

    const field = customFields[fieldIndex];

    // If the target is another field (sortable item), use that field's sectionId
    const targetField = customFields.find(f => f.id === targetSectionId);
    if (targetField) {
      targetSectionId = targetField.sectionId || "custom-fields";
    }

    // List of valid section IDs across leads and deals
    const validSections = [
      "custom-fields",
      "lead-company-details",
      "activity-tracking",
      "qualification-opportunity",
      "source-section",
      "deal-info",
      "contact-info",
      "company-info",
      "about-deal",
      "more-section",
      "budget-payment",
      "project-details",
      "marketing-qualification"
    ];

    // If the target is not a known section and not another field, it's an invalid drop
    if (!validSections.includes(targetSectionId)) {
      console.warn(`Dropped on invalid target: ${targetSectionId}`);
      // Special case: if it's a sortable item, we already handled it above.
      // If it's still not in validSections, it might be a sub-element ID.
      // For now, let's allow it if it's not null, but prioritize valid sections.
      return;
    }

    // If dropping into a different section than it's currently in
    const currentSectionId = field.sectionId || "custom-fields";
    
    if (currentSectionId !== targetSectionId) {
      const newCustomFields = [...customFields];
      newCustomFields[fieldIndex] = { ...field, sectionId: targetSectionId };
      onCustomFieldsChange(newCustomFields);
      
      onFieldDropToSection(field.key, field.value, targetSectionId);
      
      const sectionName = targetSectionId === "custom-fields" ? "Custom Fields" : 
                         targetSectionId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      toast.success(`Field "${field.key || "New Field"}" moved to ${sectionName}`);
    }
  };

  if (!editing) {
    return <>{children}</>;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={customFields.map((f) => f.id)}
        strategy={verticalListSortingStrategy}
      >
        {children}
      </SortableContext>
      <DragOverlay>
        {activeField ? (
          <div className="bg-white border-2 border-primary rounded-lg p-4 shadow-2xl z-[9999]">
            <div className="text-sm font-semibold text-foreground">
              <span className="text-primary">{activeField.key}:</span>
              <span className="ml-2 text-muted-foreground">{activeField.value}</span>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
