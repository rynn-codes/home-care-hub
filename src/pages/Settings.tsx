import { Monitor, Moon, Sun } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { AgencySettingsPanel } from "@/components/settings/AgencySettingsPanel";
import { DeletedItems } from "@/components/settings/DeletedItems";
import { MicrophoneCheck } from "@/components/settings/MicrophoneCheck";
import { cn } from "@/lib/utils";
import { useDemo } from "@/context/DemoDataProvider";
import { ROLE_LABELS } from "@/domain/consents/witness";
import { setPreference, usePreferences, type Appearance } from "@/lib/preferences";
import logo from "@/assets/logo.png";

/**
 * Settings — Joy's own identity and wiring, stated honestly.
 *
 * Appearance and navigation are this device's; Agency is the agency's;
 * Deleted items is the bin. Roles read from the database and never edit it;
 * Notifications and Integrations say what is not connected rather than
 * offering a switch for a message that cannot be sent.
 */

/** The brief's integration table — each system and what it owns. */
const INTEGRATIONS = [
  { name: "GoHighLevel", owns: "Recruiting, marketing, automations" },
  { name: "Gusto", owns: "HR onboarding, payroll" },
  { name: "Spruce", owns: "Messaging — clients, families, caregivers" },
  { name: "Stripe", owns: "Card and ACH payments (plumbing ready)" },
];

const NOTIFICATIONS = [
  "Open shift reminders",
  "Missed clock-in alerts",
  "Credential expiry warnings",
  "Payment and dunning notices",
];

const APPEARANCES: Array<{ value: Appearance; label: string; hint: string; icon: typeof Sun }> = [
  { value: "light", label: "Light", hint: "The white screen, always", icon: Sun },
  { value: "dark", label: "Dark", hint: "The dark screen, always", icon: Moon },
  { value: "system", label: "Auto", hint: "Follow this device", icon: Monitor },
];

/** Stamped at build time by vite.config's `define` (declared in vite-env.d.ts). */
const BUILD_STAMP: string = typeof __BUILD_STAMP__ === "string" ? __BUILD_STAMP__ : "dev";

const CARD = "rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] p-6";
const PILL = "whitespace-nowrap rounded-full bg-[var(--hairline-soft)] px-2.5 py-1 text-[11.5px] font-medium text-[var(--ink-body)]";

