/**
 * The Home screen's content, taken verbatim from Karynn's mockup.
 *
 * Karynn, 24 August: "Make the Home Screen EXACTLY like the mockup." So the
 * copy, the counts and the row data below are the design's own, transcribed
 * rather than recomputed. Where earlier screens substituted the project's
 * unified cast for the mock's illustrative names, this screen does not — the
 * instruction was exactness, and the mock's people (Mrs. Davis, Joan Robinson,
 * David Okoro, Samantha Chen) are fictional, the same as ours.
 *
 * The consequence, stated plainly so it is a choice and not an accident: Home
 * now names people the Clients and Employees directories do not carry. Say the
 * word and these map onto Dolores Vance / Kelsey Westley / Brandon / Chanel P
 * in one edit — the shapes are identical.
 */

export const HOME_BRIEF = {
  headline: "Operations are in good shape.",
  paragraph:
    "Payroll closes tomorrow. Joy is waiting on two corrected timecards and has already followed up with both caregivers. Mrs. Davis's family care conference is at 2:00 PM today.",
  comingUp: { icon: "🎂", title: "Coming up tomorrow — Thylia's birthday", when: "August 24" },
  allClear: "Nothing else needs your attention this morning.",
};

export interface HomeEvent {
  time: string;
  duration: string;
  title: string;
  meta: string;
  tag: string;
  done?: boolean;
  /** The Now marker sits immediately above this row. */
  nowBefore?: boolean;
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
    title: "Mrs. Davis · family care conference",
    meta: "With Joan Robinson, RN · client home",
    tag: "Open client",
    nowBefore: true,
    href: "/clients",
  },
  {
    time: "4:00 PM",
    duration: "1 hr",
    title: "Field orientation · David Okoro",
    meta: "Shadowing Samantha Chen",
    tag: "Orientation",
    href: "/operations/hiring",
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
    title: "Approve Susan Miller rate change",
    subject: "$24.00 → $26.50/hr · requested by scheduling",
    pill: "Rate",
    cta: "Review",
    href: "/clients",
  },
  {
    title: "Confirm Marcus Bell caregiver match",
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
  href: string;
}

export const HOME_WAITING: HomeWaiting[] = [
  {
    icon: "check",
    tint: ["bg-[#FFF4E8]", "text-[#B54708]"],
    title: "Background check pending",
    sub: "Sarah Johnson · requested 3 days ago",
    pill: "Joy following up",
    href: "/operations/hiring",
  },
  {
    icon: "share",
    tint: ["bg-[#EEF0FE]", "text-primary"],
    title: "Family signature requested",
    sub: "Mrs. Davis — Plan of Care · sent Tuesday",
    pill: "2nd reminder sent",
    href: "/clients",
  },
  {
    icon: "upload",
    tint: ["bg-[#ECFDF3]", "text-[#027A48]"],
    title: "CPR renewal requested",
    sub: "Mike Chen · expires Aug 29",
    pill: "Reminder sent Friday",
    href: "/employees",
  },
  {
    icon: "user",
    tint: ["bg-[#EFF4FF]", "text-[#175CD3]"],
    title: "Gusto onboarding incomplete",
    sub: "Jane Smith · step 2 of 4",
    pill: "Joy nudged today",
    href: "/employees",
  },
];

/** Joy's four states, in the order CLAUDE.md fixes them. */
export const HOME_JOY = [
  {
    n: 12,
    label: "Handled",
    note: "since yesterday",
    tone: "text-[#15803D]",
    items: [
      "Sent 3 credential reminders",
      "Followed up on 2 client signatures",
      "Requested missing medication list",
      "Sent schedule confirmations",
    ],
  },
  {
    n: 3,
    label: "Working",
    note: "",
    tone: "text-primary",
    items: [
      "Following up on background check",
      "Resolving missing clock-out",
      "Collecting two corrected timecards",
    ],
  },
  {
    n: 4,
    label: "Waiting",
    note: "",
    tone: "text-muted-foreground",
    items: [
      "CPR renewal upload · Mike Chen",
      "Care plan signature · Mrs. Davis",
      "Background check · Sarah Johnson",
      "Gusto onboarding · Jane Smith",
    ],
  },
] as const;

export const HOME_ASK_CHIPS = [
  "Show today's open shifts",
  "What's missing for payroll?",
  "Prepare tomorrow's schedule",
];
