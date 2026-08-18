# Claude Design mockups

The approved visual designs for Joy Health, vendored so they survive. They were
previously only in a session scratchpad, which is discarded when the container
is reclaimed — the Clients build nearly went ahead without them for that reason.

`.dc.html` files are the designs themselves; the `.png` files are the handoff
screenshots of each. `support.js` is the small runtime they share.

## Viewing them

The designs load React and Babel from unpkg at runtime, so they need network
access:

```
python3 -m http.server 8000 --directory docs/mockups
```

Then open `http://localhost:8000/Joy Health Clients.dc.html`.

In a sandbox with no CDN access, point `support.js` at local copies instead:

```
npm pack @babel/standalone@7.29.0        # then extract package/babel.min.js
cp node_modules/react/umd/react.production.min.js      docs/mockups/react.js
cp node_modules/react-dom/umd/react-dom.production.min.js docs/mockups/react-dom.js
sed -i 's|https://unpkg.com/@babel/standalone@7.29.0/babel.min.js|./babel.js|;
        s|https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js|./react-dom.js|;
        s|https://unpkg.com/react@18.3.1/umd/react.production.min.js|./react.js|' docs/mockups/support.js
```

Revert `support.js` afterwards — the CDN version is what was handed off.

## Where they disagree with the written specs

The designs are not a second source of truth; §1 of the kickoff brief makes the
Codex Engineering Kickoff governing. Where they conflict, the conflict is
recorded in the build audit rather than resolved silently by whoever writes the
code. Two rulings so far:

| Conflict | Ruled |
|---|---|
| Consent signing — the design has no way to decline a consent | Design wrong. Agree / Decline / N-A on each, per §19. Finding F4 |
| Navigation — the design puts Clients and Employees at the top level; §6 and §10 file clients under People | Design right. Karynn, 18 Aug: People is the general contact list, clients are their own destination |

## Screens with no code yet

`Joy Health Hiring`, `Joy Health Employees` and `Joy Health Billing` are
designed but unbuilt. Billing has no sprint in the roadmap at all — finding F26.
