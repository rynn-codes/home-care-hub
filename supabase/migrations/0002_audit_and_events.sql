-- Joy Health — audit log, domain event outbox, communication events
--
-- Sections 16, 17 and 27. These are built in Sprint 0 rather than when the first
-- module needs them, for two reasons the brief is explicit about:
--
--   1. A failed family notification must never roll back a successfully
--      scheduled assessment. That requires the business write and the message
--      send to be separated by a durable outbox, not a single transaction.
--   2. Audit history that starts mid-life is not audit history. It is cheap now
--      and impossible to backfill honestly later.

create type actor_type as enum ('user', 'ai', 'system', 'integration');

create type domain_event_status as enum ('pending', 'processing', 'processed', 'failed');

create type communication_status as enum ('queued', 'sent', 'failed', 'cancelled');

create type communication_channel as enum ('sms', 'email', 'voice', 'in_app');

-- ---------------------------------------------------------------------------
-- Audit — who changed what, including when "who" was not a person
-- ---------------------------------------------------------------------------

create table audit_entries (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  actor_user_id   uuid references users (id) on delete set null,
  actor_type      actor_type not null,
  action          text not null,
  entity_type     text not null,
  entity_id       uuid,
  before_json     jsonb,
  after_json      jsonb,
  metadata_json   jsonb,
  created_at      timestamptz not null default now(),
  -- A human actor must be identified. AI, system and integration actors are
  -- attributable by type alone, and must not borrow a user's identity.
  constraint audit_entries_user_actor_identified
    check (actor_type <> 'user' or actor_user_id is not null)
);

create index audit_entries_org_created_idx on audit_entries (organization_id, created_at desc);
create index audit_entries_entity_idx on audit_entries (entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- Domain events — the outbox
-- ---------------------------------------------------------------------------

create table domain_events (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  event_type      text not null,
  aggregate_type  text not null,
  aggregate_id    uuid,
  payload_json    jsonb not null default '{}'::jsonb,
  status          domain_event_status not null default 'pending',
  attempts        integer not null default 0,
  -- Set by the producer for operations that must not double-fire on a retry or
  -- a double-clicked button. Section 42 requires idempotency for assessment
  -- scheduling, webhooks, document finalization and signature submission.
  idempotency_key text,
  created_at      timestamptz not null default now(),
  processed_at    timestamptz,
  last_error      text,
  constraint domain_events_attempts_non_negative check (attempts >= 0)
);

create unique index domain_events_idempotency_key_unique
  on domain_events (organization_id, event_type, idempotency_key)
  where idempotency_key is not null;

-- The worker's claim query: oldest pending first.
create index domain_events_pending_idx
  on domain_events (created_at)
  where status in ('pending', 'failed');

-- ---------------------------------------------------------------------------
-- Communication events — what Spruce was asked to send, and what happened
-- ---------------------------------------------------------------------------

create table communication_events (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations (id) on delete cascade,
  entity_type         text not null,
  entity_id           uuid,
  recipient_person_id uuid references people (id) on delete set null,
  channel             communication_channel not null,
  provider            text not null,
  provider_message_id text,
  template_key        text not null,
  status              communication_status not null default 'queued',
  attempts            integer not null default 0,
  error_code          text,
  error_message       text,
  created_at          timestamptz not null default now(),
  sent_at             timestamptz,
  -- Never show a message as sent without the provider confirming it. A sent row
  -- must carry both a timestamp and the provider's own message id.
  constraint communication_events_sent_is_confirmed
    check (status <> 'sent' or (sent_at is not null and provider_message_id is not null))
);

create index communication_events_org_created_idx
  on communication_events (organization_id, created_at desc);
create index communication_events_entity_idx
  on communication_events (entity_type, entity_id);
create index communication_events_retryable_idx
  on communication_events (created_at)
  where status = 'failed';
