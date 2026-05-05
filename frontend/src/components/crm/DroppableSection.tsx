import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";

interface DroppableSectionProps {
  id: string;
  children: React.ReactNode;
  className?: string;
  editing?: boolean;
}

export function DroppableSection({ id, children, className, editing }: DroppableSectionProps) {
  const { isOver, setNodeRef } = useDroppable({
    id,
    disabled: !editing,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        className,
        editing && "transition-all duration-200",
        isOver && editing && "ring-2 ring-primary ring-offset-2 bg-primary/5"
      )}
    >
      {children}
      {isOver && editing && (
        <div className="absolute inset-0 pointer-events-none bg-primary/10 rounded-lg border-2 border-dashed border-primary flex items-center justify-center">
          <span className="text-sm font-medium text-primary bg-white px-3 py-1 rounded-full shadow-lg">
            Drop field here
          </span>
        </div>
      )}
    </div>
  );
}
