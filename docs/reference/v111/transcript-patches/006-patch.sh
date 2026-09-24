cd /home/claude/joy && python3 - <<'EOF'
def patch(p, pairs):
    s=open(p).read()
    for old,new in pairs:
        assert s.count(old)==1,(p,old[:60],s.count(old))
        s=s.replace(old,new)
    open(p,'w').write(s)

# ── settings.ts ──
patch('src/domain/agency/settings.ts', [
('''  mileageRatePerMile: number;
  /**
   * Who sees gross and net profit on the scheduling screens.''','''  mileageRatePerMile: number;
  /**
   * How long a change to a client's or employee's profile can be undone.
   *
   * Karynn, 29 September: "changed info to client or employee profile is to
   * stay for 72 hours in case we need to undo a change. We still would keep
   * an audited trail of info changed." Hours. See domain/records/profileChanges
   * — the audit trail is untouched by this; only the undo offer expires.
   */
  profileUndoHours: number;
  /**
   * Who sees gross and net profit on the scheduling screens.'''),
('''  mileageRatePerMile: DEFAULT_MILEAGE_RATE,
  profitVisibleTo:''','''  mileageRatePerMile: DEFAULT_MILEAGE_RATE,
  profileUndoHours: DEFAULT_PROFILE_UNDO_HOURS,
  profitVisibleTo:'''),
('''export const DEFAULT_MILEAGE_RATE = 0.7;''','''export const DEFAULT_MILEAGE_RATE = 0.7;

/** Karynn's number. The setting is on the Agency tab. */
export const DEFAULT_PROFILE_UNDO_HOURS = 72;'''),
])

# ── agencyStore.ts ──
patch('src/lib/agencyStore.ts', [
('''      profitVisibleTo: Array.isArray(parsed.profitVisibleTo)''','''      profileUndoHours:
        typeof parsed.profileUndoHours === "number" && parsed.profileUndoHours > 0
          ? parsed.profileUndoHours
          : DEFAULT_AGENCY.profileUndoHours,
      profitVisibleTo: Array.isArray(parsed.profitVisibleTo)'''),
])

# ── demoStore.ts ──
patch('src/lib/demoStore.ts', [
('''import type { EmployeeProfile } from "@/domain/employees/profile";
import { seedDocuments }''','''import type { EmployeeProfile } from "@/domain/employees/profile";
import type { ProfileChange } from "@/domain/records/profileChanges";
import { seedDocuments }'''),
('''  approvedDrafts: Record<string, { by: string; at: string; sentAs?: string }>;
  /**
   * Invoices sent from the Saturday run''','''  approvedDrafts: Record<string, { by: string; at: string; sentAs?: string }>;
  /**
   * Profile and status changes that can still be undone — the record as it
   * was, kept for the agency's undo window. Karynn, 29 September. The audit
   * trail is the permanent account; this is the working copy that lets a
   * mistake be put back exactly. See domain/records/profileChanges.
   */
  profileChanges: ProfileChange[];
  /**
   * Invoices sent from the Saturday run'''),
('''    approvedDrafts: {},
    issuedInvoices: [],''','''    approvedDrafts: {},
    profileChanges: [],
    issuedInvoices: [],'''),
])
EOF