cd /home/claude/joy && python3 - <<'EOF'
def patch(p, pairs):
    s=open(p).read()
    for old,new in pairs:
        assert s.count(old)==1,(p,old[:60],s.count(old))
        s=s.replace(old,new)
    open(p,'w').write(s)

patch('src/components/documents/AddFilesDialog.tsx', [
('''              if (problem) return;
              const pending = normalizeTag(typing);
              onAdd({''','''              if (problem) return;
              onAdd({'''),
])

patch('src/components/documents/EditDocumentDialog.tsx', [
('''import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { displayName, normalizeTag, type AgencyDocument, type DocumentFolder } from "@/domain/documents/library";
import { X } from "lucide-react";''','''import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { displayName, type AgencyDocument, type DocumentFolder } from "@/domain/documents/library";
import { TagPicker } from "@/components/layout/TagPicker";
import { useAgencySettings } from "@/lib/agencyStore";'''),
('''  const [tags, setTags] = useState<string[]>([]);
  const [typing, setTyping] = useState("");

  useEffect(() => {
    if (!doc) return;
    setName(displayName(doc.name));
    setFolder(doc.folder);
    setTags(doc.tags);
    setTyping("");
  }, [doc]);

  const ext = doc && doc.name.lastIndexOf(".") > 0 ? doc.name.slice(doc.name.lastIndexOf(".")) : "";
  const addTag = () => {
    const t = normalizeTag(typing);
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTyping("");
  };
''','''  const [tags, setTags] = useState<string[]>([]);
  const { tagPresets } = useAgencySettings();

  useEffect(() => {
    if (!doc) return;
    setName(displayName(doc.name));
    setFolder(doc.folder);
    setTags(doc.tags);
  }, [doc]);

  const ext = doc && doc.name.lastIndexOf(".") > 0 ? doc.name.slice(doc.name.lastIndexOf(".")) : "";
'''),
('''          <div className="space-y-1">
            <Label htmlFor="edit-tags" className="text-[12px] font-medium">Tags</Label>
            <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5">
              {tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-full bg-[var(--hairline-soft)] px-2 py-[2px] text-[12px]">
                  {t}
                  <button type="button" aria-label={`Remove tag ${t}`} onClick={() => setTags(tags.filter((x) => x !== t))} className="text-muted-foreground hover:text-foreground">
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </span>
              ))}
              <Input
                id="edit-tags"
                value={typing}
                onChange={(e) => setTyping(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                onBlur={addTag}
                placeholder="add a tag — Enter after each"
                className="h-7 min-w-[140px] flex-1 border-none px-1 shadow-none focus-visible:ring-0"
              />
            </div>
          </div>''','''          <div className="space-y-1">
            <p className="m-0 text-[12px] font-medium">Tags</p>
            {/* Karynn, 29 September: picked from the list in Settings, not typed. */}
            <TagPicker presets={tagPresets.documents} value={tags} onChange={setTags} />
          </div>'''),
('''              const pending = normalizeTag(typing);
              onSave({ name: `${name.trim()}${ext}`, folder, tags: pending && !tags.includes(pending) ? [...tags, pending] : tags });''',
 '''              onSave({ name: `${name.trim()}${ext}`, folder, tags });'''),
])

