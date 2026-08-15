import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";

interface ModuleNotBuiltProps {
  /** Module name as it appears in the Joy navigation. */
  title: string;
  /** One line on what this module is for, in the user's words. */
  description: string;
  /** Sprint that delivers it, per the Codex Engineering Kickoff. */
  sprint: string;
  /** What the approved specs say this screen will contain. */
  scope: string[];
  /** Anything that has to be settled before the module can be built. */
  blockedBy?: string;
}

/**
 * Placeholder for a navigation destination whose module has not been built yet.
 *
 * Joy's navigation is fixed by section 6 of the engineering brief, so these routes
 * exist before their modules do. Rather than leave a dead link — or worse, show a
 * screen of invented data that reads as working software — this states plainly that
 * the module is not built, and what it will contain when it is.
 */
export function ModuleNotBuilt({ title, description, sprint, scope, blockedBy }: ModuleNotBuiltProps) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <Card className="p-8 max-w-3xl">
        <p className="text-xs font-medium uppercase tracking-widest text-primary">
          Not built yet · {sprint}
        </p>
        <h2 className="mt-3 text-lg font-semibold">
          This module is specified but has no implementation.
        </h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-prose">
          The route and navigation are in place so the shell matches the approved Joy
          navigation. Nothing on this screen is wired to real data, and no data has been
          invented to make it look finished.
        </p>

        <h3 className="mt-7 text-sm font-semibold">What it will contain</h3>
        <ul className="mt-3 space-y-2">
          {scope.map((item) => (
            <li key={item} className="flex gap-3 text-sm text-muted-foreground">
              <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-border" />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        {blockedBy && (
          <p className="mt-7 border-t border-border pt-4 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Blocked by:</span> {blockedBy}
          </p>
        )}
      </Card>
    </>
  );
}
