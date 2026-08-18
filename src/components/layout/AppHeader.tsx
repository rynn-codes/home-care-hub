import { Bell, Plus, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useDemo } from "@/context/DemoDataProvider";
import { ROLE_LABELS } from "@/domain/consents/witness";
import type { DemoUser } from "@/lib/demoStore";

/**
 * Joy Health's real team, for the prototype's "view as" switch.
 *
 * Staff names are real; every client in the seed is fictional. The switch is
 * here so the permission rules can be seen rather than taken on trust — only an
 * RN or the Admin/Owner may take a client's signature on the consents packet.
 */
const DEMO_USERS: DemoUser[] = [
  { name: "Karynn Verrett", role: "ceo_admin" },
  { name: "Kelsey Westley", role: "rn_clinical" },
  { name: "John Segura", role: "intake_coordinator" },
];

/** The six Quick Add actions specified in the Dashboard Revision Request. */
const quickAddActions = [
  { label: "New Client", to: "/admissions" },
  { label: "New Employee", to: "/operations/hiring" },
  { label: "Schedule Assessment", to: "/admissions" },
  { label: "Create Shift", to: "/scheduling" },
  { label: "Run Payroll", to: "/payroll" },
  { label: "Billing Review", to: "/billing" },
];

export function AppHeader() {
  const { currentUser, setCurrentUser } = useDemo();
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-surface/80 backdrop-blur px-4">
      <SidebarTrigger />
      <div className="relative hidden md:block flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search clients, caregivers, shifts…" className="pl-9 bg-surface-muted border-transparent focus-visible:bg-surface" />
      </div>
      <div className="ml-auto flex items-center gap-2">
        {/* Quick Add belongs in the top bar so it is reachable from every screen. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Quick Add</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {quickAddActions.map((action) => (
              <DropdownMenuItem key={action.label} asChild>
                <Link to={action.to}>{action.label}</Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          <Badge className="absolute -top-1 -right-1 h-4 min-w-4 p-0 px-1 text-[10px]" variant="destructive">3</Badge>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 px-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-primary-soft text-primary text-xs font-semibold">
                  {currentUser.name
                    .split(" ")
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium sm:inline">{currentUser.name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="font-normal">
              <span className="block text-sm font-medium">{currentUser.name}</span>
              <span className="block text-xs text-muted-foreground">{ROLE_LABELS[currentUser.role]}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {/* Prototype only. Roles come from users.role once the migrations
                are applied; this exists so the permission rules can actually be
                seen — signing the consents packet needs an RN or the owner. */}
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              View the app as
            </DropdownMenuLabel>
            {DEMO_USERS.map((u) => (
              <DropdownMenuItem
                key={u.name}
                onSelect={() => setCurrentUser(u)}
                className={cn(u.name === currentUser.name && "font-medium")}
              >
                <span className="flex-1">{u.name}</span>
                <span className="text-xs text-muted-foreground">{ROLE_LABELS[u.role]}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
