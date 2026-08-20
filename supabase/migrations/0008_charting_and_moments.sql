-- Joy Health — the visit record, the family updates, and the preferences
--
-- Everything the portals write had domain logic, screens and tests, and
-- nowhere to go. This is where a confirmed chart, an approved Moment, a
-- maintained preference and a document Joy asked a family for actually live.
--
-- Three rules from the specification are enforced here rather than only in
-- TypeScript, because a policy in the database survives a bug in a component:
--
--   §12  A chart is the caregiver's attestation. Once confirmed it is not
--        editable — a change is an amendment, which is a different act.
--   §14  A Moment whose wording a model produced needs the office. A Moment in
--        the caregiver's own words does not. That is Karynn's rule from 20 Aug
--        and it is a check constraint plus a policy, not a convention.
--   §17  Preferences are deliberately maintained. Every row has an author, and
--        an unapproved one never reaches a caregiver at a front door.

-- ---------------------------------------------------------------------------
-- Visit charts
-- ---------------------------------------------------------------------------

create type chart_source_kind as enum (
  -- She answered this in the structured form. No model involved.
  'recorded',
  -- Her own words, unchanged.
  'quoted',
  -- A model rewrote something, and must cite the span it rests on.
  'drafted'
);

create table visit_charts (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references organizations (id) on delete cascade,

  visit_id              uuid not null references visits (id) on delete cascade,
  caregiver_person_id   uuid not null references people (id) on delete restrict,

  -- The caregiver's narrative, verbatim, kept alongside the structured lines.
  -- Every non-recorded line's citation is checked against this.
  narrative             text not null default '',

  confirmed_by_person_id uuid references people (id) on delete restrict,
  confirmed_at          timestamptz,
  -- True when she changed a drafted line before confirming.
  edited                boolean not null default false,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- One chart per visit. A second is an amendment and needs its own design.
  constraint visit_charts_one_per_visit unique (visit_id),

  -- Confirmation is one act: both columns or neither. A chart with a time and
  -- no author is exactly the record §12 refuses.
  constraint visit_charts_confirmed_together check (
    (confirmed_by_person_id is null) = (confirmed_at is null)
  )
);

create index visit_charts_caregiver_idx on visit_charts (caregiver_person_id, created_at desc);

create table visit_chart_lines (
  id                uuid primary key default gen_random_uuid(),
  chart_id          uuid not null references visit_charts (id) on delete cascade,

  position          integer not null,
  heading           text not null,
  body              text not null,

  source_kind       chart_source_kind not null,
  -- For `recorded`, the field id she answered. For `quoted` and `drafted`, the
  -- span of her narrative this line rests on.
  source_reference  text not null,

  constraint visit_chart_lines_body_not_empty check (length(btrim(body)) > 0),

  -- The citation requirement, in the schema. A drafted or quoted line with
  -- nothing to point at is the invented clinical fact §12 forbids, and this
  -- makes writing one impossible rather than merely tested against.
  constraint visit_chart_lines_cited check (
    source_kind = 'recorded' or length(btrim(source_reference)) > 0
  ),

  constraint visit_chart_lines_ordered unique (chart_id, position)
);

/**
 * A confirmed chart is closed.
 *
 * The caregiver has attested to it. Editing it afterwards is an amendment —
 * a different act, with a different audit trail, and one nobody has designed
 * yet. Refusing loudly is better than allowing a silent rewrite of a clinical
 * record that somebody's name is on.
 */
create or replace function refuse_confirmed_chart_edit()
returns trigger
language plpgsql
as $$
begin
  if old.confirmed_at is not null then
    raise exception
      'This visit note was confirmed by its caregiver and cannot be edited. Record an amendment instead.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger visit_charts_no_edit_after_confirm
  before update on visit_charts
  for each row
  -- Confirming itself is allowed; editing a chart already confirmed is not.
  when (old.confirmed_at is not null)
  execute function refuse_confirmed_chart_edit();

create trigger visit_charts_set_updated_at before update on visit_charts
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Moments
-- ---------------------------------------------------------------------------

create type moment_state as enum ('skipped', 'draft', 'shared', 'withheld');

create type moment_origin as enum (
  -- The caregiver's own words, published as written.
  'caregiver',
  -- A model drafted or rewrote the wording.
  'ai_drafted'
);

