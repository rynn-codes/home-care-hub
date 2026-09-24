import { employeeAssignee, JOY, type Assignee, type Subject } from "@/domain/brain/subjects";

/** "August 26" — the day after today, in the brief's own long form. */
function tomorrowLabel(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toLocaleDateString([], { month: "long", day: "numeric" });
}

/**
 * The Home screen's content, built from Karynn's mockup and then brought onto
 * the one cast every other screen carries.
 *
 * Karynn, 24 August: "Make the Home Screen EXACTLY like the mockup." The
 * layout, the copy and the counts below are the design's own. The people are
 * not: a Home that named a Mrs. Davis the Clients directory had never heard of
 * was Joy contradicting itself, so the rows now point at the same records the
 * rest of the product shows — Pamela P's care conference, Marilyn K's
 * background check, Vince W's CPR — and every row that names somebody opens
 * them.
 *
 * What is still the mockup's: the two orientation names (David Okoro,
 * Samantha Chen) on the schedule card, which have no record behind them and
 * are labelled by their link into Hiring rather than a person.
 */

export const HOME_BRIEF = {
  headline: "Operations are in good shape.",
  paragraph:
    "Payroll closes tomorrow. Joy is waiting on two corrected timecards and has already followed up with both caregivers. Pamela P's family care conference is at 2:00 PM today.",
  // The mockup froze this at "tomorrow — August 24" because its today was the
  // 23rd. Ours is the real clock, so the date is computed: a card that says
  // "tomorrow" beside yesterday's date is the kind of small wrongness that
  // makes a person stop trusting every other number on the screen.
  comingUp: {
    icon: "🎂",
    title: "Coming up tomorrow — Thylia B's birthday",
    when: tomorrowLabel(),
    subject: { kind: "employee", id: "emp-thylia" } as Subject,
  },
  allClear: "Nothing else needs your attention this morning.",
};

export interface HomeEvent {
  time: string;
  duration: string;
  title: string;
  meta: string;
  tag: string;
  done?: boolean;
  href: string;
}

export const HOME_SCHEDULE: HomeEvent[] = [
  {
    time: "9:00 AM",
    duration: "30 min",
    title: "Weekly leadership sync",
    meta: "Office · notes captured by Joy",
    tag: "Completed",
    done: true,
    href: "/brain/my-work",
  },
  {
    time: "2:00 PM",
    duration: "45 min",
    title: "Pamela P · family care conference",
    meta: "With Robert Tanya R, RN · client home",
    tag: "Open client",
    href: "/clients",
  },
  {
    time: "4:00 PM",
    duration: "1 hr",
    title: "Field orientation · David Okoro",
    meta: "Shadowing Samantha Chen",
    tag: "Orientation",
    href: "/hiring",
  },
];

export interface HomeNeed {
  title: string;
  subject: string;
  /** The category chip on the right of the row. */
  pill: string;
  cta: string;
  href: string;
}

export const HOME_NEEDS: HomeNeed[] = [
  {
    title: "Approve payroll · Aug 22–28",
    subject: "Joy prepared 36 timecards · closes tomorrow",
    pill: "Payroll",
    cta: "Review",
    href: "/payroll",
  },
  {
    title: "Approve Vince W rate change",
    subject: "$24.00 → $26.50/hr · requested by scheduling",
    pill: "Rate",
    cta: "Review",
    href: "/clients",
  },
  {
    title: "Confirm Jessie C caregiver match",
    subject: "Joy prepared 3 candidates · start date Aug 26",
    pill: "Match",
    cta: "Review",
    href: "/scheduling",
  },
];

/** The footer line beside the cleared count. */
export const HOME_NEEDS_FOOTNOTE = "Everything else Joy is authorized to handle.";

export interface HomeWaiting {
  /** lucide icon name, resolved in the component. */
  icon: "check" | "share" | "upload" | "user";
  /** The tinted disc behind it: [background, foreground]. */
  tint: [string, string];
  title: string;
  sub: string;
  /** What Joy last did about it — the row's right-hand chip. */
  pill: string;
  /** Who is carrying it: Joy, or a named person on the team. */
  assignedTo: Assignee;
  href: string;
}

