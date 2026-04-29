import { useState, useMemo, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkgroups, useDeleteWorkgroup } from "@/hooks/useWorkgroups";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { useRealtime } from "@/hooks/useRealtime";
import {
  LayoutDashboard,
  LayoutGrid,
  Users,
  UserPlus,
  Handshake,
  Package,
  Warehouse,
  Calendar,
  Mail,
  Mailbox,
  Settings,
  ChevronDown,
  ChevronRight,
  Building2,
  Briefcase,
  DollarSign,
  UserCheck,
  TrendingUp,
  ShoppingCart,
  Truck,
  BarChart3,
  FolderOpen,
  UsersRound,
  ClipboardList,
  FileText,
  Bell,
  Shield,
  Lock,
  LogIn,
  Phone,
  CheckSquare,
  Zap,
  UserPlus2,
  FolderKanban,
  Megaphone,
  Target,
  ListFilter,
  UserCog,
  CheckCircle,
  MessageSquare,
  Building,
  ArrowRight,
  LogOut,
  HelpCircle,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarUrl } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface NestedChild {
  title: string;
  href: string;
  hasNested?: boolean;
}

interface NavSubItem {
  title: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  nestedChildren?: NestedChild[];
}

interface NavItem {
  title: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  children?: NavSubItem[];
}

