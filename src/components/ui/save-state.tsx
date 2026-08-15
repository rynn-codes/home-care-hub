import { Check, CloudOff, Loader2, TriangleAlert } from "lucide-react";
import type { SaveStatus } from "@/hooks/use-autosave";
import { cn } from "@/lib/utils";

interface SaveStateProps {
  status: SaveStatus;
  lastSavedAt?: Date | null;
  error?: string | null;
  className?: string;
}

function relativeTime(at: Date) {
  const seconds = Math.round((Date.now() - at.getTime()) / 1000);
  if (seconds < 45) return "just now";
  if (seconds < 90) return "a minute ago";
  if (seconds < 3600) return `${Math.round(seconds / 60)} minutes ago`;
  return at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/**
 * The save indicator required by section 14.
 *
 * Every state says what is true and, when something went wrong, that the work is
 * not lost — section 43 is explicit that a generic "Something went wrong" is
 * unacceptable when a more useful state is known. Status is announced politely
 * for screen readers and carries an icon as well as colour, since colour must
 * never be the only signal.
 */
export function SaveState({ status, lastSavedAt, error, className }: SaveStateProps) {
  const content = {
    idle: null,
    saving: {
      icon: <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />,
      text: "Saving…",
      tone: "text-muted-foreground",
    },
    saved: {
      icon: <Check className="h-3.5 w-3.5" aria-hidden="true" />,
      text: lastSavedAt ? `Saved ${relativeTime(lastSavedAt)}` : "Saved",
      tone: "text-muted-foreground",
    },
    offline: {
      icon: <CloudOff className="h-3.5 w-3.5" aria-hidden="true" />,
      text: "Saved on this device",
      tone: "text-[hsl(var(--warning))]",
    },
    error: {
      icon: <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />,
      text: "Not saved yet — your work is safe here",
      tone: "text-destructive",
    },
  }[status];

  if (!content) return null;

  return (
    <span
      role="status"
      aria-live="polite"
      title={error ?? undefined}
      className={cn("inline-flex items-center gap-1.5 text-xs", content.tone, className)}
    >
      {content.icon}
      {content.text}
    </span>
  );
}
