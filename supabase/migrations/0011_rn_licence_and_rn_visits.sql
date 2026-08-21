-- Joy Health — the RN licence, the office's copy, and the visit within 24 hours
--
-- Four things Karynn said on 21 August, and the schema each one needs.
--
--   "Incidents are important and myself/admin/operational staff needs to know
--    about an incident report."
--   "It needs to be logged on the yearly incident report."
--   "Depending on what it is, an RN visit needs to be made within 24 hours."
--   "Supervisory visits can only be done by an RN."
--
-- The last of those is the one that changed a model rather than a rule.

-- ---------------------------------------------------------------------------
-- Being a registered nurse is not a job title
-- ---------------------------------------------------------------------------

-- 0010 let an RN *or* the owner record a supervisory visit, by role, copied
-- from the consent witness rule. Narrowing that to `rn_clinical` alone would
-- have locked Karynn out of the one task she personally does: her user row says
-- `ceo_admin`, and she is the owner AND the nurse.
--
-- `user_role` cannot say both, and it should not have to. It describes a job at
-- Joy — who somebody reports to, what screens they open. An RN licence is
-- issued by the Texas Board of Nursing to a person, it has a number, and it
-- expires. Conflating the two means Joy cannot express "the owner, who is also
-- a nurse", or "a second RN hired next year who is not the clinical manager",
-- or the one that actually bites: "an RN whose licence lapsed last month and
-- must stop doing supervisory visits today".

alter table users
  add column rn_licence_number   text,
  add column rn_licence_state    text,
  add column rn_licence_expires  date;

alter table users
  add constraint users_rn_licence_is_complete check (
    -- All three or none. A number with no expiry cannot be checked, which makes
    -- it worse than nothing: it looks like a credential and enforces nothing.
    (rn_licence_number is null and rn_licence_state is null and rn_licence_expires is null)
    or (rn_licence_number is not null and rn_licence_state is not null and rn_licence_expires is not null)
  );

comment on column users.rn_licence_expires is
  'A lapsed licence is not a licence. Every rule that asks "is this person an RN" compares against this date, never against users.role.';

/**
 * Does this user hold a current RN licence?
 *
 * The single place the question is answered in SQL, so a rule cannot drift into
 * asking about a role instead. Mirrors isRegisteredNurse() in
 * src/domain/clinical/registeredNurse.ts.
 */
create or replace function user_is_rn(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from users u
    where u.id = target
      and u.rn_licence_expires is not null
      and u.rn_licence_expires >= current_date
  );
$$;

-- Supervisory visits: an RN, and only an RN.
--
-- Replaces the role check from 0010. The message names the reason rather than
-- the rule, because somebody who did this work last month and cannot today will
-- assume the software is broken.
create or replace function supervisory_visit_completer_is_clinical()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.completed_by_user_id is null then
    return new;
  end if;

  if not user_is_rn(new.completed_by_user_id) then
    raise exception
      'A supervisory visit is carried out by a registered nurse. No current RN licence is on file for this user.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- Care plan sign-off keeps the wider rule on purpose.
--
-- Karynn's sentence was about supervisory visits. She has said separately that
-- an RN or the Admin/Owner may take a client's signature, and reviewing a plan
-- of care sits with that. Narrowing it here on the strength of a sentence about
-- something else would be inventing a rule she did not give — so the care plan
-- trigger from 0010 is left alone, and this comment records that it was a
-- decision rather than an oversight.

-- ---------------------------------------------------------------------------
-- The RN visit within 24 hours
-- ---------------------------------------------------------------------------

-- A notification and a visit are different obligations, and 0010 could only
-- record the first. Telling the RN by phone at eleven at night is not somebody
-- going out to look at the client, and an incident list that tracked only the
-- call showed a fall as fully handled when nobody had seen the person since.

alter table incidents
  add column rn_visit_due_by       timestamptz,
  add column rn_visit_done_at      timestamptz,
  add column rn_visit_by_user_id   uuid references users (id) on delete restrict,
  add column rn_visit_findings     text;

alter table incidents
  add constraint incidents_rn_visit_is_complete check (
    rn_visit_done_at is null
    or (rn_visit_by_user_id is not null and length(btrim(coalesce(rn_visit_findings, ''))) > 0)
  );

alter table incidents
  add constraint incidents_rn_visit_needs_a_deadline check (
    rn_visit_done_at is null or rn_visit_due_by is not null
  );

create index incidents_rn_visit_pending_idx on incidents (rn_visit_due_by)
  where rn_visit_due_by is not null and rn_visit_done_at is null;

comment on column incidents.rn_visit_due_by is
  'Karynn, 21 August: an RN visit within 24 hours for the kinds that need one. Computed from reported_at, never from classification — an incident nobody classified until Monday does not get a fresh 24 hours on Monday.';

