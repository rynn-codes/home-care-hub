import { useNavigate } from "react-router-dom";
import { Briefcase, Heart } from "lucide-react";
import { usePortalSession } from "@/context/PortalSessionProvider";
import { PortalFrame } from "@/components/portal/PortalFrame";
import { portalRoute } from "@/domain/portal/identity";
import type { PortalGrant } from "@/domain/portal/identity";

/**
 * "Which are you here for?" — asked once, then remembered.
 *
 * Karynn's decision on 20 Aug. The alternative, asking at every sign-in, taxes
 * the daily path — a caregiver checking her schedule — forever, to serve a case
 * that comes up rarely.
 *
 * The choice is not cosmetic, which is why it gets a whole screen rather than a
 * dropdown. Reading a client record as staff and reading your father's record
 * as his responsible party are two different justifications for the same act,
 * and Joy records which one was in play. A control small enough to hit by
 * accident would put the wrong answer in the audit trail.
 */

function Choice({ grant, onPick }: { grant: PortalGrant; onPick: () => void }) {
  const work = grant.audience === "workforce";
  const Icon = work ? Briefcase : Heart;

  return (
    <button
      type="button"
      onClick={onPick}
      className="flex w-full items-center gap-4 rounded-2xl border border-border bg-surface p-5 text-left transition-colors hover:bg-surface-muted"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary-soft))]">
        <Icon className="h-5 w-5 text-[hsl(var(--accent-foreground))]" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-base font-medium">
          {work ? "My work at Joy" : `${grant.subjectName}'s care`}
        </span>
        <span className="block text-sm text-muted-foreground">
          {work ? "Your schedule, visits and documents" : "Schedule, updates and documents"}
        </span>
      </span>
    </button>
  );
}

export default function PortalChoose() {
  const { resolution, chooseGrant } = usePortalSession();
  const navigate = useNavigate();

  if (!resolution) {
    navigate("/portal/login", { replace: true });
    return null;
  }

  return (
    <PortalFrame>
      <p className="font-display text-xs uppercase tracking-[0.18em] text-muted-foreground">
        Joy Health
      </p>
      <h1 className="mt-6 font-display text-2xl font-bold leading-tight tracking-tight">
        Which are you here for?
      </h1>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        You can switch at any time — we'll remember this for next time.
      </p>

      <div className="mt-8 space-y-3">
        {resolution.choices.map((grant) => (
          <Choice
            key={`${grant.audience}-${grant.subjectPersonId ?? "self"}`}
            grant={grant}
            onPick={() => {
              chooseGrant(grant);
              navigate(portalRoute(grant), { replace: true });
            }}
          />
        ))}
      </div>
    </PortalFrame>
  );
}
