import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { morningBrief } from "@/domain/home/brief";
import { upcomingBillingWeek } from "@/domain/billing/run";
import { useHomeSignals } from "@/components/home/useHomeSignals";
import { todaysAgenda } from "@/lib/joySeed";
import { seedEmployees } from "@/lib/employeesSeed";
import { seedVisits } from "@/lib/schedulingSeed";
import { seedAdmissions } from "@/lib/admissionsSeed";

/**
 * The brief band — the mock's framed section between hairlines: Morning Brief
 * and the four-figure stat row on the left, the Talk to Joy AI card on the
 * right, split 1.5fr / 1fr with a hairline between.
 *
 * Every number is computed (module-owned signals and seeds); every stat is a
 * link to the screen that owns it. One recorded deviation from the mock's hex:
 * meta-grays sit at the app's accessible muted token, because the mock's
 * #9B9BA3-on-white fails the contrast bar Joy's own accessibility suite holds
 * every screen to. Visually near-identical; legally better.
 */
export function BriefBand() {
  const signals = useHomeSignals();

  const brief = useMemo(() => {
    const today = new Date().toISOString();
    return morningBrief({
      visitsToday: todaysAgenda.length,
      unassignedToday: todaysAgenda.filter((e) => e.state === "unassigned").length,
      signals,
      upcomingBillingWeek: upcomingBillingWeek(today),
      today,
    });
  }, [signals]);

  const stats = useMemo(() => {
    const activeClients = new Set(
      seedVisits.filter((v) => v.clientPersonId && !v.eventType).map((v) => v.clientPersonId),
    ).size;
    const caregivers = seedEmployees.filter((e) => e.status === "active").length;
    // Today's uncovered visits come from the same agenda the schedule tab
    // below renders, plus any future open shift the scheduling engine sees —
    // one screen must not say "all covered" while its own tab shows a red dot.
    const openSignal = Number(signals.find((s) => s.key === "open-shifts")?.value ?? "0");
    const openToday = todaysAgenda.filter((e) => e.state === "unassigned").length;
    const open = Math.max(openSignal, openToday);
    // Admissions owns assessments: the count is the pipeline's assessment
    // stage plus any initial assessment on today's agenda.
    const assessments =
      seedAdmissions.filter((a) => a.stage === "assessment").length +
      todaysAgenda.filter((e) => e.service.toLowerCase().includes("assessment")).length;
    return [
      { label: "Active Clients", value: String(activeClients), note: "on the schedule", to: "/clients", dot: false },
      { label: "Caregivers", value: String(caregivers), note: "active", to: "/employees", dot: false },
      {
        label: "Open Shifts",
        value: String(open),
        note: open > 0 ? "Needs coverage" : "All covered",
        to: "/scheduling",
        dot: open > 0,
      },
      { label: "Assessments", value: String(assessments), note: "This week", to: "/admissions", dot: false },
    ];
  }, [signals]);

  return (
    <section className="grid items-stretch gap-0 border-y border-black/[.07] py-5 lg:grid-cols-[1.5fr_1fr]">
      {/* ------------------------------------------------ brief + stats -- */}
      <div className="flex min-w-0 flex-col gap-2 lg:pr-11">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          <h2 className="m-0 text-[14.5px] font-medium tracking-[-.01em]">Morning Brief</h2>
        </div>
        <p className="m-0 max-w-[64ch] text-sm font-normal leading-[1.65] text-foreground/80">
          {brief}
        </p>

        {/* The brief names what needs you; these take you there. The static
            mock cannot show live state, so this line exists only when
            something is urgent — a quiet morning renders nothing here. Only
            the signals the headline sentence names get a link: the rest are
            "other things", and their screens are one click away in the nav. */}
        {signals.some((s) => s.urgent) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {signals
              .filter((s) => s.urgent)
              .slice(0, 3)
              .map((s) => (
                <Link
                  key={s.key}
                  to={s.to}
                  className="text-[12.5px] font-normal text-primary transition-colors hover:text-[#2A1BD1]"
                >
                  {s.label}
                  {s.detail ? ` — ${s.detail.toLowerCase()}` : ""}
                </Link>
              ))}
          </div>
        )}

        <div className="mt-auto grid grid-cols-2 gap-y-4 border-t border-black/[.06] pt-4 sm:grid-cols-4 sm:gap-y-0">
          {stats.map((stat, i) => (
            <Link
              key={stat.label}
              to={stat.to}
              className={
                "flex flex-col gap-1 text-foreground transition-colors hover:text-primary " +
                (i === 0
                  ? "sm:pr-5"
                  : i === stats.length - 1
                    ? "sm:border-l sm:border-black/[.05] sm:pl-5"
                    : "sm:border-l sm:border-black/[.05] sm:px-5")
              }
            >
              <span className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                {stat.dot && (
                  <span aria-hidden="true" className="h-[5px] w-[5px] flex-none rounded-full bg-[#B91C1C]" />
                )}
                {stat.label}
              </span>
              <span className="text-[23px] font-normal leading-none tracking-[-.03em] tabular-nums">
                {stat.value}
              </span>
              <span className="text-[11.5px] font-light text-muted-foreground">{stat.note}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ------------------------------------------- Talk to Joy AI card -- */}
      <div className="mt-6 flex min-w-0 flex-col justify-center border-black/[.07] lg:mt-0 lg:border-l lg:pl-11">
        <section className="rounded-2xl border border-primary/[.09] bg-[#FAFAFC] p-[18px]">
          <div className="mb-1 flex items-center gap-2">
            <Sparkles className="h-[15px] w-[15px] text-primary" aria-hidden="true" />
            <h2 className="m-0 text-[15px] font-medium tracking-[-.01em] text-primary">Talk to Joy AI</h2>
          </div>
          <p className="mb-3 mt-0 text-[12.5px] font-light text-muted-foreground">
            Your assistant for smarter, faster decisions.
          </p>
          <button
            type="button"
            onClick={() => document.dispatchEvent(new CustomEvent("joy:open"))}
            className="flex w-full items-center gap-2 rounded-[11px] border border-black/[.07] bg-white py-2 pl-3.5 pr-2 text-left"
          >
            <span className="flex-1 text-[12.5px] text-muted-foreground">
              What would you like help with today?
            </span>
            <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-primary">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M8 12.5V3.5M4.5 7L8 3.5 11.5 7" />
              </svg>
            </span>
          </button>
          <div className="mt-2.5 flex flex-wrap gap-[7px]">
            <Link to="/scheduling" className="rounded-[20px] border border-primary/[.18] px-[11px] py-[5px] text-xs font-normal text-primary transition-colors hover:bg-primary-soft">
              Show today's open shifts
            </Link>
            <Link to="/payroll" className="rounded-[20px] border border-primary/[.18] px-[11px] py-[5px] text-xs font-normal text-primary transition-colors hover:bg-primary-soft">
              What's missing for payroll?
            </Link>
            <Link to="/scheduling" className="rounded-[20px] border border-primary/[.18] px-[11px] py-[5px] text-xs font-normal text-primary transition-colors hover:bg-primary-soft">
              Prepare tomorrow's schedule
            </Link>
          </div>
        </section>
      </div>
    </section>
  );
}
