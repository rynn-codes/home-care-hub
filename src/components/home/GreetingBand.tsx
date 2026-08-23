import { format } from "date-fns";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useDemo } from "@/context/DemoDataProvider";

function accentWord(hour: number) {
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

/**
 * The greeting, to the approved mock's own values: 28px/700 with the
 * dark-to-indigo gradient running through the text, the wave outside the
 * gradient, and one light sub-line — date · Houston · weather — beneath.
 * The weather is seeded demo copy until a source is wired.
 */
export function GreetingBand() {
  const { firstName: authName } = useCurrentUser();
  const { currentUser } = useDemo();
  // The session's preferred name when it has one; otherwise the prototype's
  // "view as" persona, so the greeting matches the avatar and the sidebar.
  const firstName = authName || currentUser.name.trim().split(/\s+/)[0];
  const now = new Date();

  return (
    <section className="flex items-end justify-between gap-12">
      <div className="flex flex-col gap-2.5">
        <h1
          className="m-0 w-fit text-[28px] font-bold leading-[1.1] tracking-[-.03em]"
          style={{
            background: "linear-gradient(96deg,#1B1B1F 0%,#3B2FB8 52%,#1407A2 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Good {accentWord(now.getHours())}
          {firstName ? `, ${firstName}` : ""}.{" "}
          <span style={{ WebkitTextFillColor: "initial" }} aria-hidden="true">
            👋
          </span>
        </h1>
        <span className="text-[13.5px] font-light text-muted-foreground">
          {format(now, "EEEE, MMMM d")}
          {"  ·  "}Houston 92°
          {"  ·  "}Partly cloudy, H 96° L 78°
        </span>
      </div>
    </section>
  );
}