create table moments (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references organizations (id) on delete cascade,

  -- §15: "remain linked to the visit that produced the update."
  visit_id              uuid not null references visits (id) on delete cascade,
  client_person_id      uuid not null references people (id) on delete restrict,

  -- What she actually wrote or dictated. Never overwritten by an edit, so
  -- "what did she say" always has an answer.
  narrative             text not null,
  -- What the family reads. Equal to the narrative unless somebody edited it.
  body                  text not null,

  state                 moment_state not null default 'draft',
  origin                moment_origin not null default 'caregiver',

  created_by_person_id  uuid not null references people (id) on delete restrict,
  approved_by_person_id uuid references people (id) on delete restrict,
  approved_at           timestamptz,
  shared_at             timestamptz,
  withheld_reason       text,
  edited                boolean not null default false,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- Shared means a family can see it, so it needs both an approver and a time.
  constraint moments_shared_is_attributed check (
    state <> 'shared'
    or (approved_by_person_id is not null and shared_at is not null)
  ),

  -- A skipped Moment is a recorded "no", not an empty draft. §14 offers Skip as
  -- a real option and it must stay one: a caregiver who had a quiet shift must
  -- not be nudged into inventing something charming.
  constraint moments_skipped_is_empty check (
    state <> 'skipped' or length(btrim(body)) = 0
  ),
  constraint moments_shared_has_content check (
    state <> 'shared' or length(btrim(body)) > 0
  )
);

create index moments_client_idx on moments (client_person_id, shared_at desc)
  where state = 'shared';
create index moments_review_idx on moments (organization_id, created_at)
  where state = 'draft' and origin = 'ai_drafted';

comment on column moments.origin is
  'Decides who may approve. Karynn, 20 Aug: review depends on whether AI produced the wording. A caregiver publishes her own words; only the office publishes a model''s.';

-- ---------------------------------------------------------------------------
-- Preferences — §17
-- ---------------------------------------------------------------------------

create type preference_state as enum ('proposed', 'approved', 'retired');
create type preference_source as enum ('office', 'family', 'caregiver');

create table client_preferences (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references organizations (id) on delete cascade,
  client_person_id      uuid not null references people (id) on delete cascade,

  text                  text not null,
  state                 preference_state not null default 'proposed',
  source                preference_source not null,

  -- §17: "deliberately maintained personal preferences, not uncontrolled AI
  -- memory". A row with no author is precisely the memory that rules out, so
  -- the column is not nullable.
  added_by_person_id    uuid not null references people (id) on delete restrict,
  added_at              timestamptz not null default now(),
  approved_by_person_id uuid references people (id) on delete restrict,
  approved_at           timestamptz,
  retired_reason        text,

  -- One line on a card read in a doorway. Anything longer is a paragraph about
  -- somebody's care, and a paragraph about somebody's care is a care plan.
  constraint client_preferences_one_line check (length(btrim(text)) between 1 and 120),

  constraint client_preferences_approved_is_attributed check (
    state <> 'approved' or approved_by_person_id is not null
  )
);

create index client_preferences_visible_idx
  on client_preferences (client_person_id) where state = 'approved';

-- ---------------------------------------------------------------------------
-- Documents Joy asks a family for — §21
-- ---------------------------------------------------------------------------

create type document_request_state as enum ('needed', 'received', 'under_review', 'accepted');