-- Only an RN records it, for the same reason as a supervisory visit.
create or replace function incident_rn_visit_is_by_an_rn()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.rn_visit_by_user_id is not null and not user_is_rn(new.rn_visit_by_user_id) then
    raise exception
      'An RN visit is recorded by a registered nurse. No current RN licence is on file for this user.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger incidents_rn_visit_is_by_an_rn
  before insert or update on incidents
  for each row execute function incident_rn_visit_is_by_an_rn();

-- An incident cannot close while a nurse still has to see the client.
--
-- Extends the pending-notifications trigger from 0010 rather than adding a
-- second one, so the two conditions cannot be checked in different orders and
-- report different reasons for the same refusal.
create or replace function refuse_close_with_pending_notifications()
returns trigger
language plpgsql
as $$
declare
  pending integer;
begin
  if new.state = 'closed' and old.state is distinct from 'closed' then
    select count(*) into pending
    from incident_notifications
    where incident_id = new.id and done_at is null;

    if pending > 0 then
      raise exception
        'Somebody still has to be told about this incident (% outstanding). Record that first.', pending
        using errcode = 'check_violation';
    end if;

    if new.rn_visit_due_by is not null and new.rn_visit_done_at is null then
      raise exception
        'An RN still has to see this client. Record that visit before closing the incident.'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- The office hears about every incident
-- ---------------------------------------------------------------------------

-- Karynn: "myself/admin/operational staff needs to know about an incident
-- report." Note where this sits — not in the per-kind policy the application
-- holds, because a kind is decided later, so a policy row could not fire until
-- somebody had already looked. That was the hole: an incident reported at ten
-- at night and unclassified until morning carried no obligation to anybody.
--
-- So the row is created with the incident. A trigger rather than a default,
-- because it belongs in a second table.
-- SECURITY DEFINER, and this is the case it exists for.
--
-- A caregiver reports the incident from her phone. She may not write
-- notification rows — that is staff-only in 0010, and rightly: who the office
-- told and when is the office's record. But her report is exactly what must
-- create the office's obligation, so the trigger has to do something she
-- cannot. Running as the invoker made her insert fail with an RLS violation,
-- which would have meant a caregiver simply could not report an incident.
create or replace function tell_the_office()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into incident_notifications (incident_id, party, due_by)
  values (new.id, 'administrator', new.reported_at + interval '1 hour')
  -- Idempotent: a caller that already inserted it (the application does) is not
  -- an error, and the unique index would otherwise turn a correct write into a
  -- failed one.
  on conflict (incident_id, party) do nothing;
  return new;
end;
$$;

create trigger incidents_tell_the_office
  after insert on incidents
  for each row execute function tell_the_office();

-- ---------------------------------------------------------------------------
-- The yearly incident report
-- ---------------------------------------------------------------------------

-- Karynn: "It needs to be logged on the yearly incident report."
--
-- Deliberately a VIEW and not a table. A register kept alongside the incidents
-- drifts from them — somebody edits an incident and the log still says what it
-- said last March — and the copy handed to a surveyor is then the one that
-- drifted. This cannot disagree with the incidents because it is the incidents.
--
-- Keyed on when each incident was REPORTED. One reported on 30 December and
-- closed in January belongs to the year it happened in; filing it under the
-- close date moves a bad December into a clean January.
create view annual_incident_log as
select
  i.organization_id,
  extract(year from i.reported_at)::int          as year,
  i.id,
  i.reported_at::date                            as reported_on,
  i.client_person_id,
  i.reported_by_person_id,
  i.narrative,
  i.kind,
  i.severity,
  i.state,
  i.findings,
  i.action,
  i.closed_at,

  -- Did Joy do what it said it would, each time?
  (
    select count(*) from incident_notifications n
    where n.incident_id = i.id and n.done_at is null
  )                                              as notifications_never_made,
  (
    select count(*) from incident_notifications n
    where n.incident_id = i.id and n.done_at is not null and n.done_at > n.due_by
  )                                              as notifications_late,

  (i.rn_visit_due_by is not null)                as rn_visit_required,
  (i.rn_visit_done_at is not null and i.rn_visit_done_at <= i.rn_visit_due_by)
                                                 as rn_visit_on_time
from incidents i;

comment on view annual_incident_log is
  'The yearly incident register, computed rather than kept. A register that lists what happened without saying whether the agency did what it said it would do lets an agency look diligent through a bad year — so each row carries whether the obligations were met.';

-- A view does not inherit the base table's policies unless it is asked to, and
-- `security_invoker` is what asks: the reader''s own permissions apply, so the
-- incidents policies from 0010 govern this exactly as they govern the table.
-- Without it the view would run as its owner and become a way around RLS.
alter view annual_incident_log set (security_invoker = on);

grant select on annual_incident_log to authenticated;