export default function Settings() {
  const prefs = usePreferences();
  const { deletedRecords } = useDemo();

  return (
    <>
      <PageHeader title="Settings" description="Joy's identity, roles, and the systems it talks to." />
      <Tabs defaultValue="appearance">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="org">Agency</TabsTrigger>
          <TabsTrigger value="brand">Branding</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="notify">Notifications</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="deleted">
            Deleted items
            {deletedRecords.length > 0 && (
              <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--hairline-soft)] px-1.5 text-[10.5px] font-medium tabular-nums text-[var(--ink-body)]">
                {deletedRecords.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="appearance" className="mt-4">
          <div className="max-w-2xl space-y-6">
            <div className={cn(CARD, "space-y-4")}>
              <div className="flex flex-col gap-1">
                <h2 className="m-0 text-[15px] font-semibold tracking-[-.01em]">Screen</h2>
                <p className="m-0 text-[13px] text-muted-foreground">Auto follows whatever this computer or phone is set to, and changes with it.</p>
              </div>
              <div role="radiogroup" aria-label="Screen" className="grid gap-2.5 sm:grid-cols-3">
                {APPEARANCES.map(({ value, label, hint, icon: Icon }) => {
                  const on = prefs.appearance === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setPreference("appearance", value)}
                      className={cn(
                        "flex flex-col gap-1.5 rounded-[12px] border p-4 text-left transition-colors",
                        on ? "border-[#1407A2]/30 bg-[#EEF0FE]" : "border-[var(--hairline)] bg-[var(--paper)] hover:bg-[var(--wash)]",
                      )}
                    >
                      <Icon className={cn("h-4 w-4", on ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
                      <span className={cn("text-[13.5px] font-medium", on && "text-primary")}>{label}</span>
                      <span className="text-[12px] leading-[1.45] text-muted-foreground">{hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className={cn(CARD, "space-y-4")}>
              <div className="flex flex-col gap-1">
                <h2 className="m-0 text-[15px] font-semibold tracking-[-.01em]">Navigation</h2>
                <p className="m-0 text-[13px] text-muted-foreground">What takes a row in the side menu.</p>
              </div>
              <div className="flex items-start justify-between gap-6 rounded-[12px] border border-[var(--hairline)] px-4 py-3.5">
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="text-[13.5px] font-medium">My Work in the side menu</span>
                  <span className="text-[12.5px] leading-[1.5] text-muted-foreground">
                    My Work sits under The Brain, above Documents. Turn this off and the row goes; the tab, the page and every
                    link to it stay exactly where they are.
                  </span>
                </span>
                <Switch
                  checked={prefs.showMyWork}
                  onCheckedChange={(on) => setPreference("showMyWork", on)}
                  aria-label="Show My Work in the side menu"
                  className="mt-0.5 flex-none"
                />
              </div>
            </div>
            <MicrophoneCheck />
          </div>
        </TabsContent>

        <TabsContent value="org" className="mt-4">
          <AgencySettingsPanel />
        </TabsContent>

        <TabsContent value="brand" className="mt-4">
          <div className={cn(CARD, "max-w-2xl space-y-4")}>
            <div className="flex items-center gap-3">
              <img src={logo} alt="Joy Health logo" className="h-10 w-10 rounded-full object-contain" />
              <div>
                <p className="m-0 text-sm font-medium">Joy Health</p>
                <p className="m-0 text-xs text-muted-foreground">The logo the app and portals use.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 border-t border-[var(--hairline-soft)] pt-4">
              <span className="h-10 w-10 rounded-[10px] bg-primary" aria-hidden="true" />
              <div>
                <p className="m-0 text-sm font-medium">#1407A2 — Joy Royal Blue</p>
                <p className="m-0 text-xs text-muted-foreground">
                  The design brief's brand primary. Fixed in the design tokens, not editable per user — one brand, everywhere.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="roles" className="mt-4">
          <div className={cn(CARD, "max-w-2xl")}>
            {Object.entries(ROLE_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between gap-4 border-b border-[var(--hairline-soft)] py-3 last:border-0">
                <div>
                  <p className="m-0 text-sm font-medium">{label}</p>
                  <p className="m-0 text-[12.5px] text-muted-foreground">
                    {key === "ceo_admin"
                      ? "Everything, including approvals with money on both sides."
                      : key === "rn_clinical"
                        ? "Assessments, care plans, supervisory visits — and one of two roles that can take a client's signature."
                        : "Referrals, intake and scheduling. No clinical sign-off, no rates."}
                  </p>
                </div>
                <span className={PILL}>From the database</span>
              </div>
            ))}
            <p className="mb-0 mt-3 text-xs text-muted-foreground">
              The grants themselves live in the migrations (row-level security, tested per role) — this screen reads them, it
              never edits them. The header's "view as" switch shows each role's world in the prototype.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="notify" className="mt-4">
          <div className={cn(CARD, "max-w-2xl")}>
            {NOTIFICATIONS.map((n) => (
              <div key={n} className="flex items-center justify-between gap-4 border-b border-[var(--hairline-soft)] py-3 last:border-0">
                <p className="m-0 text-sm">{n}</p>
                <span className={PILL}>Arrives with Spruce</span>
              </div>
            ))}
            <p className="mb-0 mt-3 text-xs text-muted-foreground">
              No toggles yet on purpose: nothing sends today, and a switch that saves a preference for a message that cannot
              be sent would be the screen lying about what Joy does.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="integrations" className="mt-4">
          <div className={cn(CARD, "max-w-2xl")}>
            {INTEGRATIONS.map((i) => (
              <div key={i.name} className="flex items-center justify-between gap-4 border-b border-[var(--hairline-soft)] py-3 last:border-0">
                <div>
                  <p className="m-0 text-sm font-medium">{i.name}</p>
                  <p className="m-0 text-[12.5px] text-muted-foreground">{i.owns}</p>
                </div>
                <span className={PILL}>Not connected</span>
              </div>
            ))}
            <p className="mb-0 mt-3 text-xs text-muted-foreground">
              The division of labour is the design brief's: each system keeps what it owns, and Joy never rebuilds it.
              Connecting them is the developer's work at handoff.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="deleted" className="mt-4">
          <DeletedItems />
        </TabsContent>
      </Tabs>

      <p className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">
        Prototype build <span className="font-medium tabular-nums text-foreground">{BUILD_STAMP}</span>. If this is older than
        you expect, the page is cached — reload with Cmd/Ctrl + Shift + R.
      </p>
    </>
  );
}
