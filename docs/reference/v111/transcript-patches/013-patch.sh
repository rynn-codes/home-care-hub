cd /home/claude/joy && python3 - <<'EOF'
def patch(p, pairs):
    s=open(p).read()
    for old,new in pairs:
        assert s.count(old)==1,(p,old[:60],s.count(old))
        s=s.replace(old,new)
    open(p,'w').write(s)

patch('src/components/employees/EmployeeRecordView.tsx', [
('''import { EXCLUSION_LABELS, type EmployeeProfile } from "@/domain/employees/profile";
import { RecordHeader } from "@/components/records/RecordHeader";''',
 '''import { EXCLUSION_LABELS, isBilingual, relationshipLabel, spokenLanguages, type EmployeeProfile } from "@/domain/employees/profile";
import { RecordHeader } from "@/components/records/RecordHeader";
import { UndoChangeBanner } from "@/components/records/UndoChangeBanner";'''),
('''              onChange={(status) => setEmployeeStatus(employee.id, status)}''',
 '''              subject={employee.name}
              onChange={(status) => setEmployeeStatus(employee.id, status, employee.name)}'''),
('''      {/* The consequence, said before the detail. */}
      {!employable && (''','''      {/* Karynn, 29 September: a change stays undoable for the agency's window. */}
      <UndoChangeBanner kind="employee" entityId={employee.id} mayWrite={mayWrite} />

      {/* The consequence, said before the detail. */}
      {!employable && ('''),
('''              <Detail label="Phone (mobile)" value={p?.phoneMobile || employee.phone} />
              {p?.phoneHome && <Detail label="Phone (home)" value={p.phoneHome} />}''',
 '''              <Detail label="Phone (mobile)" value={p?.phoneMobile || employee.phone} />'''),
('''                  <Detail label="Preferred language" value={p.preferredLanguage} />''',
 '''                  <Detail
                    label="Languages"
                    value={
                      spokenLanguages(p).length
                        ? `${spokenLanguages(p).join(", ")}${isBilingual(p) ? " · Bilingual" : ""}`
                        : null
                    }
                  />'''),
('''                  <Detail label="Staff's license" value={p.staffLicense} />''',
 '''                  <Detail label="NPI or license #" value={p.staffLicense} />'''),
('''                          {[c.relationship, c.phone, c.address].filter(Boolean).join(" · ") || "No details recorded"}''',
 '''                          {[relationshipLabel(c), c.phone, c.address].filter(Boolean).join(" · ") || "No details recorded"}'''),
])

patch('src/components/clients/ClientRecordView.tsx', [
('''import { RecordHeader } from "@/components/records/RecordHeader";
import { ActivityFeed }''','''import { RecordHeader } from "@/components/records/RecordHeader";
import { UndoChangeBanner } from "@/components/records/UndoChangeBanner";
import { ActivityFeed }'''),
('''              label="Client status"
              options={CLIENT_STATUS_OPTIONS}
              onChange={(status, detail) =>
                setClientStatus({
                  clientPersonId: client.personId,
                  status,
                  note: detail.note,
                  lastServiceOn: detail.on,
                })
              }''','''              label="Client status"
              subject={client.name}
              options={CLIENT_STATUS_OPTIONS}
              onChange={(status, detail) =>
                setClientStatus({
                  clientPersonId: client.personId,
                  status,
                  note: detail.note,
                  lastServiceOn: detail.on,
                  name: client.name,
                })
              }'''),
('''      {/*
        Tabs are a second door into an area.
        ''','''      {/* Karynn, 29 September: a change stays undoable for the agency's window. */}
      <UndoChangeBanner kind="client" entityId={client.personId} mayWrite={mayWrite} />

      {/*
        Tabs are a second door into an area.
        '''),
])

