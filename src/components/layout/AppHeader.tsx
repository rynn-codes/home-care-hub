import { Plus, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

/** The New menu, exactly the approved mock's five actions. */
const newActions = [
  { label: "New Client", to: "/admissions" },
  { label: "New Employee", to: "/operations/hiring" },
  { label: "Schedule Shift", to: "/scheduling" },
  { label: "New Assessment", to: "/admissions" },
  { label: "Incident Report", to: "/operations/incidents" },
];

/**
 * The top bar, to the approved mock's values: a quiet bordered search field
 * with the ⌘K hint, the bell with its small orange dot, a white bordered
 * "New" button, and the avatar circle. The search input is real; wiring it
 * to results is the developer's, like the bell.
 */
export function AppHeader() {
  const { currentUser, setCurrentUser } = useDemo();
  const initials = currentUser.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("");

  return (
    <header className="sticky top-0 z-30 flex items-center justify-end gap-3.5 border-b border-black/[.07] bg-white/[.92] px-4 py-3.5 backdrop-blur-[10px] md:px-8 lg:px-14">
      <SidebarTrigger className="md:hidden" />

      <div className="hidden flex-1 items-center gap-[9px] rounded-[9px] border border-black/[.07] px-3 py-[7px] md:flex md:max-w-[420px]">
        <Search className="h-[13px] w-[13px] flex-none text-muted-foreground/70" aria-hidden="true" />
        <input
          type="search"
          placeholder="Search clients, caregivers, invoices…"
          aria-label="Search clients, caregivers, invoices"
          className="min-w-0 flex-1 border-none bg-transparent text-[12.5px] outline-none placeholder:text-muted-foreground"
        />
        {/* The mock's #CACAD2 hint fails the 4.5:1 bar; the muted token is the
            recorded accessible substitute for the mock's lightest grays. */}
        <span className="ml-auto flex-none text-[11px] text-muted-foreground" aria-hidden="true">⌘K</span>
      </div>

      {/* No notification bell. Karynn, 25 August: "You can take off the
          notifications bell at the top. Don't need." It was a dot that lit up
          and led nowhere — and this product already has a considered answer to
          "what needs me": Joy's four states, on Home and in The Brain. A bell
          beside them would be a second, worse inbox. */}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-8 flex-none items-center gap-[7px] rounded-[9px] border border-black/[.09] bg-white px-3 text-[12.5px] font-medium text-foreground transition-colors hover:bg-[#FAFAFB]"
          >
            <Plus className="h-[13px] w-[13px]" aria-hidden="true" />
            New
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[222px] rounded-[14px] p-1.5">
          {newActions.map((action) => (
            <DropdownMenuItem key={action.label} asChild className="rounded-[9px] px-3 py-2.5 text-[13px]">
              <Link to={action.to}>{action.label}</Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Account: ${currentUser.name}`}
            className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[#F0F0F2] text-[11px] font-semibold text-muted-foreground"
          >
            {initials}
          </button>
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
    </header>
  );
}
