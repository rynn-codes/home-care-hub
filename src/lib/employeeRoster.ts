import { seedEmployees, type SeedEmployee } from "@/lib/employeesSeed";
import { blankAddress, blankContact, blankProfile, type EmployeeProfile } from "@/domain/employees/profile";
import type { DemoState } from "@/lib/demoStore";

/**
 * The staff roster as the screens read it: the seed, plus people hired
 * through Onboarding, plus people added on the Employees screen, with every
 * edit laid over the top and the deleted ones taken out.
 *
 * Seeded employees cannot be edited in place — they live in a source file —
 * so edits are an override map keyed by id, and a seed record with an edit
 * is rebuilt from its edited profile. That is what lets Karynn change Chanel's
 * phone number on the record and see it everywhere the record is read.
 */
export interface RosterEmployee extends SeedEmployee {
  profile?: Partial<EmployeeProfile>;
  /** When somebody went inactive, for the resting-off-roster rule. */
  inactiveSince?: string | null;
}

/** The form's view of a seeded employee: the seed columns, with the profile laid over. */
export function profileFromSeed(e: SeedEmployee): EmployeeProfile {
  const [firstName, ...rest] = e.name.split(" ");
  return {
    ...blankProfile(),
    firstName: firstName ?? "",
    lastName: rest.join(" "),
    role: e.role,
    title: e.title,
    status: e.status,
    location: e.location,
    employmentType: e.employmentType,
    baseRate: e.baseRate,
    weeklyHours: e.weeklyHours,
    drives: e.drives,
    hiredOn: e.hiredOn,
    phoneMobile: e.phone ?? "",
    email: e.email ?? "",
    mrNumber: e.mrNumber ?? null,
    address: blankAddress(),
    emergencyContacts: [blankContact(), blankContact()],
    ...(e.profile ?? {}),
  } as EmployeeProfile;
}

/** A seed record with an edited profile written back over its columns. */
export function applyProfile(e: SeedEmployee, p: EmployeeProfile): RosterEmployee {
  return {
    ...e,
    name: `${p.firstName} ${p.lastName}`.trim() || e.name,
    title: p.title || e.title,
    role: p.role,
    status: p.status,
    location: p.location || e.location,
    hiredOn: p.hiredOn ?? e.hiredOn,
    employmentType: p.employmentType || e.employmentType,
    baseRate: p.baseRate,
    weeklyHours: p.weeklyHours,
    drives: p.drives,
    phone: p.phoneMobile || null,
    email: p.email || null,
    mrNumber: p.mrNumber,
    profile: p,
  };
}

/** Somebody added on the Employees screen — no seed row, so everything comes from the form. */
export function fromAddedProfile(id: string, p: EmployeeProfile): RosterEmployee {
  return applyProfile(
    {
      id,
      name: "",
      title: p.title,
      role: p.role,
      status: p.status,
      location: p.location,
      hiredOn: p.hiredOn ?? new Date().toISOString().slice(0, 10),
      employmentType: p.employmentType,
      baseRate: p.baseRate,
      weeklyHours: p.weeklyHours,
      drives: p.drives,
      phone: null,
      email: null,
      nextShift: null,
      clients: [],
      kin: null,
      kinLine: null,
      summary: "",
      records: {},
    },
    p,
  );
}

type RosterInput = Partial<
  Pick<DemoState, "newHires" | "addedEmployees" | "employeeEdits" | "deletedEmployeeIds">
>;

export function buildRoster(state: RosterInput): RosterEmployee[] {
  const deleted = new Set(state.deletedEmployeeIds ?? []);
  const hiredIds = new Set((state.newHires ?? []).map((e) => e.id));
  const added = (state.addedEmployees ?? [])
    .filter((a) => !deleted.has(a.id))
    .map((a) => fromAddedProfile(a.id, a.profile));
  const seeded = [
    ...((state.newHires ?? []) as unknown as SeedEmployee[]),
    ...seedEmployees.filter((e) => !hiredIds.has(e.id)),
  ]
    .filter((e) => !deleted.has(e.id))
    .map((e): RosterEmployee => {
      const edit = state.employeeEdits?.[e.id];
      const profile = { ...profileFromSeed(e), ...(edit ?? {}) } as EmployeeProfile;
      return edit ? applyProfile(e, profile) : { ...e, profile };
    });
  return [...added, ...seeded];
}
