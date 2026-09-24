import { Eye, Plus, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useDemo } from "@/context/DemoDataProvider";
import { canWrite, readOnlyReason } from "@/domain/access/roles";
import { ROLE_LABELS } from "@/domain/consents/witness";
import type { DemoUser } from "@/lib/demoStore";

/**
 * Joy Health's real team, for the prototype's "view as" switch — plus the
 * State Surveyor, so the read-only session can be seen rather than taken on
 * trust.
 */
const DEMO_USERS: DemoUser[] = [
  { name: "Karynn Verrett", role: "ceo_admin" },
  { name: "Kelsey Westley", role: "rn_clinical" },
  { name: "John Segura", role: "intake_coordinator" },
  { name: "State Surveyor", role: "auditor" },
];

/**
 * The New menu. Each action lands on its screen with the right panel open —
 * the screen reads `state.open` through use-open-request. Karynn, 29
 * September: "New button at the top right, doesn't work on every page."
 */
const NEW_ACTIONS = [
  { label: "New Client", to: "/admissions", state: { open: "referral" } },
  { label: "New Employee", to: "/hiring", state: { open: "invite" } },
  { label: "Schedule Shift", to: "/scheduling", state: { open: "shift" } },
  { label: "New Assessment", to: "/admissions", state: { open: "assessment" } },
  { label: "Add Task", to: "/brain", state: { open: "task" } },
];

/**
 * The top bar: a quiet bordered search field with the ⌘K hint, a white
 * bordered "New" button, the read-only pill for a survey session, and the
 * avatar circle.
 *
 * No notification bell. Karynn, 25 August: "You can take off the
 * notifications bell at the top. Don't need." Joy's four states, on Home and
 * in The Brain, are the considered answer to "what needs me".
 */
export function AppHeader() {
  const { currentUser, setCurrentUser } = useDemo();
  const initials = currentUser.name.split(" ").slice(0, 2).map((w) => w[0]).join("");
  const readOnly = readOnlyReason(currentUser.role);

  return (
    <header className="sticky top-0 z-30 flex h-[var(--shell-band)] items-center justify-end gap-3.5 border-b border-black/[.06] bg-background/[.92] px-4 backdrop-blur-[10px] md:px-8 lg:px-14">
      <SidebarTrigger className="md:hidden" />

      <div className="hidden flex-1 items-center gap-[9px] rounded-[9px] border border-black/[.07] px-3 py-[7px] md:flex md:max-w-[420px]">
        <Search className="h-[13px] w-[13px] flex-none text-muted-foreground/70" aria-hidden="true" />
        <input
          type="search"
          placeholder="Search clients, caregivers, invoices…"
          aria-label="Search clients, caregivers, invoices"
          className="min-w-0 flex-1 border-none bg-transparent text-[12.5px] outline-none placeholder:text-muted-foreground"
        />
        <span className="ml-auto flex-none text-[11px] text-muted-foreground" aria-hidden="true">⌘K</span>
      </div>

      {canWrite(currentUser.role) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-8 flex-none items-center gap-[7px] rounded-[9px] border border-black/[.09] bg-[var(--paper)] px-3 text-[12.5px] font-medium text-foreground transition-colors hover:bg-[var(--wash)]"
            >
              <Plus className="h-[13px] w-[13px]" aria-hidden="true" />
              New
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[222px] rounded-[14px] p-1.5">
            {NEW_ACTIONS.map((action) => (
              <DropdownMenuItem key={action.label} asChild className="rounded-[9px] px-3 py-2.5 text-[13px]">
                <Link to={action.to} state={action.state}>
                  {action.label}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {readOnly && (
        <span
          title={readOnly}
          className="hidden items-center gap-1.5 rounded-full bg-[#FFF7E6] px-2.5 py-1 text-[11.5px] font-medium text-[#93540A] sm:flex"
        >
          <Eye className="h-3 w-3" aria-hidden="true" />
          Read-only survey session
        </span>
      )}

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
              are applied; this exists so the permission rules can be seen. */}
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">View the app as</DropdownMenuLabel>
          {DEMO_USERS.map((u) => (
            <DropdownMenuItem key={u.name} onSelect={() => setCurrentUser(u)} className={cn(u.name === currentUser.name && "font-medium")}>
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
