import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, UserCog, CalendarDays, Receipt, BarChart3,
  FolderOpen, Target, BookOpen, Settings, Heart,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const groups: { label: string; items: { title: string; url: string; icon: any }[] }[] = [
  { label: "Overview", items: [{ title: "Dashboard", url: "/", icon: LayoutDashboard }] },
  {
    label: "Operations",
    items: [
      { title: "Clients", url: "/clients", icon: Users },
      { title: "Employees", url: "/employees", icon: UserCog },
      { title: "Scheduling", url: "/scheduling", icon: CalendarDays },
      { title: "Billing", url: "/billing", icon: Receipt },
    ],
  },
  { label: "Insights", items: [{ title: "Reports", url: "/reports", icon: BarChart3 }] },
  {
    label: "Company",
    items: [
      { title: "Documents", url: "/documents", icon: FolderOpen },
      { title: "Goal Tracker", url: "/goals", icon: Target },
    ],
  },
  { label: "Knowledge", items: [{ title: "SOPs", url: "/sops", icon: BookOpen }] },
  { label: "Account", items: [{ title: "Settings", url: "/settings", icon: Settings }] },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const isActive = (url: string) => url === "/" ? pathname === "/" : pathname.startsWith(url);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
            <Heart className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-none">
              <span className="font-display font-bold text-base">CareHub</span>
              <span className="text-xs text-muted-foreground">Home Care OS</span>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((g) => (
          <SidebarGroup key={g.label}>
            {!collapsed && <SidebarGroupLabel>{g.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <NavLink to={item.url} end={item.url === "/"} className={cn("flex items-center gap-2")}>
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
