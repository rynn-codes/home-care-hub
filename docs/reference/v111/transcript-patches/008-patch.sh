cd /home/claude/joy && python3 - <<'EOF'
def patch(p, pairs):
    s=open(p).read()
    for old,new in pairs:
        assert s.count(old)==1,(p,old[:60],s.count(old))
        s=s.replace(old,new)
    open(p,'w').write(s)

patch('src/components/employees/EmployeePeek.tsx', [
('''                {profile.phoneMobile || profile.phoneHome ? (
                  <a
                    href={`tel:${(profile.phoneMobile || profile.phoneHome).replace(/[^\\d+]/g, "")}`}''',
'''                {profile.phoneMobile ? (
                  <a
                    href={`tel:${profile.phoneMobile.replace(/[^\\d+]/g, "")}`}'''),
('''                    {profile.phoneMobile || profile.phoneHome}''','''                    {profile.phoneMobile}'''),
])
patch('src/lib/employeeRoster.ts', [
('''    phone: profile.phoneMobile || profile.phoneHome || null,''','''    phone: profile.phoneMobile || null,'''),
])
patch('src/pages/Employees.tsx', [
('''      phone: e.profile?.phoneMobile || e.profile?.phoneHome || e.phone || null,''','''      phone: e.profile?.phoneMobile || e.phone || null,'''),
('''        title="Employees"
        description={`Everyone on staff — role, status and current assignments. ${rows.length} total · ${counts.active} active.`}
''','''        title="Employees"
        /* Karynn, 29 September: "Take off text 'Everyone on staff' under the employee title." */
        description={undefined}
'''),
])
patch('src/pages/Clients.tsx', [
('''        onAdd={() =>
          toast.info("Clients are added through Admissions.", {
            description: "A referral becomes a client when the admission is approved.",
          })
        }''','''        /*
          Karynn, 29 September: "The add client button, what was the previous
          function of it?" It only said, in a toast, that clients are added
          through Admissions — a button that explains why it does nothing. Now
          it goes there, and says so once it has arrived.
        */
        onAdd={() => {
          navigate("/admissions");
          toast.info("Clients are added through Admissions.", {
            description: "Start a referral here — it becomes a client when the admission is approved.",
          });
        }}'''),
])
EOF