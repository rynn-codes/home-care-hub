import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Lock } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useDemo } from "@/context/DemoDataProvider";
import { AREA_LABELS, areaForPath, canView, landingFor, whyNotArea } from "@/domain/access/roles";

/**
 * The router's door. A path whose area the session cannot view renders a
 * polite refusal instead of the screen — the second of the three doors in
 * domain/access/roles (the sidebar hides the row; the provider refuses the
 * write). A typed URL is how a surveyor would otherwise reach a screen the
 * menu never showed them.
 */
export function RequireArea({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { currentUser } = useDemo();
  const area = areaForPath(pathname);
  if (!area || canView(currentUser.role, area)) return <>{children}</>;
  return (
    <>
      <PageHeader title={AREA_LABELS[area]} />
      <div className="mx-auto mt-6 max-w-[560px] rounded-[16px] border border-[var(--hairline)] bg-[var(--paper)] px-6 py-8 text-center">
        <span
          aria-hidden="true"
          className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[var(--wash-strong)]"
        >
          <Lock className="h-[18px] w-[18px] text-muted-foreground" />
        </span>
        <h2 className="m-0 mt-4 text-[17px] font-semibold tracking-[-.01em]">Not part of this session</h2>
        <p className="m-0 mt-2 text-[13.5px] leading-[1.6] text-[var(--ink-body)]">{whyNotArea(currentUser.role, area)}</p>
        <Link
          to={landingFor(currentUser.role)}
          className="mt-5 inline-flex h-9 items-center rounded-[10px] bg-primary px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#2A1BD1]"
        >
          Back to what you can see
        </Link>
      </div>
    </>
  );
}
