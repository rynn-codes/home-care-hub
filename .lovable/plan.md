
# Home Care Dashboard — Prototype Plan

A clean, modern home care operations dashboard inspired by Careswitch. This first build is a polished visual prototype using realistic mock data, structured so that swapping in Lovable Cloud (auth + database) later is straightforward.

## Visual Style

- Light theme, generous whitespace, soft shadows, rounded corners
- Sidebar navigation (collapsible to icon-only) with a top header bar
- Calm blue/teal accent on white surfaces; muted grays for secondary text
- Inter as the primary typeface; consistent spacing scale via Tailwind
- All colors defined as semantic HSL tokens in `index.css` so the theme can be retuned in one place

## App Shell

- Persistent left sidebar with grouped navigation
- Top header: sidebar toggle, global search, notifications bell, user avatar menu
- Main content area renders the active route

### Sidebar groups
1. Overview — Dashboard
2. Operations — Clients, Employees, Scheduling, Billing
3. Insights — Reports
4. Company — Documents, Goal Tracker
5. Knowledge — SOPs
6. Settings

## Pages

### 1. Dashboard (home)
- Four KPI cards: Active Clients, Active Caregivers, Weekly Hours, plus a fourth (e.g., This Week's Revenue) for visual balance
- Mini month calendar with shift dots on days that have scheduled visits; clicking a day filters the day view
- Today's Shifts panel — list of visits with caregiver, client, time window, and status chip (Scheduled / Clocked In / Completed / Missed)
- Alerts & Tasks panel — missed clock-ins, expiring credentials, unassigned shifts, expiring care plans
- Recent Activity feed — new clients, completed shifts, uploaded documents, goal updates

### 2. Clients
- Table with search, status filter, and "Add Client" button
- Columns: name + avatar, status, primary caregiver, care plan, hours/week, address, actions
- Row click opens a client detail drawer/page with tabs: Profile, Care Plan, Schedule, Documents, Notes, Billing

### 3. Employees (Caregivers)
- Table with search, role filter, "Add Employee"
- Columns: name + avatar, role, status, hours this week, credentials status (with warnings for expiring), assigned clients
- Detail drawer: Profile, Credentials, Schedule, Time Off, Performance

### 4. Scheduling
- Week view calendar grid: caregivers down the left, days across the top, shift blocks in cells
- View toggles: Day / Week / Month; filters by caregiver, client, or status
- Click empty cell to create a shift; click a shift to edit, reassign, or cancel
- Side panel for unassigned shifts that can be dragged onto the grid

### 5. Billing
- Tabs: Invoices, Payroll, Payers
- Invoices: list with status (Draft / Sent / Paid / Overdue), amount, client, period, actions
- Payroll: per-employee hours and pay for the period, export button
- Payers: list of insurance providers / private payers with contact info and rate sheets
- Summary cards on top: Outstanding, Paid this month, Upcoming payroll

### 6. Reports
- Grid of report cards: Hours by Caregiver, Revenue by Client, Visit Compliance, Overtime Trends, Client Retention
- Each card opens a detail view with a chart (line/bar/pie via Recharts) and a data table
- Date range selector and export-to-CSV button

### 7. Company → Documents
- Folder tree on the left; file list on the right
- Upload area, search, filter by type/owner
- Per-file row: name, type, owner, uploaded date, permissions chip, actions (preview, download, share, delete)
- Permission model in the UI: Everyone / Admins / Specific roles (mock-enforced)

### 8. Company → Goal Tracker
- Goals list with progress bars, owner, due date, status (On Track / At Risk / Off Track / Done)
- Each goal expands to show milestones (checklist with due dates) and assignees
- "New Goal" dialog with title, description, owner, milestones, target date
- Filter by owner, status, quarter

### 9. SOPs
- Sidebar of categories (Onboarding, Care Procedures, Compliance, Emergency, etc.)
- Article list per category with title, last updated, version, owner
- Article view with rich-text content, table of contents, version history panel
- Rich-text editor for create/edit (TipTap) with versioning — saving creates a new version entry; previous versions can be viewed and restored

### 10. Settings
- Tabs: Organization, Branding, Roles & Permissions, Notifications, Integrations, Billing Plan
- Form sections with save buttons; mock-only persistence in this prototype

### 11. NotFound (existing)

## Mock Data

A single `src/lib/mockData.ts` (or split per domain) seeds:
- ~25 clients, ~15 caregivers, ~80 shifts across the current week, ~12 invoices, ~30 documents, ~8 goals, ~20 SOPs
- Simple in-memory stores via React context + `useState` so create/edit/delete feel real during the session

## Technical Notes

- Routing: React Router with a layout route that renders the sidebar shell and an `<Outlet />` for child pages
- UI: shadcn components already in the project (sidebar, table, dialog, drawer, tabs, calendar, popover, form, chart)
- Charts: Recharts via `components/ui/chart.tsx`
- Rich text (SOPs): add TipTap (`@tiptap/react`, `@tiptap/starter-kit`)
- Drag & drop (Scheduling unassigned shifts): `@dnd-kit/core`
- Date utilities: `date-fns` (already a transitive dep via shadcn)
- Design tokens: extend `index.css` with semantic HSL variables (brand, success, warning, danger, info, surface levels) and map them in `tailwind.config.ts`
- Folder layout:
  ```text
  src/
    components/
      layout/        AppShell, AppSidebar, AppHeader
      dashboard/     KpiCard, MiniCalendar, TodayShifts, Alerts, Activity
      clients/ employees/ scheduling/ billing/ reports/
      company/       Documents, GoalTracker
      sops/          SopList, SopEditor, VersionHistory
      settings/
    pages/           Dashboard, Clients, Employees, Scheduling, Billing,
                     Reports, Documents, Goals, Sops, Settings, NotFound
    lib/             mockData.ts, formatters.ts
    context/         DataProvider.tsx
  ```

## Out of Scope (for now)

- Real authentication, user accounts, and database persistence (planned follow-up via Lovable Cloud)
- Real file uploads to storage (UI accepts files but keeps them in-memory)
- Email/SMS notifications, payment processing, payroll exports to real systems
- Mobile caregiver app / clock-in geofencing

## Follow-up (after this prototype)

1. Enable Lovable Cloud, add auth (email + roles: admin, scheduler, caregiver, billing)
2. Model tables: clients, employees, shifts, invoices, documents, goals, sops, sop_versions, user_roles
3. Replace mock context with Supabase queries; add RLS policies using a `has_role` security-definer function
4. Wire real file storage for Documents and SOP attachments
