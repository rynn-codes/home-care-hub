import { Check } from "lucide-react";
import { useDemo } from "@/context/DemoDataProvider";
import { ROLE_LABELS, USER_ROLES, type UserRole } from "@/domain/consents/witness";
import { ALL_AREAS, AREA_LABELS, FINANCE_AREAS, canDoClinical, canView, canWrite, type Area } from "@/domain/access/roles";
import { setAgencyField, useAgencySettings } from "@/lib/agencyStore";
import { cn } from "@/lib/utils";

/**
 * Settings → Roles: who may open what.
 *
 * One row per role, one column per screen. Most of it is read-only on
 * purpose — the roles are what Karynn named them and the owner can never be
 * narrowed. The one thing that is adjustable is how far Operations is let
 * into the money: each finance area has a tick the owner can set, and the
 * sidebar, the router and the tab strips all read it. Caregivers and client
 * contacts live in the portal, not here.
 */
const DASHBOARD_ROLES: readonly UserRole[] = USER_ROLES.filter((r) => r !== "employee" && r !== "client_contact");

const BLURB: Record<UserRole, string> = {
  ceo_admin: "Everything, including approvals with money on both sides. Cannot be narrowed.",
  rn_clinical: "Everything but the money. Assessments, plans of care, supervisory visits, and one of two roles that can witness a client's signature.",
  operations: "Everything but the money and the RN's duties: referrals, intake, scheduling, hiring, documents. The money, one area at a time, is the owner's to grant below.",
  finance: "Billing, Payroll and Reports, plus the client and employee records they bill and pay against. Nothing clinical.",
  employee: "The caregiver portal only.",
  client_contact: "The family portal only.",
  auditor: "Read-only. Clients, employees, incidents, documents, SOPs and the audit log — the screens a surveyor asks for.",
  bookkeeper: "Reports and Billing only. Records payments, reconciles against the bank, runs the month's numbers.",
};

export function RolesPanel() {
  const s = useAgencySettings();
  const { currentUser } = useDemo();
  const mayGrant = currentUser.role === "ceo_admin" && canWrite(currentUser.role);
  const toggle = (area: Area, on: boolean) => {
    const next = on ? [...new Set([...s.operationsFinance, area])] : s.operationsFinance.filter((a) => a !== area);
    setAgencyField("operationsFinance", next);
  };

  return (
    <div className="space-y-4">
      <section className="rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] p-6">
        <h2 className="m-0 text-[15px] font-semibold tracking-[-.01em]">Operations and the money</h2>
        <p className="m-0 mt-1 text-[12px] leading-[1.5] text-muted-foreground">
          Operations sees nothing financial unless you let them in here, one area at a time. The RN's duties are never theirs whatever is ticked.
        </p>
        <div className="mt-3 flex flex-wrap gap-4">
          {FINANCE_AREAS.map((area) => (
            <label key={area} className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={s.operationsFinance.includes(area)} disabled={!mayGrant} onChange={(e) => toggle(area, e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
              {AREA_LABELS[area]}
            </label>
          ))}
        </div>
        {!mayGrant && <p className="m-0 mt-2 text-[12px] text-muted-foreground">Only the Admin / Owner can change this.</p>}
      </section>

      <section className="rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] p-6">
        <h2 className="m-0 text-[15px] font-semibold tracking-[-.01em]">Who sees what</h2>
        <p className="m-0 mt-1 text-[12px] leading-[1.5] text-muted-foreground">Each role, and the screens it may open. Read the row, then the ticks.</p>
        <ul className="m-0 mt-4 list-none space-y-3 p-0">
          {DASHBOARD_ROLES.map((role) => (
            <li key={role} className="rounded-[12px] border border-[var(--hairline-soft)] p-3.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="m-0 text-[13.5px] font-semibold">{ROLE_LABELS[role]}</p>
                <p className="m-0 text-[11.5px] text-muted-foreground">
                  {!canWrite(role) ? "Read-only" : canDoClinical(role) ? "Can complete the RN's work" : "Cannot complete the RN's work"}
                </p>
              </div>
              <p className="m-0 mt-0.5 text-[12.5px] text-muted-foreground">{BLURB[role]}</p>
              <ul className="m-0 mt-2 flex list-none flex-wrap gap-1.5 p-0">
                {ALL_AREAS.map((area) => {
                  const on = canView(role, area);
                  return (
                    <li key={area} className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[11px]", on ? "border-[#1407A2]/25 bg-[#EFEDFB] text-primary" : "border-[var(--hairline-soft)] text-[var(--ink-muted)] line-through decoration-[var(--ink-muted)]/60")}>
                      {on && <Check className="h-3 w-3" aria-hidden="true" />}
                      {AREA_LABELS[area]}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
        <p className="mb-0 mt-4 text-xs text-muted-foreground">
          Caregivers and client contacts use the portal, not this dashboard. This screen is how the prototype scopes what each role is shown; the enforcement belongs in the database's row policies when Supabase is connected, and these are the rules to mirror there.
        </p>
      </section>
    </div>
  );
}