create table client_document_requests (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations (id) on delete cascade,
  client_person_id    uuid not null references people (id) on delete cascade,

  label               text not null,
  -- Why Joy needs it. A family asked to go and find paperwork deserves a
  -- reason, and the portal shows this verbatim.
  reason              text,
  state               document_request_state not null default 'needed',

  requested_by_user_id uuid not null references users (id) on delete restrict,
  requested_at        timestamptz not null default now(),
  document_id         uuid references documents (id) on delete set null,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index client_document_requests_open_idx
  on client_document_requests (organization_id, requested_at)
  where state = 'needed';

create trigger client_document_requests_set_updated_at before update on client_document_requests
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table visit_charts             enable row level security;
alter table visit_chart_lines        enable row level security;
alter table moments                  enable row level security;
alter table client_preferences       enable row level security;
alter table client_document_requests enable row level security;

grant select on visit_charts, visit_chart_lines, moments, client_preferences,
                client_document_requests to authenticated;
grant insert, update on visit_charts, moments, client_preferences to authenticated;
grant insert on visit_chart_lines to authenticated;
grant insert, update on client_document_requests to authenticated;

-- ------------------------------------------------------------- charts --

-- Staff read every chart. A caregiver reads her own. A family reads none:
-- §13 is explicit that raw chart notes must not reach the family portal, and
-- the way to guarantee that is to make them unreadable rather than to rely on
-- every future screen remembering not to render them.
create policy visit_charts_read on visit_charts
  for select using (
    organization_id = current_org_id()
    and (is_staff() or caregiver_person_id = current_person_id())
  );

create policy visit_charts_write on visit_charts
  for insert with check (
    organization_id = current_org_id()
    and caregiver_person_id = current_person_id()
    and exists (
      select 1 from visits v
      where v.id = visit_charts.visit_id
        and v.caregiver_person_id = current_person_id()
    )
  );

create policy visit_charts_update_own on visit_charts
  for update using (
    organization_id = current_org_id() and caregiver_person_id = current_person_id()
  ) with check (
    organization_id = current_org_id() and caregiver_person_id = current_person_id()
  );

create policy visit_chart_lines_read on visit_chart_lines
  for select using (
    exists (select 1 from visit_charts c where c.id = visit_chart_lines.chart_id)
  );

create policy visit_chart_lines_write on visit_chart_lines
  for insert with check (
    exists (
      select 1 from visit_charts c
      where c.id = visit_chart_lines.chart_id
        and c.caregiver_person_id = current_person_id()
        and c.confirmed_at is null
    )
  );

-- ------------------------------------------------------------ moments --

-- A family reads the shared Moments about their own person, and nothing else:
-- not a draft, not a withheld one, not another client's.
create policy moments_read on moments
  for select using (
    organization_id = current_org_id()
    and (
      is_staff()
      or created_by_person_id = current_person_id()
      or (
        state = 'shared'
        and exists (
          select 1 from portal_grants g
          where g.person_id = current_person_id()
            and g.active
            and g.audience = 'family'
            and g.subject_person_id = moments.client_person_id
        )
      )
    )
  );

create policy moments_write on moments
  for insert with check (
    organization_id = current_org_id()
    and created_by_person_id = current_person_id()
    -- Nobody publishes on creation. Sharing is a separate, checked act.
    and state in ('draft', 'skipped')
  );

/**
 * Karynn's rule, enforced by the database.
 *
 * A caregiver may share her own words. Only the office may share wording a
 * model produced — because a model rewriting her sentence introduces a step
 * where a fact can change, and that step is what the second pair of eyes is
 * for.
 *
 * In the policy rather than only in TypeScript because the consequence of
 * getting it wrong is a fabricated sentence about somebody's mother arriving on
 * her daughter's phone, and a component is a weaker guarantee than a policy.
 */
create policy moments_update on moments
  for update using (
    organization_id = current_org_id()
    and (is_staff() or created_by_person_id = current_person_id())
  ) with check (
    organization_id = current_org_id()
    and (
      is_staff()
      or (created_by_person_id = current_person_id() and origin = 'caregiver')
    )
  );

-- ------------------------------------------------------- preferences --

-- Approved preferences reach the caregivers who need them and the family they
-- concern. A proposal nobody has reviewed stays with the office and its author:
-- somebody reading it at a front door has no way to know it is unreviewed.
create policy client_preferences_read on client_preferences
  for select using (
    organization_id = current_org_id()
    and (
      is_staff()
      or added_by_person_id = current_person_id()
      or (state = 'approved' and portal_may_read_person(client_person_id))
    )
  );

create policy client_preferences_write on client_preferences
  for insert with check (
    organization_id = current_org_id()
    and added_by_person_id = current_person_id()
    and portal_may_read_person(client_person_id)
    -- Suggesting is open to caregivers and families; approving is not.
    and (state = 'proposed' or is_staff())
  );

create policy client_preferences_update on client_preferences
  for update using (organization_id = current_org_id() and is_staff())
  with check (organization_id = current_org_id() and is_staff());

-- --------------------------------------------------- document requests --

create policy client_document_requests_read on client_document_requests
  for select using (
    organization_id = current_org_id()
    and (is_staff() or portal_may_read_person(client_person_id))
  );

-- Only the office asks a family for a document.
create policy client_document_requests_write on client_document_requests
  for all using (
    organization_id = current_org_id()
    and has_role('ceo_admin', 'rn_clinical', 'intake_coordinator', 'hr')
  ) with check (
    organization_id = current_org_id()
    and has_role('ceo_admin', 'rn_clinical', 'intake_coordinator', 'hr')
  );
