import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeftRight, Home, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  HOUSEHOLD_BILLING_LABELS,
  HOUSEHOLD_BILLING_MEANINGS,
  billingMismatch,
  mismatchMessage,
  shares,
  splitRate,
  suggestedBilling,
  validateSplit,
  type Household,
  type HouseholdBilling,
} from "@/domain/billing/households";

const money = (n: number) => (n % 1 === 0 ? `$${n}` : `$${n.toFixed(2)}`);

/** "Served with" on a client record: who shares the home, and how the household is billed. */
export function HouseholdCard({
  household,
  clientPersonId,
  hourlyRate,
  payerFor,
  onChange,
  onRateChange,
  canEdit,
}: {
  household: Household;
  clientPersonId: string;
  hourlyRate: number | null;
  payerFor: (personId: string) => string | null | undefined;
  onChange: (billing: HouseholdBilling) => void;
  onRateChange?: (rate: number | null, split: Record<string, number>) => void;
  canEdit: boolean;
}) {
  const others = household.members.filter((m) => m.personId !== clientPersonId);
  const mismatch = billingMismatch(household, payerFor);
  const flip: HouseholdBilling = household.billing === "combined" ? "separate" : "combined";
  const [editing, setEditing] = useState(false);
  const inForce = household.householdRate ?? hourlyRate;
  const [rateText, setRateText] = useState(household.householdRate == null ? "" : String(household.householdRate));
  const [split, setSplit] = useState<Record<string, number>>(() => shares(household));
  const parsed = rateText.trim() === "" ? null : Number(rateText);
  const rate = Number.isFinite(parsed) ? parsed : null;
  const preview = rate === null ? [] : splitRate({ ...household, split }, rate);
  const problems = validateSplit({ rate, shares: split, memberIds: household.members.map((m) => m.personId) });
  const current = inForce === null ? [] : splitRate(household, inForce);

  return (
    <section className="flex flex-col gap-3.5 rounded-[14px] border border-[var(--hairline)] bg-[var(--paper)] p-[18px]">
      <div className="flex items-center gap-2">
        <Home className="h-3.5 w-3.5 text-[var(--ink-body)]" aria-hidden="true" />
        <h2 className="m-0 text-sm font-semibold tracking-[-.01em]">Served with</h2>
      </div>
      <div className="flex flex-col gap-1.5">
        {others.map((m) => (
          <Link key={m.personId} to={`/clients/${m.personId}`} className="text-[13.5px] text-primary hover:underline">
            {m.name}
          </Link>
        ))}
        <p className="m-0 text-[12.5px] leading-[1.5] text-muted-foreground">
          Same home, one caregiver, one visit — so the shift is scheduled and clocked once. They keep their own chart, care plan and consents.
        </p>
      </div>
      <div className="flex flex-col gap-2.5 border-t border-[var(--hairline-soft)] pt-3.5">
        <span className="text-[11px] font-semibold uppercase tracking-[.09em] text-[#9B9BA3]">Billing</span>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-[14px] font-medium text-[var(--ink-strong)]">{HOUSEHOLD_BILLING_LABELS[household.billing]}</span>
          {inForce !== null && (
            <span className="text-[12.5px] text-[var(--ink-body)]">
              {household.billing === "combined" ? `${money(inForce)}/hr on one invoice` : current.map((r) => `${money(r.rate)} ${r.name.split(" ")[0]}`).join(" · ")}
            </span>
          )}
        </div>
        <p className="m-0 text-[12.5px] leading-[1.5] text-muted-foreground">{HOUSEHOLD_BILLING_MEANINGS[household.billing]}</p>
        {inForce !== null && (
          <p className="m-0 text-[12px] leading-[1.5] text-[#9B9BA3]">
            Either way the household pays {money(inForce)} an hour in total.{household.householdRate == null ? " No household rate set — this is the client's own." : ""}
          </p>
        )}
        {mismatch && (
          <p className="m-0 flex items-start gap-1.5 rounded-[10px] bg-[#FFF7E6] px-3 py-2.5 text-[12.5px] leading-[1.5] text-[#93540A]">
            <TriangleAlert className="mt-[2px] h-3.5 w-3.5 flex-none" aria-hidden="true" />
            {mismatchMessage(household)}
          </p>
        )}
        {household.note && <p className="m-0 text-[12px] leading-[1.5] text-muted-foreground">Note: {household.note}</p>}
        {canEdit &&
          onRateChange &&
          (editing ? (
            <div className="flex flex-col gap-2.5 rounded-[11px] border border-[var(--hairline)] bg-[var(--paper-sunken)] p-3">
              <label className="flex flex-col gap-1">
                <span className="text-[10.5px] font-semibold uppercase tracking-[.08em] text-muted-foreground">Household rate, per hour</span>
                <input
                  id={`household-rate-${household.id}`}
                  inputMode="decimal"
                  value={rateText}
                  onChange={(e) => setRateText(e.target.value)}
                  placeholder="45.00"
                  className="h-[34px] rounded-[9px] border border-[var(--hairline)] bg-[var(--paper)] px-2.5 text-[13px] outline-none transition-colors focus:border-primary"
                />
              </label>
              <div className="flex flex-col gap-1.5">
                <span className="text-[10.5px] font-semibold uppercase tracking-[.08em] text-muted-foreground">Split between them</span>
                {household.members.map((m) => (
                  <div key={m.personId} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-[12.5px]">{m.name}</span>
                    <input
                      aria-label={`${m.name} share`}
                      inputMode="numeric"
                      value={Math.round((split[m.personId] ?? 0) * 100)}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        setSplit((prev) => ({ ...prev, [m.personId]: Number.isFinite(n) ? n / 100 : 0 }));
                      }}
                      className="h-[30px] w-[62px] rounded-[8px] border border-[var(--hairline)] bg-[var(--paper)] px-2 text-right text-[12.5px] tabular-nums outline-none focus:border-primary"
                    />
                    <span className="w-6 text-[12px] text-muted-foreground">%</span>
                    <span className="w-[68px] text-right text-[12.5px] font-medium tabular-nums">{preview.find((p) => p.personId === m.personId) ? money(preview.find((p) => p.personId === m.personId)!.rate) : "—"}</span>
                  </div>
                ))}
                {rate !== null && preview.length > 0 && <span className="text-[11.5px] text-muted-foreground">Adds back to {money(rate)} an hour.</span>}
              </div>
              {problems.length > 0 && <p className="m-0 text-[12px] leading-[1.45] text-[#B42318]">{problems[0]}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={problems.length > 0}
                  onClick={() => {
                    onRateChange(rate, split);
                    setEditing(false);
                  }}
                  className={cn(
                    "h-[32px] flex-1 rounded-[9px] px-3 text-[12.5px] font-medium transition-colors",
                    problems.length > 0 ? "cursor-not-allowed bg-[var(--wash-strong)] text-muted-foreground/50" : "bg-primary text-white hover:bg-[#2A1BD1]",
                  )}
                >
                  Save the household rate
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setRateText(household.householdRate == null ? "" : String(household.householdRate));
                    setSplit(shares(household));
                  }}
                  className="h-[32px] rounded-[9px] border border-[var(--hairline)] bg-[var(--paper)] px-3 text-[12.5px] text-[var(--ink-body)] transition-colors hover:bg-[var(--wash)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setEditing(true)} className="w-fit text-[12.5px] font-medium text-primary hover:underline">
              {household.householdRate == null ? "Set a household rate" : "Edit the household rate and split"}
            </button>
          ))}
        {canEdit && (
          <button
            type="button"
            onClick={() => onChange(flip)}
            className={cn(
              "mt-0.5 flex h-9 w-full items-center justify-center gap-2 rounded-[10px] border px-3.5 text-[13px] font-medium transition-colors",
              mismatch ? "border-[rgba(20,7,162,.24)] bg-primary text-white hover:bg-[#2A1BD1]" : "border-[var(--hairline)] bg-[var(--paper)] text-[var(--ink-strong)] hover:bg-[var(--wash)]",
            )}
          >
            <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />
            Switch to {HOUSEHOLD_BILLING_LABELS[flip].toLowerCase()}
          </button>
        )}
        <p className="m-0 text-[12px] text-[#9B9BA3]">
          {household.members.map((m) => `${m.name.split(" ")[0]}: ${payerFor(m.personId) ?? "no payer on file"}`).join(" · ")} — suggests {HOUSEHOLD_BILLING_LABELS[suggestedBilling(payerFor(clientPersonId))].toLowerCase()}.
        </p>
      </div>
    </section>
  );
}
