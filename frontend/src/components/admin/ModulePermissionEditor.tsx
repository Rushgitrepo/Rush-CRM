import React, { useState } from "react";
import { DASHBOARD_MODULES, MODULE_PERMISSIONS } from "@/data/permissions.js";
import { Search, Settings2, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

interface ModulePermissionEditorProps {
  selectedModules: Record<string, string[]>;
  setSelectedModules: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
}

export function ModulePermissionEditor({
  selectedModules,
  setSelectedModules,
}: ModulePermissionEditorProps) {
  const [moduleSearch, setModuleSearch] = useState("");

  const togglePermission = (moduleId: string, permission: string) => {
    setSelectedModules((prev) => {
      const current = prev[moduleId] || [];
      if (current.includes(permission)) {
        const next = current.filter((p) => p !== permission);
        if (next.length === 0) {
          const { [moduleId]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [moduleId]: next };
      } else {
        return { ...prev, [moduleId]: [...current, permission] };
      }
    });
  };

  const toggleAllModulePermissions = (moduleId: string, checked: boolean) => {
    if (checked) {
      setSelectedModules((prev) => ({
        ...prev,
        [moduleId]: [...(MODULE_PERMISSIONS as any)[moduleId]],
      }));
    } else {
      setSelectedModules((prev) => {
        const { [moduleId]: _, ...rest } = prev;
        return rest;
      });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter modules..."
            value={moduleSearch}
            onChange={(e) => setModuleSearch(e.target.value)}
            className="pl-9 bg-secondary/30 border-none h-10"
          />
        </div>
      </div>

      <div className="space-y-8 pb-4">
        {DASHBOARD_MODULES.map((cat, catIdx) => {
          const filteredModules = cat.modules.filter(
            (m) =>
              m.name.toLowerCase().includes(moduleSearch.toLowerCase()) ||
              cat.category.toLowerCase().includes(moduleSearch.toLowerCase())
          );

          if (filteredModules.length === 0) return null;

          return (
            <div key={catIdx} className="space-y-3">
              <h3 className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-2 px-1">
                <Settings2 className="h-3 w-3" />
                {cat.category}
              </h3>
              <div className="grid gap-3">
                {filteredModules.map((module) => {
                  const modulePerms = (MODULE_PERMISSIONS as any)[module.id] || [];
                  const selectedCount = selectedModules[module.id]?.length || 0;
                  const isAllSelected = modulePerms.length > 0 && selectedCount === modulePerms.length;

                  return (
                    <Card
                      key={module.id}
                      className="border-border/50 bg-secondary/10 overflow-hidden group hover:border-primary/30 transition-all duration-300"
                    >
                      <div className="p-4 bg-secondary/20 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${
                              selectedCount > 0
                                ? "bg-primary/20 text-primary"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            <Lock className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{module.name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {selectedCount} of {modulePerms.length} permissions assigned
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-[10px] uppercase font-bold text-muted-foreground cursor-pointer group-hover:text-primary transition-colors pr-2">
                            Select All
                          </label>
                          <Checkbox
                            checked={isAllSelected}
                            onCheckedChange={(checked) =>
                              toggleAllModulePermissions(module.id, !!checked)
                            }
                            className="h-5 w-5 border-border rounded"
                          />
                        </div>
                      </div>
                      <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-card/30">
                        {modulePerms.map((perm: string) => (
                          <div
                            key={perm}
                            className="flex items-center space-x-2 p-2 rounded-md hover:bg-secondary/40 transition-colors cursor-pointer"
                          >
                            <Checkbox
                              id={`${module.id}-${perm}`}
                              checked={selectedModules[module.id]?.includes(perm) || false}
                              onCheckedChange={() => togglePermission(module.id, perm)}
                              className="h-4 w-4"
                            />
                            <label
                              htmlFor={`${module.id}-${perm}`}
                              className="text-sm font-medium leading-none cursor-pointer capitalize"
                            >
                              {perm.replace(/_/g, " ")}
                            </label>
                          </div>
                        ))}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
