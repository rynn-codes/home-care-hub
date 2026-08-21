-- Joy Health — making the audit trail evidence, and the outbox actually runnable
--
-- The Audit screen says, in as many words, that Joy records who did what in
-- code and has no database behind it. This migration is the first half of
-- closing that: the table has existed since 0002, and three things stood
-- between it and being worth relying on.
--
-- WHAT WAS WRONG
--
-- 1. Anybody could sign anybody's name. `audit_entries_insert_same_org` checked
--    only the organization, so an authenticated caregiver could write an entry
--    saying the owner approved an admission. An audit trail that any session can
--    forge entries into is not evidence, it is a rumour with a timestamp.
--
-- 2. A failed domain event had nowhere to record when to try again.
--    `DomainEventStore.markFailed` takes a `retryAt` and `domain_events` had no
--    column for it, so the worker's backoff had nowhere to live — and the claim
--    index takes `status in ('pending','failed')`, which means a permanently
--    failing event would be re-claimed on every pass, forever, as fast as the
--    worker could run. The retry logic is written and tested; the table simply
--    could not hold its output.
--
-- 3. There was no way to claim work atomically. Two workers reading the same
--    pending rows and both processing them is the classic outbox failure, and it
--    is not preventable from the client: `select ... for update skip locked`
--    needs to be inside one statement in the database. So the claim is a
--    function here rather than a query in TypeScript.

-- ---------------------------------------------------------------------------
-- An audit entry carries the name of whoever actually did it
-- ---------------------------------------------------------------------------

drop policy if exists audit_entries_insert_same_org on audit_entries;

-- From an authenticated session the actor is the person in that session, and
-- nobody else. A session may not write on behalf of a colleague, and may not
-- claim to be 'system' or 'ai' either — attributing a human action to the
-- machine is the more useful lie of the two, and this is the boundary that has
-- to refuse it.
--
-- The worker and any Edge Function write with the service role, which bypasses
-- row level security. That is deliberate and it is where non-user actors come
-- from: their attribution is the deployment's to guarantee, not a browser's.
create policy audit_entries_insert_as_yourself on audit_entries
  for insert with check (
    organization_id = current_org_id()
    and actor_type = 'user'
    and actor_user_id = (select id from current_app_user())
  );

comment on table audit_entries is
  'Append-only. There is no update or delete policy on purpose — a trail the application can edit is not evidence of anything — and an authenticated session may only write entries in its own name.';

-- ---------------------------------------------------------------------------
-- Somewhere to put the backoff
-- ---------------------------------------------------------------------------

alter table domain_events
  add column retry_at timestamptz;

comment on column domain_events.retry_at is
  'When a failed event becomes eligible again. Null on a failed row means do not retry — the worker gave up, and something has to be looked at by a person.';

-- The claim index has to agree with the claim query or the query stops using it.
drop index if exists domain_events_pending_idx;
create index domain_events_claimable_idx
  on domain_events (retry_at nulls first, created_at)
  where status in ('pending', 'failed');

-- Rows that were abandoned: failed, out of retries, waiting for a human. Their
-- own index because they are a work queue and not an error log.
create index domain_events_abandoned_idx
  on domain_events (organization_id, created_at desc)
  where status = 'failed' and retry_at is null;

-- ---------------------------------------------------------------------------
-- Claiming work, exactly once
-- ---------------------------------------------------------------------------

/**
 * Claim up to `max_events` events that are ready to run, marking them
 * processing in the same statement that selects them.
 *
 * `for update skip locked` is the whole point. Two workers running the same
 * minute — which is the normal state of affairs the moment anything is deployed
 * more than once — will otherwise both read the same pending rows and both send
 * the same text message. `skip locked` makes the second worker step over rows
 * the first has taken rather than block on them, so both do useful work and
 * neither duplicates.
 *
 * Attempts are incremented HERE rather than on failure. An event that crashes
 * the worker hard enough that `markFailed` never runs would otherwise keep its
 * attempt count at zero and be retried forever. Counting at claim time means a
 * poison event runs out of attempts even if it takes the worker down with it.
 */
create or replace function claim_domain_events(max_events integer, as_of timestamptz)
returns setof domain_events
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  with claimed as (
    select id
    from domain_events
    where status in ('pending', 'failed')
      and (retry_at is null or retry_at <= as_of)
      -- A failed row with no retry_at was abandoned deliberately. Only a
      -- pending one may have a null here and still be due.
      and (status = 'pending' or retry_at is not null)
    order by created_at
    limit greatest(max_events, 0)
    for update skip locked
  )
  update domain_events e
  set status = 'processing',
      attempts = e.attempts + 1
  from claimed
  where e.id = claimed.id
  returning e.*;
$$;

comment on function claim_domain_events is
  'The outbox worker''s claim. security definer because the worker acts for the whole deployment rather than for one organization, and because no application session may mark work processing — 0003 grants sessions insert and select on domain_events and nothing else.';

-- Not granted to `authenticated`. An application session must not be able to
-- take work off the queue: a browser tab that claims an event and is then closed
-- has silently swallowed it. The worker connects with the service role.
revoke all on function claim_domain_events(integer, timestamptz) from public;

/**
 * Finish an event, one way or the other.
 *
 * Together with the claim, this is the whole state machine, in the database
 * rather than spread across the worker — so a worker that dies between reading
 * and writing leaves a row in a state the next pass can reason about.
 */
create or replace function finish_domain_event(
  event_id     uuid,
  succeeded    boolean,
  at           timestamptz,
  error_text   text default null,
  next_retry   timestamptz default null
)
returns void
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  update domain_events
  set status       = case when succeeded then 'processed' else 'failed' end::domain_event_status,
      processed_at = case when succeeded then at else processed_at end,
      last_error   = case when succeeded then null else error_text end,
      retry_at     = case when succeeded then null else next_retry end
  where id = event_id;
$$;

revoke all on function finish_domain_event(uuid, boolean, timestamptz, text, timestamptz) from public;

-- ---------------------------------------------------------------------------
-- What this migration does not do
-- ---------------------------------------------------------------------------

-- Nothing here schedules the worker. `processDue` is a function and something
-- has to call it on a timer — pg_cron, a Supabase scheduled Edge Function, or
-- whatever the deployment prefers. That choice belongs to whoever deploys this,
-- and INTEGRATIONS.md records it as an open item rather than a hidden one.
--
-- The consequence of leaving it unscheduled is worth stating plainly, because
-- it is not obvious from the code: events accumulate as `pending` and nothing
-- goes out. No message fails, no error appears — the queue simply grows, and the
-- first symptom is a family who never received an invitation nobody knows was
-- never sent.
