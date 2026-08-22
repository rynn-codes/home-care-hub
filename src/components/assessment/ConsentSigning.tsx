import { useMemo, useState } from "react";
import { Check, ChevronDown, PenLine, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDemo } from "@/context/DemoDataProvider";
import {
  CONSENTS,
  CONSENT_GROUPS,
  consentReadiness,
  consentsByGroup,
  declineConsequences,
  type ConsentDecision,
  type ConsentDecisions,
  type ConsentItem,
} from "@/domain/consents/registry";
import { cn } from "@/lib/utils";
import { canWitnessSignature, witnessLine, witnessRefusal } from "@/domain/consents/witness";

interface Props {
  admissionId: string;
  clientName: string;
  onBack: () => void;
  onDone: () => void;
}

/**
 * Client mode — reviewing the packet, then signing once.
 *
 * The design problem: twenty-five consents over a 26-page packet, an elderly client, and a
 * nurse who needs to get through it without either rushing them or losing an
 * hour. What this does about it:
 *
 *  - ONE ROW PER CONSENT, with the plain-language line the RN says out loud.
 *    Nobody reads legalese aloud, and nobody should have to.
 *  - "READ THE FULL TEXT" ON EVERY ROW. Expands the actual document wording in
 *    place, for when the client asks what it really says. §19 requires the full
 *    legal language be available to expand.
 *  - AGREE / DECLINE / N/A ON EACH. Not a "reviewed" tick. Some of these are
 *    genuinely refusable and a packet that cannot record a no is not evidence
 *    of consent. This is finding F4.
 *  - THE HARD CLAUSES ARE FLAGGED. "Watch for" surfaces what people
 *    misunderstand — the 24-hour suspension, the six-month non-solicit — so
 *    they get said rather than skimmed.
 *  - ONE SIGNATURE, ONE SET OF INITIALS, AT THE END. Joy places them wherever
 *    the packet asks. The family never signs the same sentence twice.
 */
