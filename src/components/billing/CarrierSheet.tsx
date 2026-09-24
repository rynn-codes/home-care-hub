import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { packetGaps, type LtciEnrollment, type ReleaseCheck } from "@/domain/billing/ltci";

/**
 * A client's long-term care policy as the carrier words it. Save what is
 * known; the packet says whether it is enough.
 */
export function CarrierSheet({
  open,
  onOpenChange,
  enrollment,
  onSave,
  fromAdmission,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enrollment: LtciEnrollment | null;
  onSave: (clientPersonId: string, patch: Omit<LtciEnrollment, "clientPersonId" | "clientName">) => void;
  fromAdmission: ReleaseCheck | null;
}) {
  const [carrier, setCarrier] = useState("");
  const [policy, setPolicy] = useState("");
  const [fax, setFax] = useState("");
  const [email, setEmail] = useState("");
  const [release, setRelease] = useState(false);
  const [expires, setExpires] = useState("");

  useEffect(() => {
    setCarrier(enrollment?.carrier ?? "");
    setPolicy(enrollment?.policyReference ?? "");
    setFax(enrollment?.claimsFax ?? "");
    setEmail(enrollment?.claimsEmail ?? "");
    setRelease(enrollment?.releaseOnFile ?? false);
    setExpires(enrollment?.releaseExpiresOn ?? "");
  }, [enrollment]);

  if (!enrollment) return null;
  const clean = (s: string) => (s.trim() === "" ? null : s.trim());
  const draft: LtciEnrollment = { ...enrollment, carrier: clean(carrier), policyReference: clean(policy), claimsFax: clean(fax), claimsEmail: clean(email), releaseOnFile: release, releaseExpiresOn: clean(expires) };
  const missing = packetGaps(draft);

  const field = (label: string, value: string, set: (v: string) => void, hint: string, type = "text") => (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[.07em] text-muted-foreground">{label}</span>
      <input type={type} value={value} onChange={(e) => set(e.target.value)} className="h-[38px] rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] px-3 text-[13px] outline-none transition-colors focus:border-primary" />
      <span className="text-[11px] text-muted-foreground [text-wrap:pretty]">{hint}</span>
    </label>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-[440px]">
        <SheetHeader className="space-y-1.5 text-left">
          <SheetTitle className="text-[17px] tracking-[-.01em]">{enrollment.clientName}</SheetTitle>
          <SheetDescription className="text-[12.5px] leading-[1.55] [text-wrap:pretty]">
            Their long-term care policy, as the carrier words it. Save what you know — the packet checks whether it is enough, so nothing has to wait on a sticky note.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 flex flex-col gap-3.5">
          {field("Carrier", carrier, setCarrier, "The insurer's name as it appears on the policy")}
          {field("Policy or claim number", policy, setPolicy, "Whatever the carrier uses to identify the claim")}
          {field("Claims fax", fax, setFax, "Most carriers still want a fax", "tel")}
          {field("Claims email", email, setEmail, "Where one exists", "email")}
          <div className="flex flex-col gap-2.5 rounded-[12px] border border-[var(--hairline)] p-3.5">
            <span className="text-[13px] font-medium">Signed release</span>
            {fromAdmission && (
              <p
                className={cn(
                  "m-0 rounded-[9px] px-3 py-2 text-[11.5px] leading-[1.45] [text-wrap:pretty]",
                  fromAdmission.onFile ? "border border-[#C7EED8] bg-[#ECFDF3] text-[#027A48]" : fromAdmission.source === "declined" ? "border border-[#F7D2CE] bg-[#FEF3F2] text-[#B42318]" : "border border-[#FCE8B6] bg-[#FFFAEB] text-[#B54708]",
                )}
              >
                {fromAdmission.note}
              </p>
            )}
            <label className="flex items-start gap-2.5">
              <input type="checkbox" checked={release} onChange={(e) => setRelease(e.target.checked)} className="mt-[3px] h-3.5 w-3.5 accent-[var(--primary)]" />
              <span className="flex flex-col gap-[2px]">
                <span className="text-[12.5px] font-medium">{fromAdmission?.onFile ? "Record a separate release for this carrier" : "Record a signed release"}</span>
                <span className="text-[11.5px] leading-[1.45] text-muted-foreground [text-wrap:pretty]">
                  {fromAdmission?.onFile
                    ? "Only if this carrier asked for their own form. What you record here is what Joy will rely on."
                    : "The client's written permission for Joy to send their care record out. This is health information leaving the agency, and they are the only person who can allow it — so a packet will not go without one."}
                </span>
              </span>
            </label>
            {release && field("Release expires", expires, setExpires, "Leave blank if it does not expire", "date")}
          </div>
        </div>
        <div className={cn("mt-4 rounded-[12px] p-3.5", missing.length === 0 ? "bg-[#ECFDF3]" : "border border-[#FCE8B6] bg-[#FFFCF5]")}>
          {missing.length === 0 ? (
            <p className="m-0 text-[12.5px] leading-[1.5] text-[#027A48] [text-wrap:pretty]">This policy has everything a packet needs. Whether one can go still depends on the week's invoice being paid.</p>
          ) : (
            <>
              <p className="m-0 text-[11px] font-semibold uppercase tracking-[.08em] text-[#B54708]">Still missing</p>
              <ul className="m-0 mt-1.5 flex list-none flex-col gap-1 p-0">
                {missing.map((m) => (
                  <li key={m} className="text-[12px] leading-[1.45] text-[#7A6320] [text-wrap:pretty]">
                    {m}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            onSave(enrollment.clientPersonId, { carrier: draft.carrier, policyReference: draft.policyReference, claimsFax: draft.claimsFax, claimsEmail: draft.claimsEmail, releaseOnFile: draft.releaseOnFile, releaseExpiresOn: draft.releaseExpiresOn });
            onOpenChange(false);
          }}
          className="mt-4 h-[42px] w-full rounded-[10px] bg-primary text-[13.5px] font-medium text-white transition-colors hover:bg-[#2A1BD1]"
        >
          Save policy details
        </button>
      </SheetContent>
    </Sheet>
  );
}
