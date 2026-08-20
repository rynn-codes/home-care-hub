import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { usePortalSession } from "@/context/PortalSessionProvider";
import { formatPhone, normalizePhone, type E164 } from "@/domain/portal/phone";
import { OTP_POLICY } from "@/domain/portal/otp";
import { portalRoute } from "@/domain/portal/identity";
import { PortalFrame } from "@/components/portal/PortalFrame";

/**
 * Phone sign-in — §3, and §29's step 1.
 *
 * "Avoid requiring the candidate to remember a conventional username/password
 * if phone OTP can safely handle the experience." The same identity carries
 * from candidate through onboarding into the permanent employee app (§7), and
 * families use the same screen (§19).
 *
 * THE THING THIS SCREEN MUST NOT DO
 *
 * It must not reveal whether a number is known to Joy. An honest "we don't have
 * that number" would turn this page into a way of asking whether Joy Health has
 * a client at a given address — a disclosure about someone's health made before
 * anybody has logged in. So an unknown number gets the same words, the same
 * code screen, and the same consumed quota as a known one; the difference is
 * only that no text is sent. That policy lives in `evaluateRequest`, and this
 * screen's job is not to undo it by being helpful.
 */

type Stage = "phone" | "code";

export default function PortalLogin() {
  const { otp, signIn, outbox } = usePortalSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [stage, setStage] = useState<Stage>("phone");
  const [phone, setPhone] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const parsed = normalizePhone(phone);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function requestCode(e164: E164) {
    setBusy(true);
    setError(null);
    try {
      const result = await otp.request(e164);
      setMessage(result.message);
      if (result.accepted) {
        setChallengeId(result.challengeId);
        setStage("code");
        setCooldown(OTP_POLICY.resendCooldownSeconds);
      } else if (result.retryAfterSeconds) {
        setCooldown(result.retryAfterSeconds);
      }
    } finally {
      setBusy(false);
    }
  }

  async function submitCode() {
    if (!challengeId) return;
    setBusy(true);
    setError(null);
    try {
      const result = await otp.verify({ challengeId, code });
      if (!result.verified) {
        setError(result.message);
        setCode("");
        return;
      }
      const resolved = signIn(result.identity!);

      if (resolved.outcome === "none") {
        navigate("/portal/closed", { replace: true });
        return;
      }
      if (resolved.outcome === "choose") {
        navigate("/portal/choose", { replace: true });
        return;
      }
      const next = params.get("next");
      navigate(next ?? portalRoute(resolved.grant!), { replace: true });
    } finally {
      setBusy(false);
    }
  }

  // ------------------------------------------------------------- code -----
  if (stage === "code") {
    return (
      <PortalFrame>
        <button
          type="button"
          onClick={() => {
            setStage("phone");
            setCode("");
            setError(null);
          }}
          className="mb-8 flex items-center gap-1.5 text-sm text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Change number
        </button>

        <h1 className="font-display text-2xl font-bold leading-tight tracking-tight">
          Enter your code
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          {message} Sent to {parsed.ok ? formatPhone(parsed.e164) : "your number"}.
        </p>

        <div className="mt-8">
          <InputOTP
            maxLength={OTP_POLICY.codeLength}
            value={code}
            onChange={setCode}
            onComplete={submitCode}
            aria-label="Verification code"
          >
            <InputOTPGroup className="gap-2">
              {Array.from({ length: OTP_POLICY.codeLength }, (_, i) => (
                <InputOTPSlot
                  key={i}
                  index={i}
                  className="h-14 w-12 rounded-2xl border-border bg-surface text-lg"
                />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>

        {error && (
          <p role="alert" className="mt-5 text-sm text-destructive">
            {error}
          </p>
        )}

        {/* Prototype only. No SMS provider is connected, so the code Joy
            generated is shown here — otherwise the demo cannot be clicked
            through at all. Delete this block the day an SMS adapter lands. */}
        {outbox.length > 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-border bg-surface-muted p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Prototype — no SMS is connected
            </p>
            <p className="mt-1 text-sm">
              The text Joy would have sent: “{outbox[outbox.length - 1].body}”
            </p>
          </div>
        )}

        <Button
          className="mt-8 h-12 w-full rounded-2xl text-base"
          disabled={busy || code.length < OTP_POLICY.codeLength}
          onClick={submitCode}
        >
          Continue
        </Button>

        <button
          type="button"
          disabled={cooldown > 0 || busy}
          onClick={() => parsed.ok && requestCode(parsed.e164)}
          className="mt-5 w-full text-center text-sm text-muted-foreground disabled:opacity-60"
        >
          {cooldown > 0 ? `Send again in ${cooldown}s` : "Send the code again"}
        </button>
      </PortalFrame>
    );
  }

  // ------------------------------------------------------------ phone -----
  return (
    <PortalFrame>
      <p className="font-display text-xs uppercase tracking-[0.18em] text-muted-foreground">
        Joy Health
      </p>
      <h1 className="mt-6 font-display text-2xl font-bold leading-tight tracking-tight">
        Sign in
      </h1>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        Enter your mobile number and we'll text you a code. No password to remember.
      </p>

      <form
        className="mt-8"
        onSubmit={(e) => {
          e.preventDefault();
          if (parsed.ok) requestCode(parsed.e164);
        }}
      >
        <label htmlFor="portal-phone" className="block text-base font-medium">
          Mobile number
        </label>
        <Input
          id="portal-phone"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(713) 555-0100"
          className="mt-3 h-14 rounded-2xl border-border bg-surface px-4 text-base"
        />

        <Button
          type="submit"
          className="mt-6 h-12 w-full rounded-2xl text-base"
          disabled={!parsed.ok || busy || cooldown > 0}
        >
          {cooldown > 0 ? `Try again in ${cooldown}s` : "Send code"}
        </Button>
      </form>

      {message && stage === "phone" && (
        <p role="status" className="mt-5 text-sm text-muted-foreground">
          {message}
        </p>
      )}

      <p className="mt-10 text-sm text-muted-foreground">
        Trouble signing in? Call the office on{" "}
        <a href="tel:+17132319662" className="underline underline-offset-4">
          (713) 231-9662
        </a>
        .
      </p>
    </PortalFrame>
  );
}