export const HOME_WAITING: HomeWaiting[] = [
  {
    icon: "check",
    tint: ["bg-[#FFF4E8]", "text-[#B54708]"],
    title: "Background check pending",
    sub: "Marilyn K · requested 3 days ago",
    pill: "Joy following up",
    assignedTo: JOY,
    href: "/hiring",
  },
  {
    icon: "share",
    tint: ["bg-[#EEF0FE]", "text-primary"],
    title: "Family signature requested",
    sub: "Pamela P — Plan of Care · sent Tuesday",
    pill: "Kelsey calling today",
    assignedTo: employeeAssignee("emp-kelsey", "Kelsey Westley, RN"),
    href: "/clients",
  },
  {
    icon: "upload",
    tint: ["bg-[#ECFDF3]", "text-[#027A48]"],
    title: "CPR renewal requested",
    sub: "Vince W · expires Aug 29",
    pill: "Reminder sent Friday",
    assignedTo: JOY,
    href: "/employees",
  },
  {
    icon: "user",
    tint: ["bg-[#EFF4FF]", "text-[#175CD3]"],
    title: "Gusto onboarding incomplete",
    sub: "Jane Smith · step 2 of 4",
    pill: "Joy nudged today",
    assignedTo: JOY,
    href: "/employees",
  },
];

/**
 * Joy's own work, in the four states CLAUDE.md fixes: HANDLED · WORKING ·
 * WAITING · NEEDS YOU, those words, that order, everywhere they appear.
 *
 * Karynn, 25 August: "All of these should be links to somewhere. Also you're
 * missing View Joy Operations." Both were real. NEEDS YOU was absent entirely —
 * three states where the rule says four, and the missing one is the only state
 * that asks the human for anything. And every line was plain text: Joy would
 * report that it had chased two signatures and leave you to work out where to
 * go and look.
 *
 * So `to` is required on every item, not optional. A line in this column is a
 * claim about work, and a claim about work you cannot open is a claim you
 * cannot check.
 */
export interface JoyItem {
  text: string;
  /** Where this goes. Required — see above. */
  to: string;
}

export const HOME_JOY: ReadonlyArray<{
  n: number;
  label: string;
  note: string;
  tone: string;
  items: readonly JoyItem[];
}> = [
  {
    n: 12,
    label: "Handled",
    note: "since yesterday",
    tone: "text-[#15803D]",
    items: [
      { text: "Sent 3 credential reminders", to: "/employees" },
      { text: "Followed up on 2 client signatures", to: "/clients" },
      { text: "Requested missing medication list", to: "/clients/care-plans" },
      { text: "Sent schedule confirmations", to: "/scheduling" },
    ],
  },
  {
    n: 3,
    label: "Working",
    note: "",
    tone: "text-primary",
    items: [
      { text: "Following up on background check", to: "/hiring" },
      { text: "Resolving missing clock-out", to: "/payroll" },
      { text: "Collecting two corrected timecards", to: "/payroll" },
    ],
  },
  {
    n: 4,
    label: "Waiting",
    note: "",
    tone: "text-muted-foreground",
    // One line, as the design has it, rather than the four itemised rows this
    // column used to carry. Waiting is the state where the office can do
    // nothing but wait, so naming four people it cannot chase is four lines of
    // noise; the list itself is one tap away under Waiting on Others.
    items: [
      {
        text: "External responses on credentials, signatures and onboarding",
        to: "/brain/my-work",
      },
    ],
  },
  {
    n: 1,
    label: "Needs you",
    note: "",
    // The one warm colour in this column: this is the one state where a
    // human still owes something. Handled is green, Working is the primary
    // blue, Waiting is quiet.
    tone: "text-[#C2410C]",
    items: [{ text: "Approve Vince W rate change", to: "/brain/operations" }],
  },
];

/**
 * The three figures that close the screen.
 *
 * The mockup's own values. Everything else on Home is transcribed rather than
 * computed, and these follow suit so the screen reads as one piece; the live
 * counts still drive the sidebar and The Brain.
 */
export const HOME_STATS = [
  { label: "Clients", value: "42", sub: "Active", href: "/clients" },
  { label: "Caregivers", value: "36", sub: "Active", href: "/employees" },
  { label: "Hours", value: "1,284", sub: "Current billing period", href: "/payroll" },
] as const;
