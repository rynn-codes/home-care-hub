import { NavLink, useLocation } from "react-router-dom";
import {
  Home, Compass, ClipboardList, Users, UserCog, UserPlus, Contact, CalendarDays,
  Receipt, Wallet, BarChart3, FolderOpen, BookOpen, Settings, ShieldAlert, HeartPulse,
} from "lucide-react";
import logo from "@/assets/logo.png";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

interface NavChild {
  title: string;
  url: string;
  icon: typeof Home;
}

interface NavItem {
  title: string;
  url: string;
  icon: typeof Home;
  children?: NavChild[];
}

/**
 * The Joy navigation, fixed by section 6 of the Codex Engineering Kickoff.
 *
 * Two rules this encodes, both easy to lose:
 *   - Hiring lives under Operations, never at the top level (§6).
 *   - Clients, Employees and People are three siblings, not a parent and two
 *     children. §6 and §10 file clients under People; the approved Clients
 *     mockup does not, and Karynn ruled for the mockup on 18 Aug: People is the
 *     general contact list — business contacts, partners, referral sources,
 *     anyone the agency needs to follow up with — while clients and employees
 *     are their own destinations. The people table underneath is unchanged;
 *     this is only where a record is shown.
 *
 * "Talk to Joy" is persistent AI access and is deliberately not a nav item.
 */
const nav: NavItem[] = [
  { title: "Home", url: "/", icon: Home },
  {
    title: "Operations",
    url: "/operations",
    icon: Compass,
    children: [
      { title: "Hiring", url: "/operations/hiring", icon: UserPlus },
      { title: "Incidents", url: "/operations/incidents", icon: ShieldAlert },
      { title: "Documents", url: "/documents", icon: FolderOpen },
      { title: "SOPs", url: "/sops", icon: BookOpen },
    ],
  },
  { title: "Admissions", url: "/admissions", icon: ClipboardList },
  {
    title: "Clients",
    url: "/clients",
    icon: Users,
    children: [{ title: "Care plans", url: "/clients/care-plans", icon: HeartPulse }],
  },
  { title: "Employees", url: "/employees", icon: UserCog },
  { title: "People", url: "/people", icon: Contact },
  { title: "Scheduling", url: "/scheduling", icon: CalendarDays },
  { title: "Billing", url: "/billing", icon: Receipt },
  { title: "Payroll", url: "/payroll", icon: Wallet },
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();

  const isActive = (url: string) =>
    url === "/" ? pathname === "/" : pathname === url || pathname.startsWith(`${url}/`);

  const isSectionOpen = (item: NavItem) =>
    isActive(item.url) || (item.children ?? []).some((child) => isActive(child.url));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center justify-center px-2 py-3">
          <img
            src={logo}
            alt="Joy Health"
            className={cn("object-contain transition-all", collapsed ? "h-8 w-8" : "h-16 w-auto")}
          />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <NavLink to={item.url} end={item.url === "/"} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>

                  {item.children && !collapsed && isSectionOpen(item) && (
                    <SidebarMenuSub>
                      {item.children.map((child) => (
                        <SidebarMenuSubItem key={child.title}>
                          <SidebarMenuSubButton asChild isActive={isActive(child.url)}>
                            <NavLink to={child.url} className="flex items-center gap-2">
                              <child.icon className="h-3.5 w-3.5 shrink-0" />
                              <span>{child.title}</span>
                            </NavLink>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
