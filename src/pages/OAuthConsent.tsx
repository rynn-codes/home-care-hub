import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type OAuthClient = { name?: string; redirect_uri?: string; scope?: string };
type Details = { client?: OAuthClient; scope?: string; redirect_url?: string; redirect_to?: string };

const authOAuth = () =>
  (supabase.auth as unknown as {
    oauth: {
      getAuthorizationDetails: (id: string) => Promise<{ data: Details | null; error: { message: string } | null }>;
      approveAuthorization: (id: string) => Promise<{ data: Details | null; error: { message: string } | null }>;
      denyAuthorization: (id: string) => Promise<{ data: Details | null; error: { message: string } | null }>;
    };
  }).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<Details | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) return setError("Missing authorization_id");
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/login?next=" + encodeURIComponent(next);
        return;
      }
      setAccount(sess.session.user.email ?? null);
      const { data, error } = await authOAuth().getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) return setError(error.message);
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const api = authOAuth();
    const { data, error } = approve
      ? await api.approveAuthorization(authorizationId)
      : await api.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      return setError(error.message);
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      return setError("No redirect returned by the authorization server.");
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? "this app";

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md p-6 space-y-5">
        {error ? (
          <>
            <h1 className="font-display text-xl font-bold">Authorization problem</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
          </>
        ) : !details ? (
          <p className="text-sm text-muted-foreground">Loading authorization request…</p>
        ) : (
          <>
            <div>
              <h1 className="font-display text-xl font-bold">
                Connect {clientName} to Home Care Hub
              </h1>
              <p className="text-sm text-muted-foreground mt-2">
                {clientName} will be able to call this app's enabled tools while you are signed in.
              </p>
            </div>
            <dl className="text-sm space-y-2">
              {account && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Signed in as</dt>
                  <dd className="font-medium">{account}</dd>
                </div>
              )}
              {details.client?.redirect_uri && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Redirect</dt>
                  <dd className="font-medium break-all text-right">{details.client.redirect_uri}</dd>
                </div>
              )}
              {(details.scope ?? details.client?.scope) && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Requested</dt>
                  <dd className="font-medium text-right">{details.scope ?? details.client?.scope}</dd>
                </div>
              )}
            </dl>
            <p className="text-xs text-muted-foreground">
              This does not bypass this app's permissions or backend policies.
            </p>
            <div className="flex gap-3">
              <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
                Approve
              </Button>
              <Button variant="outline" className="flex-1" disabled={busy} onClick={() => decide(false)}>
                Cancel connection
              </Button>
            </div>
          </>
        )}
      </Card>
    </main>
  );
}
