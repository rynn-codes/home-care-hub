import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { MemoryOtpService, MemoryPortalDirectory, MemorySmsSender } from "@/domain/portal/memoryAdapters";
import { seedPortalGrants } from "@/lib/portalSeed";
import type { PortalGrant, PortalIdentity } from "@/domain/portal/identity";
import { resolveMode, type ModeResolution, type RememberedMode } from "@/domain/portal/mode";
import type { OtpService } from "@/domain/portal/ports";

/**
 * The portal's session, held in the browser.
 *
 * A NOTE ON WHAT THIS IS AND IS NOT
 *
 * This holds a verified identity in the browser. That is fine for a prototype
 * and wrong for production, and the difference is not a detail: the real
 * session must be an httpOnly cookie or a server-verified token, because a
 * portal session in JavaScript is readable by anything that gets script into
 * the page. The `OtpService` port is the seam — swapping `MemoryOtpService` for
 * an edge function moves verification server side without this file changing
 * shape.
 *
 * It is mirrored into `sessionStorage` so a refresh does not throw somebody
 * back to the login screen. That is a prototype affordance and nothing more:
 * sessionStorage, not localStorage, so it dies with the tab rather than sitting
 * on a shared phone until someone clears it. It does not make the design above
 * any less wrong, and restoring re-resolves the grants rather than trusting
 * what was stored, so a revoked grant cannot be resurrected by a stale blob.
 *
 * What *is* durable here is the remembered mode. It is a preference, not a
 * credential: knowing that somebody last used the work portal reveals nothing
 * and grants nothing. Grants are re-read on every sign-in and the remembered
 * value is checked against them, so a stale preference cannot outlive the
 * access it refers to.
 */

const REMEMBERED_KEY = "joy.portal.mode";
const SESSION_KEY = "joy.portal.session";

function readStoredIdentity(): PortalIdentity | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as PortalIdentity) : null;
  } catch {
    return null;
  }
}

function writeStoredIdentity(identity: PortalIdentity | null) {
  try {
    if (identity) sessionStorage.setItem(SESSION_KEY, JSON.stringify(identity));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // A refresh will then land on the login screen. Annoying, not broken.
  }
}

function readRemembered(): RememberedMode | null {
  try {
    const raw = localStorage.getItem(REMEMBERED_KEY);
    return raw ? (JSON.parse(raw) as RememberedMode) : null;
  } catch {
    // A private-mode browser or a corrupt value. Falling back to asking is
    // always safe; throwing here would block the login screen entirely.
    return null;
  }
}

function writeRemembered(mode: RememberedMode | null) {
  try {
    if (mode) localStorage.setItem(REMEMBERED_KEY, JSON.stringify(mode));
    else localStorage.removeItem(REMEMBERED_KEY);
  } catch {
    // Not being able to remember costs one extra tap next time. Not fatal.
  }
}

interface PortalSession {
  identity: PortalIdentity | null;
  /**
   * The texts Joy would have sent, so the prototype can be clicked through.
   *
   * This exists only because no SMS provider is connected and the code is
   * random — without it nobody can demo their own portal. It is read by one
   * component, which labels it unmistakably. When a provider is wired this
   * goes, and the fact that it is a single named field rather than a console
   * log is what makes that a deletion rather than a hunt.
   */
  outbox: ReadonlyArray<{ body: string }>;
  grant: PortalGrant | null;
  resolution: ModeResolution | null;
  otp: OtpService;
  signIn: (identity: PortalIdentity) => ModeResolution;
  chooseGrant: (grant: PortalGrant) => void;
  signOut: () => void;
}

const Ctx = createContext<PortalSession | null>(null);

export function PortalSessionProvider({ children }: { children: React.ReactNode }) {
  // Restore by re-resolving, never by trusting the stored grant. The phone was
  // verified; what it unlocks is decided again from live grants each time.
  const restored = useMemo(() => {
    const stored = readStoredIdentity();
    return stored ? { identity: stored, resolution: resolveMode(stored, readRemembered()) } : null;
  }, []);

  const [identity, setIdentity] = useState<PortalIdentity | null>(restored?.identity ?? null);
  const [grant, setGrant] = useState<PortalGrant | null>(restored?.resolution.grant ?? null);
  const [resolution, setResolution] = useState<ModeResolution | null>(
    restored?.resolution ?? null,
  );

  // One instance for the life of the app, so challenges and rate limits
  // survive a re-render. A new service per render would reset the cooldown
  // and quietly defeat the throttle.
  const sms = useMemo(() => new MemorySmsSender("ghl"), []);
  const otp = useMemo<OtpService>(() => {
    const directory = new MemoryPortalDirectory(seedPortalGrants);
    return new MemoryOtpService(directory, sms);
  }, [sms]);

  const signIn = useCallback((next: PortalIdentity) => {
    const resolved = resolveMode(next, readRemembered());
    writeStoredIdentity(next);
    setIdentity(next);
    setResolution(resolved);
    setGrant(resolved.grant);
    return resolved;
  }, []);

  const chooseGrant = useCallback((next: PortalGrant) => {
    setGrant(next);
    writeRemembered({ audience: next.audience, subjectPersonId: next.subjectPersonId });
  }, []);

  const signOut = useCallback(() => {
    writeStoredIdentity(null);
    setIdentity(null);
    setGrant(null);
    setResolution(null);
    // The preference deliberately survives sign-out. It is not a credential,
    // and clearing it would make every sign-in ask again — the behaviour
    // Karynn chose against.
  }, []);

  const value = useMemo(
    () => ({ identity, grant, resolution, otp, outbox: sms.outbox, signIn, chooseGrant, signOut }),
    [identity, grant, resolution, otp, sms, signIn, chooseGrant, signOut],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePortalSession(): PortalSession {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePortalSession must be used inside PortalSessionProvider");
  return ctx;
}