# AgencyTab: the undo window setting, with the changes still inside it
patch('src/components/settings/AgencyTab.tsx', [
('''import { PROFIT_ROLE_CHOICES } from "@/domain/access/profitVisibility";
import { ROLE_LABELS } from "@/domain/consents/witness";''','''import { PROFIT_ROLE_CHOICES } from "@/domain/access/profitVisibility";
import { ROLE_LABELS } from "@/domain/consents/witness";
import { useDemo } from "@/context/DemoDataProvider";
import { canWrite } from "@/domain/access/roles";
import { isLatestForRecord, undoDeadline, undoableChanges } from "@/domain/records/profileChanges";
import { Undo2 } from "lucide-react";
import { toast } from "sonner";'''),
('''export function AgencyTab() {
  const agency = useAgencySettings();
''','''export function AgencyTab() {
  const agency = useAgencySettings();
  const { profileChanges, undoProfileChange, currentUser } = useDemo();
  const mayWrite = canWrite(currentUser.role);
  const undoable = undoableChanges(profileChanges, agency.profileUndoHours, new Date().toISOString());
  const fmtWhen = (iso: string) =>
    new Date(iso).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
'''),
('''        {/*
          Karynn, 28 September: "Option in settings to hide gross profit/net
          profit on scheduling to certain roles."''','''        {/*
          Karynn, 29 September: "a settings feature that allows changed info to
          client or employee profile is to stay for 72 hours in case we need to
          undo a change. We still would keep an audited trail of info changed."

          The window is hers to set. The list under it is every change still
          inside it, so a mistake can be put back from here as well as from the
          record — and a change that a later one has overtaken says so rather
          than offering an Undo that would take both away.
        */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="agency-undo-hours" className="text-[12.5px]">
            How long a profile change can be undone
          </Label>
          <div className="flex items-center gap-2">
            <input
              id="agency-undo-hours"
              type="number"
              min="1"
              step="1"
              value={agency.profileUndoHours}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (n > 0) setAgencyField("profileUndoHours", n);
              }}
              className="h-10 w-[110px] rounded-[9px] border border-[var(--hairline)] bg-[var(--paper)] px-3 text-[13px]"
            />
            <span className="text-[13px] text-muted-foreground">hours</span>
          </div>
          <p className="m-0 text-[12px] leading-[1.5] text-muted-foreground">
            A change to a client&apos;s or employee&apos;s profile or status can be put back exactly as it was, from the
            record or from the list below, until this long after it was made. The audit trail keeps every change
            and every undo whatever this is set to.
          </p>
          {undoable.length > 0 && (
            <ul className="m-0 mt-1 flex list-none flex-col gap-1.5 p-0">
              {undoable.map((c) => {
                const latest = isLatestForRecord(profileChanges, c);
                return (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[10px] border border-[var(--hairline)] bg-[var(--paper-sunken)] px-3 py-2 text-[12.5px]"
                  >
                    <span className="min-w-0 flex-1 [text-wrap:pretty]">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-muted-foreground"> · {c.what === "status" ? "status" : "profile"} · {c.summary}</span>
                      <span className="block text-[11.5px] text-muted-foreground">
                        {fmtWhen(c.changedAt)} by {c.changedBy} · until {fmtWhen(undoDeadline(c, agency.profileUndoHours))}
                      </span>
                    </span>
                    {!latest ? (
                      <span className="text-[11.5px] text-muted-foreground">Undo the later change first</span>
                    ) : mayWrite ? (
                      <button
                        type="button"
                        onClick={() => {
                          undoProfileChange(c.id);
                          toast(`${c.name}'s ${c.what === "status" ? "status" : "profile"} put back`, {
                            description: "The audit trail keeps both the change and the undo.",
                          });
                        }}
                        className="flex h-[28px] flex-none items-center gap-1.5 rounded-[8px] border border-[var(--hairline)] bg-[var(--paper)] px-2.5 text-[12px] font-medium text-primary transition-colors hover:bg-[var(--wash)]"
                      >
                        <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Undo
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/*
          Karynn, 28 September: "Option in settings to hide gross profit/net
          profit on scheduling to certain roles."'''),
])

# Employees page: the save toast offers Undo
patch('src/pages/Employees.tsx', [
('''          onSave={(profile) => {
            saveEmployee(editing?.id ?? null, profile);
            toast.success(`${profile.firstName} ${profile.lastName} saved`);
            setEditing(null);
          }}''','''          onSave={(profile) => {
            saveEmployee(editing?.id ?? null, profile);
            toast.success(`${profile.firstName} ${profile.lastName} saved`, {
              description: `Can be undone from the record for ${undoHours} hours.`,
            });
            setEditing(null);
          }}'''),
('''              description: editing?.id
                ? undefined
                : "No credentials on file yet — their compliance reads as outstanding until documents are added.",''',
 '''              description: editing?.id
                ? `Can be undone from the record for ${undoHours} hours.`
                : "No credentials on file yet — their compliance reads as outstanding until documents are added.",'''),
('''  const { newHires, currentUser, saveEmployee, deleteEmployee, restoreDeleted } = demo;
  const mayWrite = canWrite(currentUser.role);''','''  const { newHires, currentUser, saveEmployee, deleteEmployee, restoreDeleted } = demo;
  const mayWrite = canWrite(currentUser.role);
  const { profileUndoHours: undoHours } = useAgencySettings();'''),
])
EOF
grep -n "agencyStore\|^import" src/pages/Employees.tsx | head -30