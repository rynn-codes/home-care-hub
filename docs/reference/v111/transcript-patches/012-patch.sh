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
('''      {/*
        Tabs are a second door into an area.''','''      {/* Karynn, 29 September: a change stays undoable for the agency's window. */}
      <UndoChangeBanner kind="employee" entityId={employee.id} mayWrite={mayWrite} />

      {/*
        Tabs are a second door into an area.'''),
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
EOF
grep -n "Tabs are a second door" src/components/employees/EmployeeRecordView.tsx src/components/clients/ClientRecordView.tsx