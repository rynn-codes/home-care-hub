import { useState } from "react";
import { Link2, Send, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  canInviteFamily,
  invitationSummary,
  issueInvitation,
  type Invitation,
} from "@/domain/hiring/invitation";
import { PHONE_PROBLEM_MESSAGES, formatPhone, normalizePhone } from "@/domain/portal/phone";
import { composeMessage } from "@/domain/portal/messaging";
import { RevokeAccessDialog } from "@/components/portal/RevokeAccessDialog";
import { revokeGrant, revocationSummary, type PortalGrant } from "@/domain/portal/identity";

/**
 * Sending a family their portal link — §19.
 *
 * The client portal has existed for a while with no way for anybody to reach
 * it. §19's flow is intake, in-person assessment, a decision to move forward,
 * then the link; the first three happened in Joy already and the fourth had no
 * button.
 *
 * The gate is `canInviteFamily`, which refuses before the assessment and
 * refuses before Joy has decided. Neither refusal is phrased as a failure —
 * "Joy has not decided to move forward yet" is a normal state for an admission
 * to be in, and a red error would make an ordinary Tuesday look like a problem.
 */

export function FamilyPortalCard({
  clientName,
  clientPersonId,
  responsibleParty,
  responsiblePartyPhone,
  assessmentComplete,
  movingForward,
  existing,
  onInvite,
}: {
  clientName: string;
  clientPersonId: string;
  responsibleParty: string | null;
  responsiblePartyPhone: string | null;
  assessmentComplete: boolean;
  movingForward: boolean;
  existing: Invitation | null;
  onInvite?: (invitation: Invitation) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [phone, setPhone] = useState(responsiblePartyPhone ?? "");
  const [sent, setSent] = useState<Invitation | null>(existing);
  const [grant, setGrant] = useState<PortalGrant | null>(null);
  const [revoking, setRevoking] = useState(false);

  const parsed = normalizePhone(phone);
  const phoneProblem = "problem" in parsed ? PHONE_PROBLEM_MESSAGES[parsed.problem] : null;

  const eligibility = canInviteFamily({
    assessmentComplete,
    movingForward,
    phone: parsed.ok ? parsed.e164 : null,
    existing: sent,
    asOf: today,
  });

  function invite() {
    if (!parsed.ok) return;

    const invitation = issueInvitation({
      id: `inv-${clientPersonId}-${Date.now()}`,
      audience: "family",
      subjectId: clientPersonId,
      clientPersonId,
      phone: parsed.e164,
      // A real token comes from the server. A browser-generated one would be
      // guessable, and this is what opens somebody's care record.
      token: "issued-server-side",
      byUserId: "current-user",
      asOf: today,
    });

    setSent(invitation);
    onInvite?.(invitation);

    // A grant exists from the moment the link goes out, so there is something
    // to withdraw before they have ever signed in — which is exactly when a
    // mistyped number needs taking back.
    setGrant({
      audience: "family",
      personId: clientPersonId,
      subjectPersonId: clientPersonId,
      greetingName: responsibleParty?.split(" ")[0] ?? "",
      subjectName: clientName,
      state: "pre_admission",
      active: true,
    });

    // Says what would be sent rather than claiming it was. No SMS provider is
    // connected — see MemorySmsSender.
    const message = composeMessage("family_invitation", parsed.e164, {
      firstName: responsibleParty?.split(" ")[0],
      link: "https://joy.example/portal",
    });
    toast("Not sent — no SMS provider is connected", { description: message.body });
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Link2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        Family portal
      </h3>

      <p className="mt-1 text-xs text-muted-foreground">
        {responsibleParty
          ? `${responsibleParty} would see ${clientName}'s schedule, documents and updates.`
          : `Nobody is recorded as ${clientName}'s responsible party yet.`}
      </p>

      <p className="mt-3 text-sm">{invitationSummary(sent, today)}</p>

      {!sent && (
        <div className="mt-4 space-y-1.5">
          <Label htmlFor="family-phone" className="text-xs">
            Mobile number
          </Label>
          <Input
            id="family-phone"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(713) 555-0110"
          />
          <p className="text-xs text-muted-foreground">
            {phoneProblem && phone.length > 0 ? (
              <span className="text-destructive">{phoneProblem}</span>
            ) : parsed.ok ? (
              // Shown back formatted, so a mistyped digit is visible before a
              // link to somebody's care record goes to a stranger.
              `Joy will text ${formatPhone(parsed.e164)}`
            ) : (
              "This is the number they will sign in with."
            )}
          </p>
        </div>
      )}

      {grant && !grant.active && (
        <p className="mt-3 text-xs text-destructive">{revocationSummary(grant)}</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button size="sm" disabled={!eligibility.eligible} onClick={invite}>
          <Send className="mr-1.5 h-3.5 w-3.5" />
          {sent ? "Resend link" : "Send portal link"}
        </Button>

        {grant?.active && (
          <Button size="sm" variant="ghost" onClick={() => setRevoking(true)}>
            <ShieldOff className="mr-1.5 h-3.5 w-3.5" />
            Withdraw access
          </Button>
        )}

        {!eligibility.eligible && eligibility.reason && (
          // Stated plainly, in muted text. "Joy has not decided to move forward
          // yet" is a normal state for an admission, not an error.
          <p className="text-xs text-muted-foreground">{eligibility.reason}</p>
        )}
      </div>

      {grant && (
        <RevokeAccessDialog
          open={revoking}
          onOpenChange={setRevoking}
          grant={grant}
          personName={responsibleParty ?? "this family"}
          onRevoke={({ reason, note }) => {
            const revoked = revokeGrant({
              grant,
              reason,
              note,
              byUserId: "current-user",
              at: new Date().toISOString(),
            });
            setGrant(revoked);
            setSent(null);
            toast("Access withdrawn", { description: revoked.revokedReason ?? undefined });
          }}
        />
      )}
    </section>
  );
}
