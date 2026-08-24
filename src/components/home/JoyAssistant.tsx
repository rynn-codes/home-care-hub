import { Link } from "react-router-dom";
import { joyInsights } from "@/lib/joySeed";

/** Where each prepared item's action leads. The insight rows come from the
    seed; the destinations are the modules where the human decision happens. */
const insightDestinations: Record<string, string> = {
  j1: "/scheduling",
  j2: "/billing",
  j3: "/admissions",
};

/**
 * Joy Assistant — the mock's right-hand column: a quiet list of what Joy
 * prepared overnight, each row ending in an action a person takes. Under
 * section 26, Home-level AI is draft and propose authority only, and the
 * sub-line says so in plain words.
 */
export function JoyAssistant() {
  return (
    <section aria-label="Joy Assistant">
      <div className="mb-0.5 flex items-baseline justify-between">
        <h2 className="m-0 text-[17px] font-medium tracking-[-.02em]">Joy Assistant</h2>
        <span className="text-[12.5px] font-light text-muted-foreground">{joyInsights.length} items</span>
      </div>
      <p className="m-0 mb-2 text-[12.5px] font-light text-muted-foreground">
        Prepared for your review · Joy prepares, a human approves
      </p>
      {joyInsights.map((insight) => (
        <div key={insight.id} className="flex flex-col gap-1.5 border-t border-black/[.05] py-[15px]">
          <span className="text-[13.5px] font-normal leading-[1.55]">{insight.message}</span>
          <Link
            to={insightDestinations[insight.id] ?? "/"}
            className="text-[12.5px] font-medium text-primary hover:text-[#2A1BD1]"
          >
            {insight.action}
          </Link>
        </div>
      ))}
    </section>
  );
}
