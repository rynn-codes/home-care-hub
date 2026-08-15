import { NavLink, useLocation } from "react-router-dom";
import {
  Home, Compass, ClipboardList, Users, UserCog, UserPlus, CalendarDays,
  Receipt, Wallet, BarChart3, FolderOpen, BookOpen, Settings,
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
 *   - Hiring lives under Operations, never at the top level.
 *   - Clients and Employees are views inside People, not siblings of it. People is
 *     the permanent record; Admissions is only the process that creates it.
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
      { title: "Documents", url: "/documents", icon: FolderOpen },
      { title: "SOPs", url: "/sops", icon: BookOpen },
    ],
  },
  { title: "Admissions", url: "/admissions", icon: ClipboardList },
  {
    title: "People",
    url: "/people",
    icon: Users,
    children: [
      { title: "Clients", url: "/people/clients", icon: Users },
      { title: "Employees", url: "/people/employees", icon: UserCog },
    ],
  },
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
