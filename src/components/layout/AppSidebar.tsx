import { NavLink, useLocation } from "react-router-dom";
import {
  BarChart3, BookOpen, Brain, CalendarCheck, CalendarDays, ClipboardCheck, ClipboardList, Contact, FolderOpen,
  Home, PenLine, Receipt, Settings, ShieldAlert, UserCog, UserPlus, Users, Wallet,
} from "lucide-react";
import logo from "@/assets/logo.png";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useDemo } from "@/context/DemoDataProvider";
import { canView, grantsFor, type Area } from "@/domain/access/roles";
import type { UserRole } from "@/domain/consents/witness";
import { usePreferences } from "@/lib/preferences";
import { seedApplicants } from "@/lib/hiringSeed";
import { seedClients } from "@/lib/clientsSeed";
import { seedEmployees } from "@/lib/employeesSeed";

interface NavChild {
  title: string;
  url: string;
  icon: typeof Home;
  area: Area;
  count?: number;
}

interface NavItem extends NavChild {
  children?: NavChild[];
}

/**
 * The Joy navigation.
 *
 * Home first, then The Brain with Documents and SOPs under it (and My Work,
 * when this device has asked for the row). The working screens follow in
 * the order of a day — Scheduling, Billing, Payroll — then the directories,
 * then Admissions and Hiring, then Reports, then Settings.
 *
 * Clients, Employees and People are three siblings, not a parent and two
 * children: Karynn ruled for the mockup on 18 Aug. People is the general
 * contact list; clients and employees are their own destinations.
 *
 * Every row names its area so the auditor's allowlist can filter the menu —
 * the first of the three doors in domain/access/roles.
 */
function useNav(): NavItem[] {
  // The same seeds the module screens count, never a second store — a sidebar
  // saying 21 clients over a directory showing 8 is Joy contradicting itself.
  const { people } = useDemo();
  const { showMyWork } = usePreferences();
  const admitted = people.filter(
    (p) => p.clientStatus === "active" && !seedClients.some((c) => c.personId === p.personId),
  ).length;
  const clientCount = seedClients.filter((c) => c.status === "active").length + admitted;
  const employeeCount = seedEmployees.filter((e) => e.status === "active").length;
  const hiringCount = seedApplicants.filter((a) => a.track !== "no_fit" && a.track !== "hired").length;

  return [
    { title: "Home", url: "/", icon: Home, area: "home" },
    {
      title: "The Brain",
      url: "/brain",
      icon: Brain,
      area: "brain",
      children: [
        ...(showMyWork ? [{ title: "My Work", url: "/brain/my-work", icon: ClipboardCheck, area: "my_work" as Area }] : []),
        { title: "Documents", url: "/documents", icon: FolderOpen, area: "documents" },
        { title: "Signing", url: "/documents/signing", icon: PenLine, area: "documents" },
        { title: "SOPs", url: "/sops", icon: BookOpen, area: "sops" },
      ],
    },
    { title: "Scheduling", url: "/scheduling", icon: CalendarDays, area: "scheduling" },
    { title: "Billing", url: "/billing", icon: Receipt, area: "billing" },
    { title: "Payroll", url: "/payroll", icon: Wallet, area: "payroll" },
    { title: "Clients", url: "/clients", icon: Users, area: "clients", count: clientCount },
    { title: "Employees", url: "/employees", icon: UserCog, area: "employees", count: employeeCount },
    { title: "People", url: "/people", icon: Contact, area: "people" },
    { title: "Admissions", url: "/admissions", icon: ClipboardList, area: "admissions" },
    { title: "Hiring", url: "/hiring", icon: UserPlus, area: "hiring", count: hiringCount },
    {
      title: "Reports",
      url: "/reports",
      icon: BarChart3,
      area: "reports",
      children: [
        { title: "Supervision", url: "/reports/supervision", icon: CalendarCheck, area: "reports" },
        { title: "Incidents", url: "/reports/incidents", icon: ShieldAlert, area: "incidents" },
        { title: "Audit", url: "/reports/audit", icon: ClipboardCheck, area: "audit" },
      ],
    },
    { title: "Settings", url: "/settings", icon: Settings, area: "settings" },
  ];
}