export function ConsentSigning({ admissionId, clientName, onBack, onDone }: Props) {
  const { consentSessions, saveConsents, currentUser } = useDemo();
  const stored = consentSessions[admissionId];

  const [decisions, setDecisions] = useState<ConsentDecisions>(() => stored?.decisions ?? {});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [phase, setPhase] = useState<"review" | "read_back" | "sign" | "done">(
    stored?.signedAt ? "done" : "review",
  );
  const [signerName, setSignerName] = useState(stored?.signerName ?? "");
  const [signerRelationship, setSignerRelationship] = useState(stored?.signerRelationship ?? "");
  const [signature, setSignature] = useState("");
  const [initials, setInitials] = useState("");
  const [reviewedCompletedAt, setReviewedCompletedAt] = useState<string | null>(
    stored?.reviewedCompletedAt ?? null,
  );

  const readiness = useMemo(() => consentReadiness(decisions), [decisions]);
  const consequences = useMemo(() => declineConsequences(decisions), [decisions]);
  const groups = useMemo(() => consentsByGroup(), []);

  const decide = (key: string, decision: ConsentDecision) => {
    const next = { ...decisions, [key]: decision };
    setDecisions(next);
    saveConsents(admissionId, { decisions: next });
  };

  if (phase === "done") {
    return (
      <section className="rounded-2xl border border-border bg-surface p-8">
        <p className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--success))]">
          <Check className="h-4 w-4" aria-hidden="true" />
          Packet signed
        </p>
        <h2 className="mt-3 text-xl font-semibold tracking-tight">
          {stored?.signerName} signed for {clientName}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Taken by{" "}
          {witnessLine(
            stored?.witnessName && stored?.witnessRole
              ? { name: stored.witnessName, role: stored.witnessRole }
              : null,
          )}
        </p>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          One signature and one set of initials, placed on every page the packet asks for.
          Each consent kept its own decision.
        </p>

        {consequences.length > 0 && (
          <div className="mt-5 rounded-xl border border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning)/0.06)] p-4">
            <p className="text-sm font-semibold">What was declined, and who needs to know</p>
            <ul className="mt-2 space-y-1.5">
              {consequences.map((c) => (
                <li key={c} className="text-sm text-muted-foreground">{c}</li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-5 text-xs text-muted-foreground">
          Generating the finalized PDF sits behind <code className="rounded bg-surface-muted px-1">CONSENT_PDF_GENERATION_ENABLED</code>,
          which is off. Nothing has been produced as a signed document yet.
        </p>

        <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-5">
          <Button onClick={onDone}>Back to Admissions</Button>
        </div>
      </section>
    );
  }

  if (phase === "sign" || phase === "read_back") {
    // Karynn's rule, 18 Aug: only an RN or the Admin/Owner may take the
    // client's signature. Everyone else can still run the review and record
    // decisions — this stops at the signature, not at the conversation.
    if (!canWitnessSignature(currentUser.role)) {
      return (
        <section className="rounded-2xl border border-border bg-surface p-8">
          <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <TriangleAlert className="h-5 w-5 text-[hsl(var(--warning))]" aria-hidden="true" />
            An RN needs to finish this
          </h2>
          <p className="mt-3 max-w-prose text-sm text-muted-foreground">{witnessRefusal(currentUser.role)}</p>
          <p className="mt-3 max-w-prose text-sm text-muted-foreground">
            Every decision you recorded is saved. The packet has a Joy representative line beside
            the client's signature on almost every page, and signing it attests that the consents
            were explained before they were agreed to.
          </p>
          <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-5">
            <Button variant="outline" onClick={() => setPhase("review")}>
              Back to the consents
            </Button>
            <Button variant="ghost" onClick={onBack}>
              Back to the assessment
            </Button>
          </div>
        </section>
      );
    }

    if (phase === "read_back") {
      // Karynn, 22 August: "When it comes time to sign the agreement, the
      // agreement should be filled out and the client should have the ability
      // to review the completed document in its entirety and then sign." So
      // between deciding and signing sits the whole document, completed with
      // this client's name and this client's answers — and the only way to the
      // pen is past the end of it. Nobody signs a summary.
      return (
        <section className="rounded-2xl border border-border bg-surface p-8">
          <h2 className="text-xl font-semibold tracking-tight">The completed agreement</h2>
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            This is the whole document as it will be signed — every clause in full, with{" "}
            {clientName}'s answers filled in. The signature button is at the end, past all of it.
          </p>

          <article className="mt-6 space-y-6 border-y border-border py-6">
            <p className="text-sm">
              Service agreement and consents between <strong>{clientName}</strong> and Joy
              Health, prepared {new Date().toLocaleDateString()}.
            </p>
            {CONSENT_GROUPS.map(({ group, title }) => (
              <div key={group}>
                <h3 className="text-sm font-semibold">{title}</h3>
                <div className="mt-2 space-y-4">
                  {CONSENTS.filter((c) => c.group === group).map((c) => (
                    <div key={c.key} className="rounded-xl border border-border p-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm font-medium">{c.title}</p>
                        <span
                          className={cn(
                            "text-xs font-medium",
                            decisions[c.key] === "agree"
                              ? "text-[hsl(var(--success))]"
                              : "text-[hsl(var(--warning))]",
                          )}
                        >
                          {decisions[c.key] === "agree"
                            ? "Agreed"
                            : decisions[c.key] === "decline"
                              ? "Declined"
                              : "Not applicable"}
                        </span>
                      </div>
                      <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                        {c.fullText}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </article>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button
              onClick={() => {
                setReviewedCompletedAt(new Date().toISOString());
                setPhase("sign");
              }}
            >
              {clientName} has reviewed the completed agreement — sign it
            </Button>
            <Button variant="ghost" onClick={() => setPhase("review")}>
              Back to the decisions
            </Button>
          </div>
        </section>
      );
    }

    return (
      <section className="rounded-2xl border border-border bg-surface p-8">
        <h2 className="text-xl font-semibold tracking-tight">Sign once</h2>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          One signature and one set of initials. Joy places them on every page that asks —
          {clientName} never signs the same sentence twice.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signerName" className="text-xs font-medium">Signer's full legal name</Label>
            <Input id="signerName" value={signerName} onChange={(e) => setSignerName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signerRel" className="text-xs font-medium">Relationship to client</Label>
            <Input
              id="signerRel"
              value={signerRelationship}
              onChange={(e) => setSignerRelationship(e.target.value)}
              placeholder="Self, daughter, power of attorney…"
            />
            <p className="text-xs text-muted-foreground">
              If someone signs for the client, the packet records who and in what capacity.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-[2fr_1fr]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signature" className="text-xs font-medium">Signature</Label>
            <Input
              id="signature"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder="Type the full name to sign"
              className="h-16 font-serif text-2xl"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="initials" className="text-xs font-medium">Initials</Label>
            <Input
              id="initials"
              value={initials}
              onChange={(e) => setInitials(e.target.value.toUpperCase().slice(0, 4))}
              placeholder="ABC"
              className="h-16 font-serif text-2xl"
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          A typed signature stands in for handwriting in this prototype; a real signature pad is
          needed before this is used with a client. One signature with initials is Joy's settled
          approach — Karynn, 22 August — applied only after the completed document has been
          reviewed in its entirety.
        </p>

        <dl className="mt-6 divide-y divide-border border-y border-border">
          <div className="flex justify-between py-2.5 text-sm">
            <dt className="text-muted-foreground">Agreed</dt>
            <dd className="font-medium tabular-nums">
              {Object.values(decisions).filter((d) => d === "agree").length}
            </dd>
          </div>
          <div className="flex justify-between py-2.5 text-sm">
            <dt className="text-muted-foreground">Declined or not applicable</dt>
            <dd className="font-medium tabular-nums">
              {Object.values(decisions).filter((d) => d !== "agree").length}
            </dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button
            disabled={!signerName.trim() || !signature.trim() || !initials.trim()}
            onClick={() => {
              saveConsents(admissionId, {
                decisions,
                signerName,
                signerRelationship,
                witnessName: currentUser.name,
                witnessRole: currentUser.role,
                // The record that the whole completed document was in front of
                // them before the pen — Karynn's requirement, 22 August.
                reviewedCompletedAt,
                signedAt: new Date().toISOString(),
              });
              setPhase("done");
            }}
          >
            <PenLine className="mr-1.5 h-4 w-4" />
            Apply to the whole packet
          </Button>
          <Button variant="ghost" onClick={() => setPhase("review")}>
            Back to the review
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
      <h2 className="text-xl font-semibold tracking-tight">
        Reviewing with {clientName.split(" ")[0]}
      </h2>
      <p className="mt-2 max-w-prose text-sm text-muted-foreground">
        {CONSENTS.length} things they're agreeing to, in plain language. Say each one and record
        what they decide. Open the full text whenever they ask what it actually says.
      </p>

      <div className="mt-5 flex items-center gap-3">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${(readiness.decided / readiness.total) * 100}%` }}
          />
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">
          {readiness.decided} of {readiness.total}
        </span>
      </div>

      {groups.map((g) => {
        const done = g.items.filter((i) => decisions[i.key]).length;
        return (
          <section key={g.group} className="mt-7 first:mt-6">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3 className="text-sm font-semibold">{g.title}</h3>
              <span
                className={cn(
                  "text-xs tabular-nums",
                  done === g.items.length ? "text-[hsl(var(--success))]" : "text-muted-foreground",
                )}
              >
                {done} of {g.items.length}
              </span>
            </div>
            <p className="mt-0.5 max-w-prose text-xs text-muted-foreground">{g.blurb}</p>
            <ul className="mt-3 divide-y divide-border border-y border-border">
              {g.items.map((item) => (
                <ConsentRow
                  key={item.key}
                  item={item}
                  decision={decisions[item.key]}
                  expanded={expanded === item.key}
                  onToggle={() => setExpanded(expanded === item.key ? null : item.key)}
                  onDecide={(d) => decide(item.key, d)}
                />
              ))}
            </ul>
          </section>
        );
      })}

      {readiness.blockingDeclines.length > 0 && (
        <div className="mt-5 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <TriangleAlert className="h-4 w-4 text-destructive" aria-hidden="true" />
            Care can't start with these declined
          </p>
          <ul className="mt-2 space-y-1">
            {readiness.blockingDeclines.map((c) => (
              <li key={c.key} className="text-sm text-muted-foreground">{c.title}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            These define the service or the payment for it. Talk it through, or close the
            admission — don't sign around it.
          </p>
        </div>
      )}

      {consequences.length > 0 && (
        <div className="mt-5 rounded-xl border border-border bg-surface-muted p-4">
          <p className="text-sm font-semibold">Noted for the care team</p>
          <ul className="mt-2 space-y-1.5">
            {consequences.map((c) => (
              <li key={c} className="text-sm text-muted-foreground">{c}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-7 flex flex-wrap gap-2 border-t border-border pt-5">
        <Button disabled={!readiness.canSign} onClick={() => setPhase("read_back")}>
          Review the completed agreement
        </Button>
        <Button variant="ghost" onClick={onBack}>
          Back to the assessment
        </Button>
      </div>
      {!readiness.canSign && readiness.undecided.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {readiness.undecided.length} still need a decision. Every one needs an answer — agreeing
          to all of them is not required, but leaving one blank is.
        </p>
      )}
    </section>
  );
}

function ConsentRow({
  item,
  decision,
  expanded,
  onToggle,
  onDecide,
}: {
  item: ConsentItem;
  decision?: ConsentDecision;
  expanded: boolean;
  onToggle: () => void;
  onDecide: (d: ConsentDecision) => void;
}) {
  return (
    <li className="py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <h3 className="text-sm font-medium">{item.title}</h3>
            <span className="text-xs text-muted-foreground">p. {item.pages}</span>
            {!item.mandatory && (
              <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                They may decline
              </span>
            )}
          </div>

          <p className="mt-1.5 text-sm text-muted-foreground">{item.say}</p>

          {item.watchFor && (
            <p className="mt-1.5 text-xs text-[hsl(var(--warning))]">
              Watch for: {item.watchFor}
            </p>
          )}

          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
            {expanded ? "Hide the full text" : "Read the full text"}
          </button>

          {expanded && (
            <blockquote className="mt-2.5 rounded-lg border border-border bg-surface-muted p-3.5 text-xs leading-relaxed text-muted-foreground">
              {item.fullText}
            </blockquote>
          )}
        </div>

        <div className="flex shrink-0 gap-1.5">
          {([
            ["agree", "Agree", Check],
            ["decline", "Decline", X],
            ...(item.allowNotApplicable ? [["not_applicable", "N/A", null] as const] : []),
          ] as Array<[ConsentDecision, string, typeof Check | null]>).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              aria-pressed={decision === value}
              onClick={() => onDecide(value)}
              className={cn(
                "flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                decision === value
                  ? value === "agree"
                    ? "border-[hsl(var(--success))] bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))]"
                    : "border-[hsl(var(--warning))] bg-[hsl(var(--warning)/0.1)] text-[hsl(var(--warning))]"
                  : "border-border text-muted-foreground hover:bg-surface-muted",
              )}
            >
              {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
              {label}
            </button>
          ))}
        </div>
      </div>
    </li>
  );
}
