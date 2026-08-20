# Employee documents and credentials — what is built, what is yours to connect

Implements Phase 1 of `Joy_Health_Employee_Documents_Credentials_Audit_Spec.md`:
the secure document foundation, which that spec says gives Joy a safe, usable
document system *before* any AI exists.

Nothing here talks to a vendor. Every external dependency sits behind a port
with an in-memory implementation, so the workflow runs and is tested today and
becomes real by swapping an adapter at the composition root.

## What is built

| Piece | Where |
|---|---|
| Schema, RLS, grants | `supabase/migrations/0005_documents_and_credentials.sql` |
| RLS proof, 17 assertions | `supabase/tests/credentials_test.sql` |
| Shared vocabulary | `src/domain/documents/types.ts` |
| The eight service ports (§22) | `src/domain/documents/ports.ts` |
| In-memory adapters | `src/domain/documents/memoryAdapters.ts` |
| Compliance & expiration engine (§13, §27) | `src/domain/credentials/compliance.ts` |

## What the developer connects

Each row is one adapter implementing an existing interface. No call sites move.

| Port | Connect to | Notes |
|---|---|---|
| `DocumentStorageService` | S3 (or equivalent) | Private bucket, block public access, encryption at rest. `put` returns a **key**, never a URL. `signedUrl` is the only read path. |
| `DocumentProcessingService` | SQS / a job runner | §8 requires async. A processing failure must never destroy the uploaded file. |
| `DocumentTextService` | Textract / Document AI | Returns text. Understanding it is the extractor's job. |
| `DocumentClassificationService` | Model or rules | Ships as a filename matcher with confidence capped at 0.4 — never enough to skip review. |
| `CredentialExtractionService` | Structured LLM output | §9: typed and validated. Do **not** parse consequential values out of prose. |
| `CredentialVerificationService` | Your persistence | There is deliberately no method letting extraction verify its own work; the only path to `verified` takes a user id. |
| `ComplianceService` | Postgres | The rule engine already exists and is tested; this port is just the read/write. |
| `DocumentAccessService` | Your auth | Mirrors the RLS policy. Both layers enforce it; neither is decorative. |
| `AuditPacketService` | PDF toolchain | Workflow, permissions and the audit event exist. Generation throws with a message saying so, rather than returning an empty file. |

## Three things not to undo

**Requirements are data.** `credential_requirements` carries which roles a
credential applies to, whether it is driving-only, whether a lapse blocks
scheduling, and its warning points. §6 requires this be configurable to Joy
policy and jurisdiction. An earlier version of Employees hard-coded them in
TypeScript; that is the thing the spec warns against, and it is superseded.

**Renewals supersede, never overwrite.** `employee_credential_versions` keeps
the prior card *and its evidence*. §30 rule 7. An auditor asks what was true in
2024, not only today.

**Sensitivity is a property of the document.** Six classes, enforced in the RLS
policy and mirrored in `MemoryDocumentAccess`. §19: a scheduler needs an
eligibility answer, which is not the same permission as reading the background
check it came from. `credentials_test.sql` proves this rather than asserting it.

## Running the database tests

```
psql -f supabase/tests/local_shim.sql
psql -f supabase/migrations/0001_foundation.sql   # …through 0005
psql -f supabase/tests/rls_test.sql               # defines assert() and act_as()
psql -f supabase/tests/credentials_test.sql
```

Every assertion runs as `authenticated`, the role PostgREST connects as. Run
them as the table owner and RLS is bypassed — the file passes while proving
nothing. That mistake is easy to make and was made once here already.

## Still to build

Phases 2–4 of the spec: the review-and-confirm UI (§10), renewal and duplicate
handling (§24), the expiration notification schedule (§13), and the audit packet
generator (§14–§18, §26). The engine those need is in place.