/**
 * The rows this role may see. A child whose parent is hidden is promoted to
 * a top-level row — a surveyor sees Incidents and Audit, not a Reports
 * heading with two things under it. The auditor's rows follow the order of
 * their allowlist.
 */
function visibleNav(items: NavItem[], role: UserRole): NavItem[] {
  const out: NavItem[] = [];
  for (const item of items) {
    const children = (item.children ?? []).filter((c) => canView(role, c.area));
    if (canView(role, item.area)) {
      out.push(item.children ? { ...item, children } : item);
      continue;
    }
    for (const c of children) out.push({ title: c.title, url: c.url, icon: c.icon, area: c.area });
  }
  const grant = grantsFor(role);
  if (grant === "all") return out;
  return [...out].sort((a, b) => grant.indexOf(a.area) - grant.indexOf(b.area));
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { currentUser } = useDemo();
  const nav = visibleNav(useNav(), currentUser.role);

  const isActive = (url: string) => (url === "/" ? pathname === "/" : pathname === url || pathname.startsWith(`${url}/`));
  const isSectionOpen = (item: NavItem) => isActive(item.url) || (item.children ?? []).some((c) => isActive(c.url));

  const rowClass = (active: boolean) =>
    cn(
      "flex items-center gap-[11px] rounded-lg px-2.5 py-2 text-[13px] transition-colors",
      active
        ? "bg-[var(--wash-strong)] font-medium text-foreground"
        : "font-normal text-[var(--ink-muted)] hover:bg-[var(--wash)] hover:text-foreground",
    );

  const initials = currentUser.name.split(" ").slice(0, 2).map((w) => w[0]).join("");

  return (
    <Sidebar collapsible="icon" className="border-r border-black/[.07]">
      <SidebarHeader className="h-[var(--shell-band)] border-none p-0">
        <div className={cn("mx-2 flex h-full items-center gap-2.5 border-b border-black/[.06] px-2.5", collapsed && "justify-center border-none px-0")}>
          <img src={logo} alt="" className="h-[22px] w-[22px] flex-none rounded-full object-contain" />
          {!collapsed && <span className="text-[13.5px] font-medium tracking-[-.01em]">Joy Health</span>}
        </div>
      </SidebarHeader>

      <SidebarContent className="pt-3.5">
        <nav className={cn("flex flex-col gap-0.5 px-2", collapsed && "items-center px-1")} aria-label="Main">
          {nav.map((item) => {
            const active = isActive(item.url);
            return (
              <div key={item.title} className="flex flex-col gap-0.5">
                <NavLink to={item.url} end={item.url === "/"} className={rowClass(active)} title={item.title}>
                  <item.icon
                    className={cn("h-[15px] w-[15px] flex-none", active ? "text-primary" : "text-[#8A8A92]")}
                    strokeWidth={active ? 1.6 : 1.5}
                    aria-hidden="true"
                  />
                  {!collapsed && (
                    <>
                      <span className="flex-1 truncate">{item.title}</span>
                      {item.count != null && <span className="ml-auto text-[11.5px] font-normal text-muted-foreground">{item.count}</span>}
                    </>
                  )}
                </NavLink>

                {item.children && !collapsed && isSectionOpen(item) && (
                  <div className="mb-1 ml-[13px] flex flex-col gap-0.5 border-l border-black/[.06] pl-2">
                    {item.children.map((child) => {
                      const childActive = isActive(child.url);
                      return (
                        <NavLink key={child.title} to={child.url} className={rowClass(childActive)}>
                          <child.icon className={cn("h-3.5 w-3.5 flex-none", childActive ? "text-primary" : "text-[#8A8A92]")} strokeWidth={1.5} aria-hidden="true" />
                          <span className="flex-1 truncate text-[12.5px]">{child.title}</span>
                          {child.count != null && <span className="ml-auto text-[11.5px] font-normal text-muted-foreground">{child.count}</span>}
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </SidebarContent>

      <SidebarFooter className="border-none">
        <div className={cn("flex items-center gap-2.5 px-3 py-2.5", collapsed && "justify-center px-0")}>
          <span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full bg-[#F0F0F2] text-[10px] font-semibold text-muted-foreground">
            {initials}
          </span>
          {!collapsed && <span className="truncate text-[12.5px] text-[var(--ink-muted)]">{currentUser.name}</span>}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
