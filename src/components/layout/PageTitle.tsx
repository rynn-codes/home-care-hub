import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The one gradient definition. Three titles wear it — Home's greeting, The
 * Brain's H1 and Admissions — and it is painted across the whole line, which
 * is why the element must be `w-fit`: the ramp is painted across the box, so
 * a full-width h1 hands a short title only its darkest end.
 */
export const OMBRE: CSSProperties = {
  background: "linear-gradient(96deg, #1B1B1F 0%, #3B2FB8 52%, #1407A2 100%)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  WebkitTextFillColor: "transparent",
  color: "transparent",
};

/** A span inside a PageTitle that keeps its own colour — an emoji, which the gradient would blank out. */
export function PlainSpan({ children }: { children: ReactNode }) {
  return (
    <span aria-hidden="true" style={{ WebkitTextFillColor: "initial", color: "initial" }}>
      {children}
    </span>
  );
}

export function PageTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h1
      style={OMBRE}
      className={cn("m-0 w-fit max-w-full text-[30px] font-bold leading-[1.15] tracking-[-.025em]", className)}
    >
      {children}
    </h1>
  );
}
