import { Link, useLocation } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useDemo } from "@/context/DemoDataProvider";
import { canView } from "@/domain/access/roles";
import { readCameFrom } from "@/lib/navigation";

export interface Crumb {
  label: string;
  to: string;
}

function Sep() {
  return <ChevronRight className="h-3.5 w-3.5 flex-none text-[#C7C7CF]" aria-hidden="true" />;
}

/**
 * Home / Section / Current. Every screen carries one, so a record page says
 * which directory it came from — which a bare back arrow never did.
 *
 * A screen opened from somewhere other than its directory (see
 * lib/navigation) shows that origin instead. An auditor with no Home grant
 * gets no Home link: a crumb to a screen the router refuses is a broken link.
 */
export function Breadcrumb({ parents, current }: { parents?: readonly Crumb[]; current: string }) {
  const from = readCameFrom(useLocation().state);
  const trail = from ? [{ label: from.label, to: from.to }] : (parents ?? []);
  const { currentUser } = useDemo();
  const home = canView(currentUser.role, "home");
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2.5 text-[13px]">
      {home && (
        <Link to="/" className="text-muted-foreground transition-colors hover:text-primary">
          Home
        </Link>
      )}
      {trail.map((c, i) => (
        <span key={c.to} className="flex items-center gap-2.5">
          {(home || i > 0) && <Sep />}
          <Link
            to={c.to}
            state={from?.reopen ? { reopen: from.reopen } : undefined}
            className="text-muted-foreground transition-colors hover:text-primary"
          >
            {c.label}
          </Link>
        </span>
      ))}
      {(home || trail.length > 0) && <Sep />}
      <span aria-current="page" className="min-w-0 truncate font-medium">
        {current}
      </span>
    </nav>
  );
}
