import { Link } from "react-router-dom";
import { CountLink, HomePanel } from "@/components/home/HomePanel";
import {
  admissionsSummary,
  billingStatus,
  compliance,
  employeeTasks,
  payrollStatus,
  recentActivity,
  upcomingDeadlines,
} from "@/lib/joySeed";

export function AdmissionsSummary() {
  return (
    <HomePanel title="Admissions" action={{ label: "View pipeline", to: "/admissions" }}>
      <div className="divide-y divide-border">
        {admissionsSummary.map((row) => (
          <CountLink key={row.label} {...row} />
        ))}
      </div>
    </HomePanel>
  );
}

export function EmployeeTasks() {
  return (
    <HomePanel title="Employee Tasks" action={{ label: "All tasks", to: "/operations/hiring" }}>
      <div className="divide-y divide-border">
        {employeeTasks.map((row) => (
          <CountLink key={row.label} {...row} />
        ))}
      </div>
    </HomePanel>
  );
}

/** Compliance state is carried by the words, not by colour alone. */
export function CompliancePanel() {
  return (
    <HomePanel title="Compliance" action={{ label: "View all", to: "/operations" }}>
      <ul className="divide-y divide-border">
        {compliance.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-3 py-2.5">
            <span className="text-sm">{row.label}</span>
            <span
              className={
                row.state === "current"
                  ? "text-xs text-muted-foreground"
                  : "text-xs font-medium text-foreground"
              }
            >
              {row.status}
            </span>
          </li>
        ))}
      </ul>
    </HomePanel>
  );
}

/** Recent Activity is a timeline only — no counts, no charts. */
export function RecentActivity() {
  return (
    <HomePanel title="Recent Activity" action={{ label: "Full log", to: "/reports" }}>
      <ol className="space-y-3.5">
        {recentActivity.map((entry) => (
          <li key={entry.id} className="flex gap-3">
            <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-border" />
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-snug">{entry.message}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {entry.actor} · {entry.at}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </HomePanel>
  );
}

export function PayrollPanel() {
  return (
    <HomePanel title="Payroll" action={{ label: "Review payroll", to: "/payroll" }}>
      <dl className="divide-y divide-border">
        {payrollStatus.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3 py-2.5">
            <dt className="text-sm text-muted-foreground">{row.label}</dt>
            <dd className="text-sm font-medium">{row.value}</dd>
          </div>
        ))}
      </dl>
    </HomePanel>
  );
}

export function BillingPanel() {
  return (
    <HomePanel title="Billing" action={{ label: "Billing audit", to: "/billing" }}>
      <dl className="divide-y divide-border">
        {billingStatus.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3 py-2.5">
            <dt className="text-sm text-muted-foreground">{row.label}</dt>
            <dd className="text-sm font-medium">{row.value}</dd>
          </div>
        ))}
      </dl>
    </HomePanel>
  );
}

export function UpcomingDeadlines() {
  return (
    <HomePanel title="Upcoming Deadlines">
      <ol className="divide-y divide-border">
        {upcomingDeadlines.map((row) => (
          <li key={row.date} className="flex items-baseline gap-3 py-2.5">
            <span className="w-14 shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
              {row.date}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm">{row.label}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{row.inDays}</span>
          </li>
        ))}
      </ol>
    </HomePanel>
  );
}

const quickActions = [
  { label: "New Client", to: "/admissions" },
  { label: "New Employee", to: "/operations/hiring" },
  { label: "Schedule Assessment", to: "/admissions" },
  { label: "Create Shift", to: "/scheduling" },
  { label: "Run Payroll", to: "/payroll" },
  { label: "Billing Review", to: "/billing" },
];

/** Six actions, per the Dashboard Revision Request. */
export function QuickActions() {
  return (
    <HomePanel title="Quick Actions">
      <div className="grid grid-cols-2 gap-2">
        {quickActions.map((action) => (
          <Link
            key={action.label}
            to={action.to}
            className="rounded-lg border border-border px-3 py-2.5 text-center text-xs font-medium transition-colors hover:border-primary/40 hover:bg-surface-muted"
          >
            {action.label}
          </Link>
        ))}
      </div>
    </HomePanel>
  );
}
