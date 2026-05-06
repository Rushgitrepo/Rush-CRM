import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Upload, DollarSign, Link as LinkIcon, ExternalLink, Hash, FileText, List, Clock, Calendar, MapPin, Globe, File, CheckCircle, TrendingUp } from "lucide-react";
import { crmDocumentsApi, FILE_BASE_URL } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const openFile = (value: string) => {
  // If it's already a full URL, open directly
  if (value.startsWith('http://') || value.startsWith('https://')) {
    window.open(value, '_blank');
    return;
  }
  // Ensure path starts with /
  const path = value.startsWith('/') ? value : `/uploads/crm/${value}`;
  window.open(`${FILE_BASE_URL}${path}`, '_blank');
};

interface CustomField {
  id: string;
  key: string;
  value: string;
  type?: string;
  sectionId?: string;
}

interface CustomFieldInputProps {
  field: CustomField;
  editing: boolean;
  updateField: (id: string, updates: Partial<CustomField>) => void;
  entityType?: string;
  entityId?: string;
}

export function CustomFieldInput({
  field,
  editing,
  updateField,
  entityType,
  entityId
}: CustomFieldInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!entityType || !entityId) {
      updateField(field.id, { value: file.name });
      toast.info(`File selected: ${file.name}. It will be uploaded when you save.`);
      return;
    }

    setUploading(true);
    try {
      const response = await crmDocumentsApi.upload(entityType, entityId, file);
      // Backend returns the document object with file_path
      const doc = response; // Based on ApiClient, it returns the data directly
      const filePath = doc.file_path || doc.path || file.name;
      
      updateField(field.id, { value: filePath });
      toast.success(`File uploaded successfully: ${file.name}`);
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error("Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  if (!editing) {
    return (
      <div className="min-h-[2.5rem] px-3 py-2 border border-border rounded-lg bg-muted/30 flex items-center overflow-hidden">
        {field.type === "link" && field.value ? (
          <a 
            href={field.value.startsWith('http') ? field.value : `https://${field.value}`} 
            target="_blank" 
            rel="noreferrer" 
            className="text-primary hover:underline font-medium break-all flex items-center gap-2"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {field.value}
          </a>
        ) : field.type === "file" && field.value ? (
          <button 
            onClick={() => openFile(field.value)}
            className="text-primary hover:underline font-medium break-all flex items-center gap-2"
          >
            <File className="h-3.5 w-3.5" />
            {field.value.split('/').pop() || "Download File"}
          </button>
        ) : field.type === "money" ? (
          <span className="text-foreground font-medium">${field.value || '0.00'}</span>
        ) : (
          <span className="text-foreground font-medium break-all">{field.value || <span className="text-muted-foreground italic">Not specified</span>}</span>
        )}
      </div>
    );
  }

  switch (field.type) {
    case "boolean":
      return (
        <Select
          value={field.value}
          onValueChange={(v) => updateField(field.id, { value: v })}
        >
          <SelectTrigger className="h-10 border-border">
            <SelectValue placeholder="Select Yes/No" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Yes">Yes</SelectItem>
            <SelectItem value="No">No</SelectItem>
          </SelectContent>
        </Select>
      );
    case "date":
      return (
        <Input
          type="date"
          value={field.value}
          onChange={(e) => updateField(field.id, { value: e.target.value })}
          className="h-10 border-border focus-visible:ring-primary/20"
        />
      );
    case "datetime":
      return (
        <Input
          type="datetime-local"
          value={field.value}
          onChange={(e) => updateField(field.id, { value: e.target.value })}
          className="h-10 border-border focus-visible:ring-primary/20"
        />
      );
    case "number":
      return (
        <div className="relative">
          <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="number"
            value={field.value}
            onChange={(e) => updateField(field.id, { value: e.target.value })}
            className="h-10 border-border pl-9 focus-visible:ring-primary/20"
            placeholder="0"
          />
        </div>
      );
    case "money":
      return (
        <div className="relative">
          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="number"
            value={field.value}
            onChange={(e) => updateField(field.id, { value: e.target.value })}
            className="h-10 border-border pl-9 focus-visible:ring-primary/20"
            placeholder="0.00"
          />
        </div>
      );
    case "file":
      return (
        <div className="space-y-2">
          {/* Upload button row */}
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileUpload}
            />
            <Button
              type="button"
              variant="outline"
              className="h-10 flex-1 justify-start gap-2 text-muted-foreground hover:text-foreground"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Upload className={cn("h-4 w-4 shrink-0", uploading && "animate-bounce")} />
              {uploading ? "Uploading..." : "Click to upload file"}
            </Button>
          </div>
          {/* Show uploaded file info */}
          {field.value && (
            <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 rounded-lg border border-primary/20 text-xs">
              <File className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="flex-1 truncate font-medium text-foreground">
                {field.value.split('/').pop()}
              </span>
              <button
                type="button"
                onClick={() => openFile(field.value)}
                className="flex items-center gap-1 text-primary hover:underline shrink-0"
              >
                <ExternalLink className="h-3 w-3" />
                Open
              </button>
              <button
                type="button"
                onClick={() => updateField(field.id, { value: "" })}
                className="text-muted-foreground hover:text-destructive shrink-0"
                title="Remove file"
              >
                ×
              </button>
            </div>
          )}
        </div>
      );
    case "link":
      return (
        <div className="relative">
          <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="url"
            value={field.value}
            onChange={(e) => updateField(field.id, { value: e.target.value })}
            className="h-10 border-border pl-9 pr-9 focus-visible:ring-primary/20"
            placeholder="https://..."
          />
          {field.value && (
            <a
              href={field.value.startsWith('http') ? field.value : `https://${field.value}`}
              target="_blank"
              rel="noreferrer"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      );
    case "address":
      return (
        <Textarea
          value={field.value}
          onChange={(e) => updateField(field.id, { value: e.target.value })}
          className="min-h-[40px] h-10 border-border focus-visible:ring-primary/20 py-2"
          placeholder="Street, City, State..."
        />
      );
    default:
      return (
        <Input
          value={field.value}
          onChange={(e) => updateField(field.id, { value: e.target.value })}
          className="h-10 border-border focus-visible:ring-primary/20"
          placeholder="Value"
        />
      );
  }
}