const navigation: NavItem[] = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },

  {
    title: "Tasks & Projects",
    href: "/tasks",
    icon: FolderKanban,
  },
  {
    title: "Collaboration",
    icon: UsersRound,
    children: [
      { title: "Calendar", href: "/collaboration/calendar", icon: Calendar },
      { title: "Drive", href: "/collaboration/drive", icon: FolderOpen },
      { title: "Mail", href: "/collaboration/mail", icon: Mail },
      { title: "Workgroups", href: "/collaboration/workgroups", icon: Users },
    ],
  },
  {
    title: "CRM",
    icon: TrendingUp,
    children: [
      { title: "Unibox", href: "/crm/unibox", icon: Mailbox },
      { title: "Leads", href: "/crm/leads", icon: UserPlus },
      { title: "Deals", href: "/crm/deals", icon: Handshake },
      { title: "Unqualified", href: "/crm/unqualified", icon: ListFilter },
      {
        title: "Customers",
        href: "/crm/customers",
        icon: Building2,
        nestedChildren: [
          { title: "Contacts", href: "/crm/customers/contacts" },
          { title: "Companies", href: "/crm/customers/companies" },
          { title: "Signing parties", href: "/crm/customers/signing-parties", hasNested: true },
          { title: "Vendors", href: "/inventory/vendors", hasNested: false },
        ]
      },
      { title: "Sales", href: "/crm/sales", icon: DollarSign },
      { title: "Analytics", href: "/crm/analytics", icon: BarChart3 },
      { title: "Communications", href: "/crm/communications", icon: Phone },
    ],
  },
  {
    title: "HRMS",
    icon: Briefcase,
    children: [
      { title: "Dashboard", href: "/hrms", icon: BarChart3 },
      { title: "Attendance", href: "/hrms/attendance", icon: ClipboardList },
      { title: "Employees", href: "/hrms/employees", icon: UserCheck },
      { title: "Leave Management", href: "/hrms/leave", icon: Calendar },
      { title: "Payroll", href: "/hrms/payroll", icon: DollarSign },
      { title: "Notifications", href: "/hrms/notifications", icon: Bell },
    ],
  },
  {
    title: "Recruitment",
    icon: UserCog,
    children: [
      { title: "Dashboard", href: "/recruitment", icon: LayoutDashboard },
      { title: "Approvals", href: "/recruitment/approvals", icon: CheckCircle },
      { title: "Requisitions", href: "/recruitment/requisitions", icon: FileText },
      { title: "Candidates", href: "/recruitment/candidates", icon: Users },
      { title: "Interviews", href: "/recruitment/interviews", icon: MessageSquare },
      { title: "Offers", href: "/recruitment/offers", icon: DollarSign },
      { title: "Scoring", href: "/recruitment/scoring", icon: Target },
      // { title: "Talent Pool", href: "/recruitment/talent-pool", icon: UsersRound },
      { title: "Analytics", href: "/recruitment/analytics", icon: BarChart3 },
    ],
  },
  {
    title: "Inventory",
    icon: Package,
    children: [
      { title: "Dashboard", href: "/inventory", icon: BarChart3 },
      { title: "Products", href: "/inventory/products", icon: ShoppingCart },
      { title: "Stock Tracking", href: "/inventory/stock", icon: Package },
      { title: "Vendors", href: "/inventory/vendors", icon: Truck },
      { title: "Purchase Orders", href: "/inventory/purchase-orders", icon: FileText },
      { title: "Warehouses", href: "/inventory/warehouses", icon: Warehouse },
      { title: "Product Assignments", href: "/inventory/assignments", icon: Users },
    ],
  },
  {
    title: "Marketing",
    icon: Megaphone,
    children: [
      { title: "Dashboard", href: "/marketing", icon: LayoutDashboard },
      { title: "Campaigns", href: "/marketing/campaigns", icon: Mail },
      { title: "Lists & Segments", href: "/marketing/lists", icon: ListFilter },
      { title: "Forms", href: "/marketing/forms", icon: FileText },
      { title: "Sequences", href: "/marketing/sequences", icon: Zap },
      { title: "Analytics", href: "/marketing/analytics", icon: BarChart3 },
    ],
  },
  {
    title: "Automation",
    icon: Zap,
    children: [
      { title: "Workflows", href: "/automation/workflows", icon: Zap },
    ],
  },
  {
    title: "Admin Portal",
    icon: Shield,
    children: [
      { title: "User Management", href: "/admin/users", icon: Users },
      { title: "Role Assignments", href: "/admin/roles", icon: UserCheck },
      { title: "Permissions", href: "/admin/permissions", icon: Lock },
      { title: "Join Requests", href: "/admin/join-requests", icon: UserPlus2 },
      { title: "Settings", href: "/admin/settings", icon: Settings },
    ],
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

export function AppSidebar({
  width = 256,
  onWidthChange,
  isMobile,
  isOpen,
  onClose
}: {
  width?: number;
  onWidthChange?: (width: number) => void;
  isMobile?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}) {
  const location = useLocation();
  const { userRole } = useAuth();
  const { data: workgroups = [] } = useWorkgroups();
  const queryClient = useQueryClient();
  const [openSections, setOpenSections] = useState<string[]>(["Collaboration", "CRM"]);
  const [expandedSubItems, setExpandedSubItems] = useState<string[]>([]);
  const [expandedNestedItems, setExpandedNestedItems] = useState<string[]>([]);
  const deleteWg = useDeleteWorkgroup();
  const [deleteChatId, setDeleteChatId] = useState<string | null>(null);
  const { on: onRealtime, off: offRealtime } = useRealtime();

  useEffect(() => {
    const handleWorkgroupUpdated = (payload: any) => {
      // Invalidate queries to refresh the list for all actions (created, updated, deleted)
      queryClient.invalidateQueries({ queryKey: ["workgroups"] });
    };

    const handleNewNotification = (payload: any) => {
      // Refresh workgroups whenever a new message notification arrives
      queryClient.invalidateQueries({ queryKey: ["workgroups"] });
    };

    onRealtime("workgroup:updated", handleWorkgroupUpdated);
    onRealtime("workgroup:notification", handleNewNotification);
    onRealtime("workgroup_post:new", handleWorkgroupUpdated);

    return () => {
      offRealtime("workgroup:updated", handleWorkgroupUpdated);
      offRealtime("workgroup:notification", handleNewNotification);
      offRealtime("workgroup_post:new", handleWorkgroupUpdated);
    };
  }, [onRealtime, offRealtime, queryClient]);

  const isAdmin = userRole?.role === 'super_admin' || userRole?.role === 'admin';

  const toggleStarChat = async (workgroupId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const workgroup = workgroups.find((wg: any) => wg.id === workgroupId);
    if (!workgroup) return;

    const newStarredState = !workgroup.is_starred;

    try {
      await api.put(`/workgroups/${workgroupId}/star`, {
        is_starred: newStarredState
      });
      // Invalidate and refetch workgroups to update the UI immediately
      queryClient.invalidateQueries({ queryKey: ['workgroups'] });
    } catch (error) {
      console.error('Failed to toggle star:', error);
    }
  };

  // Direct Messages from workgroups - show starred first, then recent, max 5
  const directMessages = useMemo(
    () => {
      const dms = workgroups
        .filter(
          (wg: any) =>
            wg.type === "private" &&
            Boolean(wg.settings?.is_direct_chat)
        );

      // Separate starred and non-starred
      const starred = dms.filter((wg: any) => wg.is_starred);
      const nonStarred = dms.filter((wg: any) => !wg.is_starred);

      // Sort both by recent activity
      const sortByRecent = (a: any, b: any) => {
        const ta = new Date(a.last_message_at || a.updated_at || a.created_at).getTime();
        const tb = new Date(b.last_message_at || b.updated_at || b.created_at).getTime();
        return tb - ta;
      };

      starred.sort(sortByRecent);
      nonStarred.sort(sortByRecent);

      // Combine starred first, then non-starred, limit to 5 total
      return [...starred, ...nonStarred].slice(0, 5);
    },
    [workgroups]
  );

  // Team Workgroups (non-DM)
  const teamWorkgroups = useMemo(
    () =>
      workgroups
        .filter(
          (wg: any) =>
            !(wg.type === "private" && Boolean(wg.settings?.is_direct_chat))
        )
        .sort((a: any, b: any) => {
          const ta = new Date(a.last_message_at || a.updated_at || a.created_at).getTime();
          const tb = new Date(b.last_message_at || b.updated_at || b.created_at).getTime();
          return tb - ta;
        }),
    [workgroups]
  );

  const totalDMUnread = useMemo(
    () =>
      workgroups
        .filter((wg: any) => wg.type === 'private' && Boolean(wg.settings?.is_direct_chat))
        .reduce((sum: number, wg: any) => sum + Number(wg?.unread_count || 0), 0),
    [workgroups]
  );

  const filteredNavigation = useMemo(() => {
    return navigation.map(item => {
      if (item.title === "Admin Portal" && !isAdmin) return null;
      return item;
    }).filter(Boolean) as NavItem[];
  }, [isAdmin]);

  const toggleSection = (title: string) => {
    setOpenSections((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]
    );
  };

  const toggleSubItem = (title: string) => {
    setExpandedSubItems((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]
    );
  };

  const isActive = (href: string) => location.pathname === href;
  const isSectionActive = (children?: { href: string }[]) =>
    children?.some((child) => location.pathname.startsWith(child.href));
  const totalWorkgroupUnread = useMemo(
    () =>
      workgroups
        .filter((wg: any) => !((wg.type === 'private') && Boolean(wg.settings?.is_direct_chat)))
        .reduce(
          (sum: number, wg: any) => sum + Number(wg?.unread_count || 0),
          0,
        ),
    [workgroups],
  );

  // Define nested submenus for items that have hasNested flag
  const getDeepNestedItems = (title: string): NestedChild[] => {
    switch (title) {
      case "Signing parties":
        return [{ title: "Contacts", href: "/crm/customers/signing-parties/contacts" }];
      case "Vendors":
        // Redirect to main inventory vendors page instead of non-existent CRM routes
        return [
          { title: "All Vendors", href: "/inventory/vendors" },
          { title: "Companies", href: "/crm/companies" },
          { title: "Contacts", href: "/crm/contacts" },
        ];
      default:
        return [];
    }
  };

  const toggleNestedItem = (title: string) => {
    setExpandedNestedItems((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]
    );
  };

  const [isResizing, setIsResizing] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) return;

    const newWidth = Math.max(200, Math.min(480, e.clientX));
    onWidthChange?.(newWidth);
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  // Add event listeners for mouse move and up
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  const renderSubItem = (child: NavSubItem, parentTitle?: string) => {
    const hasNestedChildren = child.nestedChildren && child.nestedChildren.length > 0;
    const isExpanded = expandedSubItems.includes(child.title);

    // Standard rendering for other items
    if (hasNestedChildren) {
      return (
        <div key={child.href} className="group/submenu">
          <NavLink
            to={child.href}
            onClick={(e) => {
              if (hasNestedChildren) {
                e.preventDefault();
                toggleSubItem(child.title);
              }
            }}
            className={cn(
              "flex w-full items-center justify-between gap-3 rounded-xl py-2 pl-9 pr-3 text-[13px] transition-all duration-200",
              isActive(child.href) || location.pathname.startsWith(child.href)
                ? "bg-primary/10 text-white font-medium"
                : "text-slate-400 hover:text-white hover:bg-white/[0.03]"
            )}
          >
            <div className="flex items-center gap-3">
              {child.icon && <child.icon className={cn("h-4 w-4", (isActive(child.href) || location.pathname.startsWith(child.href)) ? "text-primary" : "text-slate-500")} />}
              <span>{child.title}</span>
            </div>
            <ChevronRight
              className={cn(
                "h-3 w-3 transition-transform duration-300 text-slate-600",
                isExpanded && "rotate-90 text-white"
              )}
            />
          </NavLink>

          {isExpanded && (
            <div className="ml-6 mt-1.5 space-y-1.5 border-l border-white/5 pl-4 animate-in slide-in-from-left-2 duration-300">
              {child.nestedChildren!.map((nested) => {
                const deepNested = nested.hasNested ? getDeepNestedItems(nested.title) : [];
                const hasDeepNested = deepNested.length > 0;
                const isNestedExpanded = expandedNestedItems.includes(nested.title);

                if (hasDeepNested) {
                  return (
                    <div key={nested.href}>
                      <button
                        onClick={() => toggleNestedItem(nested.title)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-lg py-1.5 pl-3 pr-2 text-[12px] font-medium transition-all",
                          isActive(nested.href)
                            ? "text-primary bg-primary/10"
                            : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                        )}
                      >
                        <span>{nested.title}</span>
                        <ChevronRight
                          className={cn(
                            "h-3 w-3 transition-transform duration-300",
                            isNestedExpanded && "rotate-90"
                          )}
                        />
                      </button>

                      {isNestedExpanded && (
                        <div className="ml-3 mt-1.5 space-y-1 border-l border-white/5 pl-3 animate-in fade-in duration-300">
                          {deepNested.map((deep) => (
                            <NavLink
                              key={deep.href}
                              to={deep.href}
                              className={cn(
                                "flex items-center rounded-lg py-1.5 pl-3 pr-2 text-[11px] transition-all",
                                isActive(deep.href)
                                  ? "text-white font-bold"
                                  : "text-slate-500 hover:text-slate-300"
                              )}
                            >
                              {deep.title}
                            </NavLink>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <NavLink
                    key={nested.href}
                    to={nested.href}
                    className={cn(
                      "flex items-center rounded-lg py-1.5 pl-3 pr-2 text-[12px] transition-all",
                      isActive(nested.href)
                        ? "text-primary font-bold"
                        : "text-slate-500 hover:text-slate-300"
                    )}
                  >
                    {nested.title}
                  </NavLink>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    return (
      <NavLink
        key={child.href}
        to={child.href}
        className={cn(
          "flex items-center gap-3 rounded-xl py-2 pl-9 pr-3 text-[13px] transition-all duration-200",
          isActive(child.href)
            ? "bg-primary/10 text-white font-medium"
            : "text-slate-400 hover:text-white hover:bg-white/[0.03]"
        )}
      >
        {child.icon && <child.icon className={cn("h-4 w-4", isActive(child.href) ? "text-primary" : "text-slate-500 group-hover:text-slate-300")} />}
        <span className="flex items-center gap-2">
          {child.title}
          {child.title === "Workgroups" && totalWorkgroupUnread > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">
              {totalWorkgroupUnread}
            </span>
          )}
        </span>
      </NavLink>
    );
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-50 h-screen bg-[#0c111d] border-r border-white/5 flex flex-col transition-transform duration-300 ease-in-out",
        isMobile ? (isOpen ? "translate-x-0" : "-translate-x-full") : "translate-x-0"
      )}
      style={{ width: `${width}px` }}
    >
      {/* Brand Header */}
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3 focus-outline-none">
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-white leading-none">Rush CRM</span>
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mt-1.5">Enterprise Suite</span>
            </div>
          </div>
          {isMobile && (
            <Button variant="ghost" size="icon" onClick={onClose} className="text-slate-400">
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>

        <div className="h-px w-full bg-gradient-to-r from-white/[0.08] to-transparent" />
      </div>

      {/* Navigation Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-8 space-y-6">
        <div className="space-y-1">
          {filteredNavigation.map((item) => {
            if (item.children) {
              const isOpenSection = openSections.includes(item.title);
              const sectionActive = isSectionActive(item.children);

              return (
                <div key={item.title} className="mb-2">
                  <button
                    onClick={() => toggleSection(item.title)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider transition-all duration-200",
                      sectionActive
                        ? "text-white"
                        : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.03]"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className={cn("h-4 w-4", sectionActive ? "text-primary" : "text-slate-500")} />
                      <span>{item.title}</span>
                    </div>
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 transition-transform duration-500",
                        isOpenSection && "rotate-180"
                      )}
                    />
                  </button>
                  {isOpenSection && (
                    <div className="mt-1 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-300">
                      {item.children.map((child) => renderSubItem(child, item.title))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <NavLink
                key={item.href}
                to={item.href!}
                onClick={() => isMobile && onClose?.()}
                className={cn(
                  "flex items-center justify-between rounded-xl px-4 py-2.5 text-[13px] font-medium transition-all duration-200",
                  isActive(item.href!)
                    ? "bg-primary/10 text-white"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.03]"
                )}
              >
                <div className="flex items-center gap-3">
                  <item.icon className={cn("h-4 w-4", isActive(item.href!) ? "text-primary" : "text-slate-500")} />
                  <span>{item.title}</span>
                </div>
                {item.badge && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[9px] font-black text-white shadow-lg shadow-primary/20">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* Direct Messages Section */}
        <div className="space-y-4 pt-4 border-t border-white/[0.05]">
          <div className="px-4 flex items-center justify-between group">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 bg-primary rounded-full" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Direct Messages
              </span>
            </div>
            {totalDMUnread > 0 && (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1.5 text-[9px] font-bold text-white">
                {totalDMUnread}
              </span>
            )}
          </div>

          <div className="px-2 space-y-0.5">
            {directMessages.length > 0 ? (
              <>
                {directMessages.map((dm: any) => {
                  const dmPath = `/collaboration/direct-chats?chat=${dm.id}`;
                  const isDMActive = location.pathname === '/collaboration/direct-chats' && location.search.includes(dm.id);
                  const unreadCount = Number(dm.unread_count || 0);
                  const isOnline = Boolean(dm.is_online);
                  const isStarred = Boolean(dm.is_starred);

                  return (
                    <div key={dm.id} className="group/dm relative">
                      <NavLink
                        to={dmPath}
                        className={cn(
                          "flex items-center gap-3 rounded-xl py-2 px-3 text-[13px] transition-all duration-200",
                          isDMActive
                            ? "bg-primary/10 text-white font-medium"
                            : "text-slate-400 hover:text-white hover:bg-white/[0.03]"
                        )}
                      >
                        <div className="relative">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={getAvatarUrl(dm.avatar_url || dm.direct_peer_avatar_url || dm.avatar) || undefined} />
                            <AvatarFallback className={cn(dm.avatar_color, "text-white text-[10px]")}>
                              {(dm.display_name || dm.name || "DM").slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span
                            className={cn(
                              "absolute -right-0.5 -bottom-0.5 h-2 w-2 rounded-full border-2 border-[#0c111d]",
                              isOnline ? "bg-green-500" : "bg-slate-600"
                            )}
                          />
                        </div>
                        <span className="flex-1 truncate">{dm.display_name || dm.name}</span>
                        {unreadCount > 0 && (
                          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-white">
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        )}
                      </NavLink>
                      <button
                        onClick={(e) => toggleStarChat(dm.id, e)}
                        className={cn(
                          "absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded transition-all",
                          isStarred
                            ? "text-yellow-500 opacity-100"
                            : "text-slate-600 opacity-0 group-hover/dm:opacity-100 hover:text-yellow-500"
                        )}
                        title={isStarred ? "Unstar chat" : "Star chat"}
                      >
                        <Star className={cn("h-3.5 w-3.5", isStarred && "fill-yellow-500")} />
                      </button>
                    </div>
                  );
                })}
                <NavLink
                  to="/collaboration/direct-chats"
                  className="flex items-center gap-2 rounded-lg py-2 px-3 mt-1 text-[12px] text-slate-500 hover:text-slate-300 transition-all"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>All conversations</span>
                  <ArrowRight className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-100" />
                </NavLink>
              </>
            ) : (
              <p className="px-3 text-[11px] text-slate-600 italic">No recent chats</p>
            )}
          </div>
        </div>

        {/* Workgroups Section */}
        <div className="space-y-4 pt-4 border-t border-white/[0.05]">
          <div className="px-4 flex items-center justify-between group">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 bg-primary rounded-full" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Workgroups
              </span>
            </div>
            {totalWorkgroupUnread > 0 && (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1.5 text-[9px] font-bold text-white">
                {totalWorkgroupUnread}
              </span>
            )}
          </div>

          <div className="px-2 space-y-0.5">
            {teamWorkgroups.length > 0 ? (
              <>
                {teamWorkgroups.slice(0, 5).map((wg: any) => {
                  const wgPath = `/collaboration/workgroups?team=${wg.id}`;
                  const isWGActive = location.pathname === '/collaboration/workgroups' && location.search.includes(wg.id);
                  const unreadCount = Number(wg.unread_count || 0);

                  return (
                    <NavLink
                      key={wg.id}
                      to={wgPath}
                      className={cn(
                        "flex items-center gap-3 rounded-xl py-2 px-3 text-[13px] transition-all duration-200",
                        isWGActive
                          ? "bg-primary/10 text-white font-medium"
                          : "text-slate-400 hover:text-white hover:bg-white/[0.03]"
                      )}
                    >
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={getAvatarUrl(wg.avatar_url) || undefined} />
                        <AvatarFallback className={cn(wg.avatar_color || 'bg-primary', "text-white text-[10px]")}>
                          {(wg.display_name || wg.name).slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="flex-1 truncate">{wg.display_name || wg.name}</span>
                      {unreadCount > 0 && (
                        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-white">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
                <NavLink
                  to="/collaboration/workgroups"
                  className="flex items-center gap-2 rounded-lg py-2 px-3 mt-1 text-[12px] text-slate-500 hover:text-slate-300 transition-all"
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>All workgroups</span>
                  <ArrowRight className="h-3 w-3 ml-auto" />
                </NavLink>
              </>
            ) : (
              <p className="px-3 text-[11px] text-slate-600 italic">No workgroups</p>
            )}
          </div>
      </div>

      <AlertDialog open={!!deleteChatId} onOpenChange={(open) => !open && setDeleteChatId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this conversation and all its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteChatId) {
                  deleteWg.mutate(deleteChatId, {
                    onSuccess: () => setDeleteChatId(null)
                  });
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteWg.isPending ? "Deleting..." : "Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Resize Handle - Only for desktop */}
      {!isMobile && (
        <div
          onMouseDown={handleMouseDown}
          className={cn(
            "absolute right-0 top-0 w-1 h-full cursor-col-resize transition-all duration-200 group-hover:bg-primary/20",
            isResizing ? "bg-primary w-1.5 opacity-100" : "opacity-0 hover:opacity-100 hover:bg-primary/40"
          )}
        />
      )}
    </aside>
  );
}
