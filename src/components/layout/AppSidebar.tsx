import { NavLink, useLocation } from "react-router-dom";
import {
  Home, Compass, ClipboardList, Users, UserCog, UserPlus, Contact, CalendarDays,
  Receipt, Wallet, BarChart3, FolderOpen, BookOpen, Settings, ShieldAlert, HeartPulse, CalendarCheck, ClipboardCheck,
} from "lucide-react";
import logo from "@/assets/logo.png";
import { Sidebar, SidebarContent, SidebarHeader, SidebarFooter, useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useDemo } from "@/context/DemoDataProvider";
import { seedApplicants } from "@/lib/hiringSeed";
import { seedClients } from "@/lib/clientsSeed";
import { seedEmployees } from "@/lib/employeesSeed";

interface NavChild {
  title: string;
  url: string;
  icon: typeof Home;
  count?: number;
}

interface NavItem {
  title: string;
  url: string;
  icon: typeof Home;
  count?: number;
  children?: NavChild[];
}

/**
 * The Joy navigation, fixed by section 6 of the Codex Engineering Kickoff,
 * restyled to the approved mock: white, 13px rows, the active row on a quiet
 * grey with an indigo icon, and live counts on the right edge.
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
 * "Talk to Joy" is persistent AI access and is deliberately not a nav item —
 * it lives on the Ask Joy pill.
 */
function useNav(): NavItem[] {
  // The same seeds the module screens count, never a second store — a sidebar
  // saying 21 clients over a directory showing 8 is Joy contradicting itself.
  const { people } = useDemo();
  const admitted = people.filter(
    (p) =>
      p.clientStatus === "active" &&
      !seedClients.some((c) => c.personId === p.personId),
  ).length;
  const clientCount = seedClients.filter((c) => c.status === "active").length + admitted;
  const employeeCount = seedEmployees.filter((e) => e.status === "active").length;
  const hiringCount = seedApplicants.filter((a) => a.track !== "no_fit" && a.track !== "hired").length;

  return [
    { title: "Home", url: "/", icon: Home },
    {
      title: "Operations",
      url: "/operations",
      icon: Compass,
      children: [
        { title: "Hiring", url: "/operations/hiring", icon: UserPlus, count: hiringCount },
        { title: "Incidents", url: "/operations/incidents", icon: ShieldAlert },
        { title: "Audit", url: "/operations/audit", icon: ClipboardCheck },
        { title: "Documents", url: "/documents", icon: FolderOpen },
        { title: "SOPs", url: "/sops", icon: BookOpen },
      ],
    },
    { title: "Admissions", url: "/admissions", icon: ClipboardList },
    {
      title: "Clients",
      url: "/clients",
      icon: Users,
      count: clientCount,
      children: [
        { title: "Care plans", url: "/clients/care-plans", icon: HeartPulse },
        { title: "Supervision", url: "/clients/supervision", icon: CalendarCheck },
      ],
    },
    { title: "Employees", url: "/employees", icon: UserCog, count: employeeCount },
    { title: "People", url: "/people", icon: Contact },
    { title: "Scheduling", url: "/scheduling", icon: CalendarDays },
    { title: "Billing", url: "/billing", icon: Receipt },
    { title: "Payroll", url: "/payroll", icon: Wallet },
    { title: "Reports", url: "/reports", icon: BarChart3 },
    { title: "Settings", url: "/settings", icon: Settings },
  ];
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { currentUser } = useDemo();
  const nav = useNav();

  const isActive = (url: string) =>
    url === "/" ? pathname === "/" : pathname === url || pathname.startsWith(`${url}/`);

  const isSectionOpen = (item: NavItem) =>
    isActive(item.url) || (item.children ?? []).some((child) => isActive(child.url));

  const rowClass = (active: boolean) =>
    cn(
      "flex items-center gap-[11px] rounded-lg px-2.5 py-2 text-[13px] transition-colors",
      active
        ? "bg-[#F1F2F6] font-medium text-foreground"
        : "font-normal text-[#6E6E76] hover:bg-[#FAFAFB] hover:text-foreground",
    );

  const initials = currentUser.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("");

  return (
    <Sidebar collapsible="icon" className="border-r border-black/[.07]">
      <SidebarHeader className="border-none">
        <div className={cn("flex items-center gap-2.5 px-2.5 pb-3 pt-2", collapsed && "justify-center px-0")}>
          <img src={logo} alt="" className="h-[22px] w-[22px] flex-none rounded-full object-contain" />
          {!collapsed && <span className="text-[13.5px] font-medium tracking-[-.01em]">Joy Health</span>}
        </div>
      </SidebarHeader>

      <SidebarContent>
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
                      {item.count != null && (
                        <span className="ml-auto text-[11.5px] font-normal text-muted-foreground">{item.count}</span>
                      )}
                    </>
                  )}
                </NavLink>

                {item.children && !collapsed && isSectionOpen(item) && (
                  <div className="mb-1 ml-[13px] flex flex-col gap-0.5 border-l border-black/[.06] pl-2">
                    {item.children.map((child) => {
                      const childActive = isActive(child.url);
                      return (
                        <NavLink key={child.title} to={child.url} className={rowClass(childActive)}>
                          <child.icon
                            className={cn("h-3.5 w-3.5 flex-none", childActive ? "text-primary" : "text-[#8A8A92]")}
                            strokeWidth={1.5}
                            aria-hidden="true"
                          />
                          <span className="flex-1 truncate text-[12.5px]">{child.title}</span>
                          {child.count != null && (
                            <span className="ml-auto text-[11.5px] font-normal text-muted-foreground">{child.count}</span>
                          )}
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
          {!collapsed && <span className="truncate text-[12.5px] text-[#6E6E76]">{currentUser.name}</span>}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
