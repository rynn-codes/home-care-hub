import { STATUS_LABELS, type EnvelopeStatus } from "@/domain/signing/envelopes";
import { cn } from "@/lib/utils";

const PILL: Record<EnvelopeStatus, string> = {
  draft: "bg-[var(--hairline-soft)] text-[var(--ink-body)]",
  sent: "bg-[#FFFAEB] text-[#B54708]",
  viewed: "bg-[#FFFAEB] text-[#B54708]",
  signed: "bg-[#EFF8FF] text-[#175CD3]",
  completed: "bg-[#ECFDF3] text-[#027A48]",
  declined: "bg-[#FEF3F2] text-[#B42318]",
  voided: "bg-[var(--hairline-soft)] text-[var(--ink-muted)] line-through",
};

export function StatusPill({ status, className }: { status: EnvelopeStatus; className?: string }) {
  return <span className={cn("inline-flex shrink-0 rounded-full px-2 py-[2px] text-[11px] font-medium", PILL[status], className)}>{STATUS_LABELS[status]}</span>;
}
