import { useState, useMemo } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkgroups } from "@/hooks/useWorkgroups";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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
      { title: "Integrations", href: "/automation/integrations", icon: Package },
      { title: "Webhooks", href: "/automation/webhooks", icon: Zap },
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

export function AppSidebar() {
  const location = useLocation();
  const { userRole } = useAuth();
  const { data: workgroups = [] } = useWorkgroups();
  const [openSections, setOpenSections] = useState<string[]>(["Collaboration", "CRM"]);
  const [expandedSubItems, setExpandedSubItems] = useState<string[]>([]);
  const [expandedNestedItems, setExpandedNestedItems] = useState<string[]>([]);

  const isAdmin = userRole?.role === 'super_admin' || userRole?.role === 'admin';

  const filteredNavigation = useMemo(() => {
    return navigation.filter(item => {
      if (item.title === "Admin Portal" && !isAdmin) return false;
      return true;
    });
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

  const renderSubItem = (child: NavSubItem) => {
    const hasNestedChildren = child.nestedChildren && child.nestedChildren.length > 0;
    const isExpanded = expandedSubItems.includes(child.title);

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
    <aside className="fixed left-0 top-0 z-50 h-screen w-64 bg-[#0c111d] border-r border-white/5 flex flex-col">
      {/* Brand Header */}
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6 focus-outline-none">

          <div className="flex flex-col">
            <span className="text-base font-bold tracking-tight text-white leading-none">Rush Management System</span>
            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mt-1.5">Enterprise Suite</span>
          </div>
        </div>

        <div className="h-px w-full bg-gradient-to-r from-white/[0.08] to-transparent" />
      </div>

      {/* Navigation Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-8 space-y-6">
        <div className="space-y-1">
          {filteredNavigation.map((item) => {
            if (item.children) {
              const isOpen = openSections.includes(item.title);
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
                        isOpen && "rotate-180"
                      )}
                    />
                  </button>
                  {isOpen && (
                    <div className="mt-1 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-300">
                      {item.children.map((child) => renderSubItem(child))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <NavLink
                key={item.href}
                to={item.href!}
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
      </div>
    </aside>
  );
}
