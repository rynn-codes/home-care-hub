-- Joy Health — taking a portal grant back
--
-- Issuing access existed; withdrawing it did not. A caregiver who left in March
-- kept a working login, and a discharged client's daughter kept reading a
-- schedule she had no further business seeing.
--
-- `active` and `revoked_reason` were already on the table. What was missing is
-- everything that makes a revocation a record rather than a flag: who did it,
-- when, and the guarantee that it cannot be done anonymously.

alter table portal_grants
  add column revoked_at         timestamptz,
  add column revoked_by_user_id uuid references users (id) on delete restrict;

-- A revocation is somebody's decision and the record says whose.
--
-- The same reasoning as `confirmCredential` and `issueInvitation`: cutting off
-- a person's access is an act with a consequence for them, and "the system did
-- it" is not an answer anybody can act on when they ring the office to ask why
-- their login stopped working.
alter table portal_grants
  add constraint portal_grants_revocation_is_attributed check (
    active
    or (revoked_at is not null and revoked_by_user_id is not null and length(btrim(coalesce(revoked_reason, ''))) > 0)
  );

-- An active grant carries no revocation. Without this, a row could be
-- reactivated while keeping the reason it was taken away, which reads in an
-- audit as though it were still revoked.
alter table portal_grants
  add constraint portal_grants_active_is_clean check (
    not active
    or (revoked_at is null and revoked_by_user_id is null and revoked_reason is null)
  );

create index portal_grants_revoked_idx on portal_grants (organization_id, revoked_at desc)
  where not active;

comment on column portal_grants.revoked_at is
  'When access was withdrawn. Row level security reads `active` on every query, so a revocation takes effect on the next request rather than at the next sign-in — a session already open stops loading data immediately.';

-- ---------------------------------------------------------------------------
-- Who may revoke
-- ---------------------------------------------------------------------------

-- 0006 already restricts every write on portal_grants to staff, and portal
-- users cannot issue grants at all. Revocation inherits that, which is correct:
-- withdrawing somebody's access is an office act.
--
-- Worth stating explicitly because the tempting shortcut is to let a person
-- revoke their own grant as a "sign out everywhere". That is a different
-- feature — it should not leave a record saying the office withdrew access,
-- and conflating them would put a misleading line in an audit trail.