# ── Seed: employment extras + Chanel's mock profile ──
patch('src/lib/employeesSeed.ts', [
('''import type { WorkAuthorizationBasis } from "@/domain/employees/workAuthorization";
''','''import type { WorkAuthorizationBasis } from "@/domain/employees/workAuthorization";
import type { EmployeeProfile } from "@/domain/employees/profile";
'''),
('''  kin: string | null;
  kinLine: string | null;
  summary: string;
  records: Record<string, CredentialRecord>;
}''','''  kin: string | null;
  kinLine: string | null;
  summary: string;
  records: Record<string, CredentialRecord>;
  /**
   * The editable half, pre-filled. Karynn, 29 September: "Add in mock data
   * for the rest on Chanel's profile so I can see what a full profile looks
   * like." Only Chanel carries one; everybody else's form opens from the seed
   * columns above. Addresses use 99xx street numbers and phones 555-01xx, so
   * nothing here can reach a real person.
   */
  profile?: Partial<EmployeeProfile>;
  /**
   * Employment details beyond the pay columns — mock, on Chanel's record only,
   * to Karynn's screenshots of 29 September. Gusto is not connected; these
   * are what the record would show once it is, not a reading from it.
   */
  employment?: EmploymentExtras;
}

export interface EmploymentExtras {
  /** What Gusto holds for this person. "complete" | "pending" | "not_started". */
  gusto: {
    w4: "complete" | "pending" | "not_started";
    i9: "complete" | "pending" | "not_started";
    payrollSetup: "complete" | "pending" | "not_started";
    handbookSignedOn: string | null;
  };
  /** How they are paid, as Gusto has it. */
  payMethod: string;
  payCadence: string;
  timeAndAttendance: {
    clockMethod: string;
    lateArrivals90d: number;
    missedShifts90d: number;
  };
  reviews: {
    lastOn: string | null;
    lastRating: string | null;
    nextOn: string | null;
  };
}

export const GUSTO_STATE_LABELS: Record<EmploymentExtras["gusto"]["w4"], string> = {
  complete: "Complete",
  pending: "Pending",
  not_started: "Not started",
};'''),
('''    nextShift: "Tue, Aug 19 · 7:00 AM",
    clients: ["Marilyn K"],
    kin: null,
    kinLine: null,
    summary: "",
    records: { ...ok },
  },''','''    nextShift: "Tue, Aug 19 · 7:00 AM",
    clients: ["Marilyn K"],
    /* Mock, per Karynn 29 September. 555-01xx numbers reach nobody. */
    kin: "Denise P",
    kinLine: "Sister · (713) 555-0158",
    summary:
      "Chanel is the agency's longest-serving field caregiver, with Joy since March 2023 and on the Marilyn K case. Credentials are all current and she carries 37.5 hours a week without overtime.",
    records: { ...ok },
    profile: {
      middleName: "Marie",
      preferredName: "Chanel",
      dateOfBirth: "1991-08-14",
      gender: "Female",
      externalId: "JH-0007",
      referralSource: "Referral",
      migratoryStatus: "US Citizen",
      disciplines: ["Caregiver", "Companionship"],
      staffLicense: "TX-CG-482913",
      tags: ["Weekends", "Dementia experience", "Own car"],
      preferredLanguage: "English",
      otherLanguages: ["Spanish"],
      applicationDate: "2023-02-14",
      jobDescriptionSignedOn: "2023-03-02",
      exclusionStatus: "cleared",
      exclusionCheckedAt: "2026-07-01",
      phoneMobile: "(713) 555-0142",
      email: "chanel.p@example.com",
      address: {
        line1: "9912 Westheimer Rd",
        line2: "Apt 214",
        city: "Houston",
        state: "TX",
        zip: "77063",
        county: "Harris",
      },
      emergencyContacts: [
        { name: "Denise P", address: "9930 Richmond Ave, Houston, TX 77042", phone: "(713) 555-0158", relationship: "Sibling", relationshipOther: "" },
        { name: "Marcus T", address: "", phone: "(281) 555-0173", relationship: "Other", relationshipOther: "Neighbour" },
      ],
      generalNotes: "Prefers weekday mornings. Comfortable with dementia clients; has done two hospice cases.",
    },
    employment: {
      gusto: { w4: "complete", i9: "complete", payrollSetup: "complete", handbookSignedOn: "2026-07-01" },
      payMethod: "Direct deposit",
      payCadence: "Biweekly",
      timeAndAttendance: { clockMethod: "Mobile · GPS", lateArrivals90d: 1, missedShifts90d: 0 },
      reviews: { lastOn: "2026-03-02", lastRating: "Meets", nextOn: "2027-03-02" },
    },
  },'''),
('''export const seedEmployeeActivity: Record<string, Array<{ label: string; at: string; tone: string }>> = {
  "emp-bedjine": [''','''export const seedEmployeeActivity: Record<string, Array<{ label: string; at: string; tone: string }>> = {
  /* Mock, per Karynn 29 September, to her Activity screenshot. */
  "emp-chanel": [
    { label: "Shift completed — Pamela P, 10:30 AM to 6:00 PM", at: staffActivityAt(1, "18:04"), tone: "done" },
    { label: "Clocked in from client home (GPS verified)", at: staffActivityAt(1, "10:28"), tone: "prog" },
    { label: "CPR certification uploaded", at: staffActivityAt(5, "09:18"), tone: "done" },
    { label: "Picked up open shift — Marilyn K", at: staffActivityAt(7, "16:22"), tone: "prog" },
    { label: "Annual training completed — infection control", at: staffActivityAt(61, "11:40"), tone: "done" },
    { label: "Employee handbook re-signed", at: staffActivityAt(82, "08:05"), tone: "done" },
    { label: "Hired — onboarding completed", at: "2023-03-02T15:00:00.000Z", tone: "done" },
  ],
  "emp-bedjine": ['''),
])

# roster: seed profile merges under profileFromSeed
patch('src/lib/employeeRoster.ts', [
('''    mrNumber: e.mrNumber ?? null,
    address: blankAddress(),
    emergencyContacts: [blankContact(), blankContact()],
  };
}''','''    mrNumber: e.mrNumber ?? null,
    address: blankAddress(),
    emergencyContacts: [blankContact(), blankContact()],
    // A seed with a pre-filled profile — Chanel's mock, per Karynn — over the columns.
    ...(e.profile ?? {}),
  };
}'''),
])
EOF
grep -n "profile" src/lib/employeeRoster.ts | head -20