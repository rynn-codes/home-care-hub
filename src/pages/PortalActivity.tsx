import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Clock, Heart, MessageSquare, Send, TriangleAlert, X } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  buildPortalQueue,
  portalQueueSummary,
  queueCounts,
  type PortalWorkItem,
  type PortalWorkKind,
} from "@/domain/portal/officeQueue";
import { approveMoment, withholdMoment, type Moment } from "@/domain/portal/moments";
import { approvePreference, retirePreference, type Preference } from "@/domain/portal/preferences";
import { WORK_QUEUE_HINTS, WORK_QUEUE_LABELS, WORK_QUEUE_GROUPS } from "@/domain/workQueue";
import { seedMoments, seedPreferences, seedRequestedDocuments } from "@/lib/familyPortalSeed";
import { seedTimeEntries } from "@/lib/payrollSeed";
import { cn } from "@/lib/utils";

/**
 * Operations → Portal activity.
 *
 * The gap this closes was quietly serious. Caregivers and families could write
 * into Joy — Moments, time entries, uploaded documents, preference suggestions
 * — and there was no screen at the office showing any of it. Work arriving
 * somewhere nobody looks is the same as work not arriving.
 *
 * Grouped Needs You / Waiting / Moving Forward, the pattern §8 asks every
 * module to converge on, rather than a fourth list idiom.
 *
 * The actions are real: approving a Moment runs `approveMoment`, which enforces
 * the consent check and the provenance rule, and refuses rather than succeeding
 * quietly if either fails.
 */

const ICON: Record<PortalWorkKind, typeof Check> = {
  moment_review: Heart,
  moment_shared: Heart,
  preference_review: MessageSquare,
  clock_exception: Clock,
  document_requested: Send,
  invitation_unopened: Send,
  invitation_expired: TriangleAlert,
};

const ADMIN = { personId: "p-karynn", isOffice: true };

export default function PortalActivity() {
  const [moments, setMoments] = useState<Moment[]>(() => [
    // One drafted moment awaiting review, so the queue demonstrates itself.
    {
      ...seedMoments[0],
      id: "mo-draft",
      state: "draft",
      origin: "ai_drafted",
      sharedAt: null,
      approvedByPersonId: null,
      approvedAt: null,
      body: "Marcus enjoyed a quiet afternoon and seemed in good spirits.",
    },
    ...seedMoments,
  ]);
  const [preferences, setPreferences] = useState<Preference[]>(() => seedPreferences);

  const asOf = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const items = useMemo(
    () =>
      buildPortalQueue({
        moments,
        preferences,
        timeEntries: seedTimeEntries,
        invitations: [],
        documentRequests: seedRequestedDocuments,
        nameFor: (id) => id.replace(/^p-/, "").replace(/^\w/, (c) => c.toUpperCase()),
        asOf,
      }),
    [moments, preferences, asOf],
  );

  const counts = queueCounts(items);

  function onApproveMoment(id: string) {
    const moment = moments.find((m) => `moment-${m.id}` === id);
    if (!moment) return;

    try {
      // The domain does the checking. If the consent is missing or the wording
      // reads like a chart line, this throws and the office is told why.
      const shared = approveMoment({
        moment,
        approver: ADMIN,
        disclosureConsent: "agree",
        at: new Date().toISOString(),
      });
      setMoments((all) => all.map((m) => (m.id === shared.id ? shared : m)));
      toast.success("Shared with the family");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "This could not be shared.");
    }
  }

  function onWithholdMoment(id: string) {
    const moment = moments.find((m) => `moment-${m.id}` === id);
    if (!moment) return;
    setMoments((all) =>
      all.map((m) => (m.id === moment.id ? withholdMoment(m, "Held by the office") : m)),
    );
    toast("Held back. The caregiver's words are kept.");
  }

  function onApprovePreference(id: string) {
    const preference = preferences.find((p) => `pref-${p.id}` === id);
    if (!preference) return;
    setPreferences((all) =>
      all.map((p) =>
        p.id === preference.id
          ? approvePreference({ preference: p, byPersonId: ADMIN.personId, at: new Date().toISOString() })
          : p,
      ),
    );
    toast.success("Approved. Caregivers will see it before a visit.");
  }

  function onRejectPreference(id: string) {
    const preference = preferences.find((p) => `pref-${p.id}` === id);
    if (!preference) return;
    setPreferences((all) =>
      all.map((p) => (p.id === preference.id ? retirePreference(p, "Not approved") : p)),
    );
    toast("Not added.");
  }

  function Row({ item }: { item: PortalWorkItem }) {
    const Icon = ICON[item.kind];
    const actionable = item.kind === "moment_review" || item.kind === "preference_review";

    return (
      <li className="px-4 py-4">
        <div className="flex items-start gap-3">
          <Icon
            className={cn(
              "mt-0.5 h-4 w-4 shrink-0",
              item.group === "needs_you" ? "text-[hsl(var(--warning))]" : "text-muted-foreground",
            )}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{item.headline}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{item.detail}</p>
            {item.subject && (
              <p className="mt-0.5 text-xs text-muted-foreground">{item.subject}</p>
            )}

            {actionable && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    item.kind === "moment_review"
                      ? onApproveMoment(item.id)
                      : onApprovePreference(item.id)
                  }
                >
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                  {item.kind === "moment_review" ? "Approve & share" : "Approve"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    item.kind === "moment_review"
                      ? onWithholdMoment(item.id)
                      : onRejectPreference(item.id)
                  }
                >
                  <X className="mr-1.5 h-3.5 w-3.5" />
                  Hold back
                </Button>
              </div>
            )}

            {!actionable && item.to && (
              <Link
                to={item.to}
                className="mt-2 inline-block text-xs font-medium text-[hsl(var(--accent-foreground))] underline-offset-4 hover:underline"
              >
                Open
              </Link>
            )}
          </div>
        </div>
      </li>
    );
  }

  return (
    <>
      <PageHeader
        title="Portal activity"
        description="What caregivers and families have sent in, and what is waiting on them."
      />

      <p className="mb-6 text-sm text-muted-foreground">{portalQueueSummary(items)}</p>

      <div className="space-y-8">
        {WORK_QUEUE_GROUPS.map((group) => {
          const groupItems = items.filter((i) => i.group === group);
          const count =
            group === "needs_you"
              ? counts.needsYou
              : group === "waiting"
                ? counts.waiting
                : counts.movingForward;

          return (
            <section key={group}>
              <div className="mb-3 flex items-baseline gap-3">
                <h2 className="text-sm font-semibold">
                  {WORK_QUEUE_LABELS[group]}
                  {count > 0 && <span className="ml-1.5 text-muted-foreground">{count}</span>}
                </h2>
                <p className="text-xs text-muted-foreground">{WORK_QUEUE_HINTS[group]}</p>
              </div>

              <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
                {groupItems.map((item) => (
                  <Row key={item.id} item={item} />
                ))}
                {groupItems.length === 0 && (
                  <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Nothing here.
                  </li>
                )}
              </ul>
            </section>
          );
        })}
      </div>

      <p className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">
        Only moments whose wording was drafted rather than written by the caregiver appear for
        review — a caregiver's own words go straight to the family. Approving runs the same
        consent and content checks the portal does, so a moment that should not be shared is
        refused here too.
      </p>
    </>
  );
}
