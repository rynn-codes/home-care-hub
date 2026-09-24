cd /tmp/claude-0/-home-claude-repo/d2433efc-dba1-5080-a930-43a82e41e69f/scratchpad && python3 - <<'EOF'
p='joy-hipaa-map.html'
s=open(p).read()
old='''  <section>
    <span class="eyebrow">Beyond the agreements</span>'''
new='''  <section>
    <span class="eyebrow">If Supabase is too expensive</span>
    <h2>Four ways to run the same database for less</h2>
    <p>Supabase only signs a BAA at Team and above, so its $25 Pro plan is not an option for real client data. Everything below is a real alternative. What changes between them is how much of the developer's finished work survives, and who carries the maintenance.</p>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Option</th><th>Monthly</th><th>What survives</th><th>What it costs you instead</th></tr></thead>
        <tbody>
          <tr>
            <td>Self-host Supabase on AWS<span class="sub">Supabase is open source; run it on one EC2 or Lightsail server under the free AWS BAA</span></td>
            <td class="cost">$50–100</td>
            <td>All of it. Same database, sign-in, storage, functions and policies, unchanged. The app cannot tell the difference.</td>
            <td>Joshua owns backups, security patches, upgrades and monitoring. Those are HIPAA obligations, so they must be written into your policies and actually done. Best value if he is comfortable running a server.</td>
          </tr>
          <tr>
            <td>Managed Postgres on a big cloud<span class="sub">AWS RDS, Google Cloud SQL or Azure, all with a free BAA</span></td>
            <td class="cost">$30–80</td>
            <td>The schema, the row policies and the audit trail carry straight over. Postgres is Postgres.</td>
            <td>Sign-in, the auto-generated API, file storage and server functions all have to be rebuilt on that cloud's own services. Several weeks of developer time.</td>
          </tr>
          <tr>
            <td>Neon or another Postgres host with a BAA<span class="sub">Neon offers HIPAA on its higher plans</span></td>
            <td class="cost">$70–250</td>
            <td>Same as above: the database layer only.</td>
            <td>Same rebuild of sign-in and API, and the BAA tier is not much cheaper than Supabase once you add an auth vendor that also signs one.</td>
          </tr>
          <tr>
            <td>Supabase Team<span class="sub">The managed route on the page above</span></td>
            <td class="cost">$599 + add-on</td>
            <td>All of it, with Supabase doing the backups, patching and uptime.</td>
            <td>The money. Nothing else.</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="callout info">
      <p><b>Where that leaves the decision.</b> The price does not scale with clients, so Team is expensive at seven clients and cheap at seventy. If the bill is the problem now, self-hosting Supabase on AWS is the honest cheaper answer: same code, roughly a tenth of the cost, and the free AWS BAA you were signing anyway. The trade is that Joshua becomes the person responsible for backups and patches, and a lapse there is a compliance failure, not just an outage. Start self-hosted if he is up for it and move to Team when the client count justifies the bill, or the other way round. Nothing in the code has to change either way.</p>
    </div>
  </section>

  <section>
    <span class="eyebrow">Beyond the agreements</span>'''
assert s.count(old)==1
s=s.replace(old,new)
s=s.replace('<span class="v">≈ $650–800 / mo</span><span class="s">Almost all of it is the Supabase Team plan. Usage on top is small at Joy\'s size.</span>',
            '<span class="v">≈ $650–800 / mo</span><span class="s">Almost all of it is the Supabase Team plan. Self-hosting Supabase on AWS brings it to about $100; see below.</span>')
open(p,'w').write(s)
EOF