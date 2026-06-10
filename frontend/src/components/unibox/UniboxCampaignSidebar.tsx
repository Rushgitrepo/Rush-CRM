import { useState, useMemo, useCallback, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import {
  ChevronRight,
  FolderOpen,
  FolderPlus,
  GripVertical,
  Pencil,
  Trash2,
  Check,
  X,
  User,
} from "lucide-react";
import {
  useUniboxCampaigns,
  useUniboxCampaignFolders,
  type UniboxCampaign,
  type UniboxCampaignFolder,
} from "@/hooks/useUniboxEmails";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const CAMPAIGN_PREFIX = "campaign:";
const FOLDER_PREFIX = "folder:";

interface OrgUser {
  id: string;
  full_name: string;
  email: string;
}

function campaignDragId(campaignId: string) {
  return `${CAMPAIGN_PREFIX}${campaignId}`;
}

function folderDropId(folderId: string) {
  return `${FOLDER_PREFIX}${folderId}`;
}

function parseDragId(id: string) {
  if (id.startsWith(CAMPAIGN_PREFIX)) return { type: "campaign" as const, id: id.slice(CAMPAIGN_PREFIX.length) };
  if (id.startsWith(FOLDER_PREFIX)) return { type: "folder" as const, id: id.slice(FOLDER_PREFIX.length) };
  return null;
}

function FolderUserAssigner({
  folder,
  orgUsers,
  onAssignUsers,
}: {
  folder: UniboxCampaignFolder;
  orgUsers: OrgUser[];
  onAssignUsers: (folderId: string, userIds: string[]) => void;
}) {
  const assignedIds = new Set(folder.assigned_users?.map((u) => u.id) || []);
  const label =
    folder.assigned_users?.length === 0
      ? "Assign users"
      : folder.assigned_users!.length <= 2
        ? folder.assigned_users!.map((u) => u.full_name).join(", ")
        : `${folder.assigned_users!.slice(0, 2).map((u) => u.full_name).join(", ")} +${folder.assigned_users!.length - 2}`;

  const toggleUser = (userId: string, checked: boolean) => {
    const next = new Set(assignedIds);
    if (checked) next.add(userId);
    else next.delete(userId);
    onAssignUsers(folder.id, Array.from(next));
  };

  return (
    <div className="ml-6 pl-1 pr-1">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-400 hover:bg-white/[0.08] hover:text-slate-300 transition-colors truncate"
          >
            <User className="h-3 w-3 shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-2" align="start" side="right">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">
            Assign to users
          </p>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {orgUsers.length === 0 ? (
              <p className="text-xs text-muted-foreground px-1 py-2">No team members</p>
            ) : (
              orgUsers.map((user) => (
                <label
                  key={user.id}
                  className="flex items-center gap-2 rounded-md px-1 py-1.5 hover:bg-accent cursor-pointer"
                >
                  <Checkbox
                    checked={assignedIds.has(user.id)}
                    onCheckedChange={(checked) => toggleUser(user.id, checked === true)}
                  />
                  <span className="text-xs truncate">{user.full_name}</span>
                </label>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function CampaignLink({
  campaign,
  isActive,
  onMobileClose,
  isOwner,
}: {
  campaign: UniboxCampaign;
  isActive: boolean;
  onMobileClose?: () => void;
  isOwner: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: campaignDragId(campaign.id),
    data: { campaignId: campaign.id },
    disabled: !isOwner,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("flex items-center gap-0.5", isDragging && "opacity-40")}
    >
      {isOwner && (
        <button
          type="button"
          className="shrink-0 p-0.5 rounded text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing touch-none"
          {...listeners}
          {...attributes}
          onClick={(e) => e.preventDefault()}
        >
          <GripVertical className="h-3 w-3" />
        </button>
      )}
      <NavLink
        to={`/crm/unibox?campaign_id=${campaign.id}`}
        onClick={() => onMobileClose?.()}
        className={cn(
          "flex flex-1 items-center justify-between rounded-lg py-1.5 pl-1 pr-2 text-[12px] transition-all group/camp min-w-0",
          isActive
            ? "text-primary font-bold bg-primary/5"
            : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.03]",
          !isOwner && "pl-3",
        )}
      >
        <span className="truncate flex items-center gap-1.5 min-w-0">
          <span className="h-1.5 w-1.5 rounded-full bg-primary/50 shrink-0" />
          <span className="truncate">{campaign.name}</span>
        </span>
        {campaign.email_count > 0 && (
          <span className="shrink-0 ml-1.5 inline-flex items-center justify-center h-4 min-w-4 rounded bg-white/10 px-1.5 text-[9px] font-semibold text-slate-400 group-hover/camp:text-slate-300 transition-colors">
            {campaign.email_count}
          </span>
        )}
      </NavLink>
    </div>
  );
}

function DroppableFolder({
  folder,
  campaigns,
  isExpanded,
  onToggle,
  editingId,
  editName,
  onEditNameChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onAssignUsers,
  onMobileClose,
  selectedCampaignId,
  isOwner,
  orgUsers,
}: {
  folder: UniboxCampaignFolder;
  campaigns: UniboxCampaign[];
  isExpanded: boolean;
  onToggle: () => void;
  editingId: string | null;
  editName: string;
  onEditNameChange: (name: string) => void;
  onStartEdit: (folder: UniboxCampaignFolder) => void;
  onSaveEdit: (folderId: string) => void;
  onCancelEdit: () => void;
  onDelete: (folderId: string) => void;
  onAssignUsers: (folderId: string, userIds: string[]) => void;
  onMobileClose?: () => void;
  selectedCampaignId: string;
  isOwner: boolean;
  orgUsers: OrgUser[];
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: folderDropId(folder.id),
    disabled: !isOwner,
  });
  const isEditing = editingId === folder.id;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "space-y-0.5 rounded-lg transition-colors",
        isOver && isOwner && "bg-primary/10 ring-1 ring-primary/30",
      )}
    >
      <div className="flex items-center gap-1 rounded-lg py-1 pl-1 pr-1">
        <button
          type="button"
          onClick={onToggle}
          className="shrink-0 p-0.5 text-slate-600 hover:text-slate-400"
        >
          <ChevronRight className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-90")} />
        </button>
        <FolderOpen className="h-3.5 w-3.5 shrink-0 text-primary/70" />

        {isEditing ? (
          <div className="flex flex-1 items-center gap-1 min-w-0">
            <Input
              value={editName}
              onChange={(e) => onEditNameChange(e.target.value)}
              className="h-6 text-[11px] px-1.5 bg-white/5 border-white/10"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") onSaveEdit(folder.id);
                if (e.key === "Escape") onCancelEdit();
              }}
            />
            <button type="button" onClick={() => onSaveEdit(folder.id)} className="p-0.5 text-green-500 hover:text-green-400">
              <Check className="h-3 w-3" />
            </button>
            <button type="button" onClick={onCancelEdit} className="p-0.5 text-slate-500 hover:text-slate-300">
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={onToggle}
              className="flex-1 text-left text-[11px] font-semibold text-slate-400 truncate min-w-0"
              title={folder.name}
            >
              {folder.name}
              {campaigns.length > 0 && (
                <span className="ml-1 text-[9px] text-slate-600 font-normal">({campaigns.length})</span>
              )}
            </button>
            {isOwner && !folder.is_default && (
              <div className="flex items-center shrink-0">
                <button
                  type="button"
                  onClick={() => onStartEdit(folder)}
                  className="p-0.5 text-slate-600 hover:text-slate-400"
                  title="Rename folder"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(folder.id)}
                  className="p-0.5 text-slate-600 hover:text-red-400"
                  title="Delete folder"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {isOwner && (
        <FolderUserAssigner folder={folder} orgUsers={orgUsers} onAssignUsers={onAssignUsers} />
      )}

      {!isOwner && folder.assigned_users?.length > 0 && (
        <p className="ml-6 pl-1 text-[10px] text-slate-600 flex items-center gap-1">
          <User className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {folder.assigned_users.map((u) => u.full_name).join(", ")}
          </span>
        </p>
      )}

      {isExpanded && (
        <div className="ml-4 space-y-0.5 min-h-[8px] rounded-md">
          {campaigns.length === 0 ? (
            <p className="text-[10px] text-slate-600 italic pl-3 py-1">
              {isOwner ? "Drop campaigns here" : "No campaigns"}
            </p>
          ) : (
            campaigns.map((camp) => (
              <CampaignLink
                key={camp.id}
                campaign={camp}
                isActive={selectedCampaignId === camp.id}
                onMobileClose={onMobileClose}
                isOwner={isOwner}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function UniboxCampaignSidebar({
  onMobileClose,
  isOwner = false,
  hasFullAccess = false,
}: {
  onMobileClose?: () => void;
  isOwner?: boolean;
  hasFullAccess?: boolean;
}) {
  const location = useLocation();
  const { data: campaigns = [], isLoading: campaignsLoading } = useUniboxCampaigns();
  const {
    folders,
    isLoading: foldersLoading,
    createFolder,
    renameFolder,
    deleteFolder,
    assignCampaign,
    assignUsersToFolder,
  } = useUniboxCampaignFolders();

  const { data: orgUsers = [] } = useQuery<OrgUser[]>({
    queryKey: ["organization-users"],
    queryFn: async () => api.get("/members"),
    enabled: isOwner,
    staleTime: 60000,
  });

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);

  const selectedCampaignId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("campaign_id") || "";
  }, [location.search]);

  const campaignMap = useMemo(() => new Map(campaigns.map((c) => [c.id, c])), [campaigns]);

  const assignmentMap = useMemo(() => {
    const map = new Map<string, string>();
    folders.forEach((folder) => {
      folder.campaigns.forEach((item) => map.set(item.campaign_id, folder.id));
    });
    return map;
  }, [folders]);

  const defaultFolder = folders.find((f) => f.is_default);
  const customFolders = folders.filter((f) => !f.is_default);

  const getCampaignsForFolder = useCallback(
    (folder: UniboxCampaignFolder) => {
      if (folder.is_default) {
        return campaigns.filter((c) => !assignmentMap.has(c.id));
      }
      return folder.campaigns
        .map((item) => campaignMap.get(item.campaign_id))
        .filter(Boolean) as UniboxCampaign[];
    },
    [campaigns, assignmentMap, campaignMap],
  );

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    if (!over || !isOwner) return;

    const activeParsed = parseDragId(active.id as string);
    const overParsed = parseDragId(over.id as string);

    if (activeParsed?.type === "campaign") {
      let targetFolderId: string | null = null;
      if (overParsed?.type === "folder") {
        targetFolderId = overParsed.id;
      } else if (overParsed?.type === "campaign") {
        targetFolderId = assignmentMap.get(overParsed.id) || defaultFolder?.id || null;
      }

      if (targetFolderId) {
        const currentFolderId = assignmentMap.get(activeParsed.id) || defaultFolder?.id;
        if (currentFolderId !== targetFolderId) {
          assignCampaign.mutate({ campaign_id: activeParsed.id, folder_id: targetFolderId });
        }
      }
    }
  };

  const handleCreateFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;
    createFolder.mutate(name, {
      onSuccess: (data: { folder?: { id: string } }) => {
        setNewFolderName("");
        setShowNewFolder(false);
        if (data?.folder?.id) {
          setExpandedFolders((prev) => new Set([...prev, data.folder!.id]));
        }
      },
    });
  };

  const handleStartEdit = (folder: UniboxCampaignFolder) => {
    setEditingId(folder.id);
    setEditName(folder.name);
  };

  const handleSaveEdit = (folderId: string) => {
    const name = editName.trim();
    if (!name) return;
    renameFolder.mutate(
      { id: folderId, name },
      { onSuccess: () => { setEditingId(null); setEditName(""); } },
    );
  };

  const handleDeleteFolder = (folderId: string) => {
    deleteFolder.mutate(folderId);
  };

  const handleAssignUsers = (folderId: string, userIds: string[]) => {
    assignUsersToFolder.mutate({ folderId, assigned_user_ids: userIds });
  };

  const activeCampaign = activeDragId
    ? (() => {
        const parsed = parseDragId(activeDragId);
        return parsed?.type === "campaign" ? campaignMap.get(parsed.id) : null;
      })()
    : null;

  const isLoading = campaignsLoading || foldersLoading;
  const allFolders = [...customFolders, ...(defaultFolder ? [defaultFolder] : [])];

  useEffect(() => {
    if (allFolders.length > 0) {
      setExpandedFolders((prev) => {
        if (prev.size > 0) return prev;
        return new Set(allFolders.map((f) => f.id));
      });
    }
  }, [allFolders.length]);

  const folderList = (
    <div className="space-y-2">
      {allFolders.map((folder) => (
        <DroppableFolder
          key={folder.id}
          folder={folder}
          campaigns={getCampaignsForFolder(folder)}
          isExpanded={expandedFolders.has(folder.id)}
          onToggle={() => toggleFolder(folder.id)}
          editingId={editingId}
          editName={editName}
          onEditNameChange={setEditName}
          onStartEdit={handleStartEdit}
          onSaveEdit={handleSaveEdit}
          onCancelEdit={() => { setEditingId(null); setEditName(""); }}
          onDelete={handleDeleteFolder}
          onAssignUsers={handleAssignUsers}
          onMobileClose={onMobileClose}
          selectedCampaignId={selectedCampaignId}
          isOwner={isOwner}
          orgUsers={orgUsers}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between pl-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Campaigns</span>
        {isOwner && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-slate-500 hover:text-slate-300"
            onClick={() => setShowNewFolder(true)}
            title="New folder"
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {isOwner && showNewFolder && (
        <div className="flex items-center gap-1 pl-1">
          <Input
            placeholder="Folder name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            className="h-7 text-[11px] px-2 bg-white/5 border-white/10"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateFolder();
              if (e.key === "Escape") { setShowNewFolder(false); setNewFolderName(""); }
            }}
          />
          <button type="button" onClick={handleCreateFolder} className="p-1 text-green-500 hover:text-green-400">
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => { setShowNewFolder(false); setNewFolderName(""); }}
            className="p-1 text-slate-500 hover:text-slate-300"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-1.5 pl-3">
          <div className="h-3 w-20 rounded bg-white/5 animate-pulse" />
          <div className="h-3 w-16 rounded bg-white/5 animate-pulse" />
          <div className="h-3 w-24 rounded bg-white/5 animate-pulse" />
        </div>
      ) : allFolders.length === 0 ? (
        <p className="text-[11px] text-slate-600 italic pl-3">
          {isOwner || hasFullAccess ? "No folders yet" : "No folders assigned to you"}
        </p>
      ) : isOwner ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {folderList}
          <DragOverlay>
            {activeCampaign ? (
              <div className="flex items-center gap-1.5 rounded-lg bg-slate-800/90 px-2 py-1.5 text-[12px] text-slate-200 shadow-lg border border-white/10">
                <GripVertical className="h-3 w-3 text-slate-500" />
                <span className="truncate max-w-[140px]">{activeCampaign.name}</span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        folderList
      )}
    </div>
  );
}
