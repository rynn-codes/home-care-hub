import { useState } from "react";
import { Check, Eye, TriangleAlert } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  NO_EXCLUSIONS,
  PACKET_STATE_LABELS,
  applyExclusions,
  destinations,
  packetChecks,
  packetPages,
  pageCount,
  type LtciEnrollment,
  type LtciPacket,
  type PacketExclusions,
  type PacketState,
} from "@/domain/billing/ltci";

const STATE_PILL: Record<PacketState, string> = {
  ready: "bg-[#EEF0FE] text-primary",
  sent: "bg-[#ECFDF3] text-[#027A48]",
  incomplete: "bg-[#FFFAEB] text-[#B54708]",
  needs_release: "bg-[#FFFAEB] text-[#B54708]",
  blocked: "bg-[#FEF3F2] text-[#B42318]",
};

const shortDay = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
const weekdayDay = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
};

const SECONDARY = "h-[38px] rounded-[10px] border border-[var(--hairline)] bg-[var(--paper)] px-3.5 text-[13px] text-[var(--ink-body)] transition-colors hover:bg-[var(--wash)] hover:text-foreground";

type Money = (n: number | null) => string;

/**
 * The reimbursement packets for the period, reviewed one at a time and
 * sent together. Joy assembles; a person approves; the fax goes.
 */
export function LtciWorkspace({
  open,
  onOpenChange,
  packets,
  enrollments,
  periodLabel,
  money,
  onSend,
  onEditCarrier,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packets: LtciPacket[];
  enrollments: LtciEnrollment[];
  periodLabel: string;
  money: Money;
  onSend: (packets: LtciPacket[]) => void;
  onEditCarrier: (clientPersonId: string) => void;
}) {
  const [index, setIndex] = useState<number | null>(null);
  const [approved, setApproved] = useState<Record<string, boolean>>({});
  const [exclusions, setExclusions] = useState<Record<string, PacketExclusions>>({});
  const [previewing, setPreviewing] = useState(false);
  const exclusionsFor = (id: string) => exclusions[id] ?? NO_EXCLUSIONS;
  const ready = packets.filter((p) => p.state === "ready").map((p) => applyExclusions(p, exclusionsFor(p.clientPersonId)));
  const current = index !== null && index < ready.length ? ready[index] : null;
  const finished = index !== null && current === null;
  const approvedPackets = ready.filter((p) => approved[p.clientPersonId]);
  const sentPackets = packets.filter((p) => p.state === "sent");
  const enrollmentFor = (id: string) => enrollments.find((e) => e.clientPersonId === id);
  const change = (next: boolean) => {
    if (!next) {
      setIndex(null);
      setApproved({});
      setExclusions({});
      setPreviewing(false);
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent className="max-w-[760px] gap-0 overflow-hidden p-0">
        <div className="border-b border-[var(--hairline)] px-6 py-4 pr-12">
          <DialogTitle className="m-0 text-[17px] font-semibold tracking-[-.01em]">LTCI reimbursement packets</DialogTitle>
          <p className="m-0 mt-1 flex flex-wrap items-baseline gap-2 text-[12.5px]">
            <span className="font-medium text-primary">Service period: {periodLabel}</span>
            <span className="text-muted-foreground">{current ? `Packet ${(index ?? 0) + 1} of ${ready.length}` : finished ? "Review complete" : `${packets.length} clients`}</span>
          </p>
        </div>
        {current && previewing ? (
          <PacketPreview
            packet={packets.find((p) => p.clientPersonId === current.clientPersonId) ?? current}
            exclusions={exclusionsFor(current.clientPersonId)}
            enrollment={enrollmentFor(current.clientPersonId)}
            money={money}
            onChange={(x) => setExclusions((all) => ({ ...all, [current.clientPersonId]: x }))}
            onBack={() => setPreviewing(false)}
          />
        ) : current ? (
          <PacketReview
            packet={current}
            enrollment={enrollmentFor(current.clientPersonId)}
            money={money}
            onBack={() => setIndex(null)}
            onPreview={() => setPreviewing(true)}
            onApprove={() => {
              setApproved((a) => ({ ...a, [current.clientPersonId]: true }));
              setIndex((i) => (i === null ? null : i + 1));
            }}
            isLast={(index ?? 0) + 1 >= ready.length}
          />
        ) : finished ? (
          <PacketSummary approved={sentPackets.length > 0 ? sentPackets : approvedPackets} enrollments={enrollments} periodLabel={periodLabel} money={money} sent={sentPackets.length > 0} onBack={() => change(false)} onSend={() => onSend(approvedPackets)} />
        ) : (
          <PacketList packets={packets} enrollments={enrollments} money={money} onReview={() => setIndex(0)} onEditCarrier={onEditCarrier} readyCount={ready.length} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PacketList({ packets, enrollments, money, onReview, onEditCarrier, readyCount }: { packets: LtciPacket[]; enrollments: LtciEnrollment[]; money: Money; onReview: () => void; onEditCarrier: (id: string) => void; readyCount: number }) {
  const TH = "px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[.07em] text-muted-foreground";
  return (
    <>
      <DialogDescription className="sr-only">LTCI packets for the care week before last, built on paid invoices, sent to the carrier on the client's behalf.</DialogDescription>
      <div className="max-h-[52vh] overflow-y-auto px-6 py-4">
        {packets.length === 0 ? (
          <p className="m-0 rounded-xl bg-[var(--wash)] px-3.5 py-3 text-[12.5px] text-muted-foreground [text-wrap:pretty]">
            No client is marked as holding a long-term care policy. Set the payer type to “Private Pay + LTCI” on a client's record and their packet appears here.
          </p>
        ) : (
          <div className="overflow-hidden rounded-[12px] border border-[var(--hairline)]">
            <table className="w-full border-collapse">
              <caption className="sr-only">Every client on a policy, and what each packet still needs</caption>
              <thead>
                <tr className="bg-[var(--paper-sunken)]">
                  {["Client", "Carrier", "Paid invoice", "Care notes", "Packet"].map((h) => (
                    <th key={h} scope="col" className={cn(TH, "text-left")}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {packets.map((p) => {
                  const e = enrollments.find((x) => x.clientPersonId === p.clientPersonId);
                  const fixable = p.state === "incomplete" || p.state === "needs_release";
                  const filed = p.visits.filter((v) => v.noteFiled).length;
                  return (
                    <tr key={p.clientPersonId} className={cn("border-t border-[var(--hairline-soft)]", fixable && "cursor-pointer transition-colors hover:bg-[var(--wash)]")} onClick={fixable ? () => onEditCarrier(p.clientPersonId) : undefined}>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2.5">
                          <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-[#EEF0FE] text-[11px] font-semibold text-primary">
                            {p.clientName
                              .split(/\s+/)
                              .slice(0, 2)
                              .map((w) => w[0])
                              .join("")}
                          </span>
                          <span className="flex flex-col leading-[1.35]">
                            <span className="text-[13px] font-medium">{p.clientName}</span>
                            <span className="text-[11.5px] text-muted-foreground tabular-nums">{p.invoiceTotal === null ? "No invoice" : money(p.invoiceTotal)}</span>
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[12.5px]">{e?.carrier ?? <span className="text-primary underline decoration-dotted underline-offset-2">Add carrier</span>}</td>
                      <td className="px-4 py-3 text-[12.5px]">
                        {p.paidOn ? (
                          <span className="flex items-center gap-1.5 text-[#027A48]">
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                            Paid {shortDay(p.paidOn)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Not paid yet</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[12.5px] text-[var(--ink-body)]">{p.visits.length === 0 ? <span className="text-muted-foreground">None</span> : `${filed} ${filed === 1 ? "note" : "notes"}`}</td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] font-medium", STATE_PILL[p.state])}>{PACKET_STATE_LABELS[p.state]}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {packets.some((p) => p.blockers.length > 0) && (
          <div className="mt-3.5 flex flex-col gap-2.5">
            {packets
              .filter((p) => p.blockers.length > 0)
              .map((p) => (
                <div key={p.clientPersonId} className="rounded-[12px] border border-[#FCE8B6] bg-[#FFFCF5] p-3.5">
                  <span className="flex items-center gap-2">
                    <TriangleAlert className="h-3.5 w-3.5 flex-none text-[#B54708]" aria-hidden="true" />
                    <span className="text-[12.5px] font-medium">{p.clientName}</span>
                    {(p.state === "incomplete" || p.state === "needs_release") && (
                      <button type="button" onClick={() => onEditCarrier(p.clientPersonId)} className="ml-auto rounded-[8px] border border-[#FCE8B6] bg-[var(--paper)] px-2.5 py-1 text-[11.5px] font-medium text-[#B54708] transition-colors hover:bg-[#FFFAEB]">
                        {p.state === "incomplete" ? "Add carrier details" : "Record the release"}
                      </button>
                    )}
                  </span>
                  <ul className="m-0 mt-1.5 flex list-none flex-col gap-1 p-0">
                    {p.blockers.map((b) => (
                      <li key={b} className="text-[12px] leading-[1.45] text-[#7A6320] [text-wrap:pretty]">
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 border-t border-[var(--hairline)] px-6 py-3.5">
        <span className="text-[11.5px] text-muted-foreground">Delivery method: fax + email</span>
        <button
          type="button"
          disabled={readyCount === 0}
          onClick={onReview}
          className={cn("ml-auto h-[38px] rounded-[10px] px-[18px] text-[13px] font-medium transition-colors", readyCount === 0 ? "cursor-not-allowed bg-[var(--wash-strong)] text-muted-foreground/50" : "bg-primary text-white hover:bg-[#2A1BD1]")}
        >
          {readyCount === 0 ? "No packets ready" : `Review ${readyCount} ready ${readyCount === 1 ? "packet" : "packets"}`}
        </button>
      </div>
    </>
  );
}

function PacketReview({ packet, enrollment, money, onBack, onPreview, onApprove, isLast }: { packet: LtciPacket; enrollment: LtciEnrollment | undefined; money: Money; onBack: () => void; onPreview: () => void; onApprove: () => void; isLast: boolean }) {
  if (!enrollment) return null;
  const checks = packetChecks(packet, enrollment);
  const blocked = packet.blockers.length > 0;
  const pages = packetPages(packet);
  const to = destinations(enrollment);
  return (
    <>
      <DialogDescription className="sr-only">
        {packet.clientName}'s reimbursement packet for {packet.periodStart} to {packet.periodEnd}, with what Joy verified and the pages it will send.
      </DialogDescription>
      <div className="max-h-[58vh] overflow-y-auto px-6 py-4">
        <div className="flex items-start gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="m-0 text-[19px] font-semibold tracking-[-.01em]">{packet.clientName}</h2>
            <p className="m-0 text-[12.5px] text-muted-foreground">
              {enrollment.carrier}
              {packet.policyReference ? ` · ${packet.policyReference}` : ""}
            </p>
          </div>
          <div className="ml-auto flex flex-none flex-col items-end gap-1">
            <span className="text-[21px] font-semibold tracking-[-.01em] tabular-nums">{money(packet.invoiceTotal)}</span>
            <span className="text-[11.5px] text-muted-foreground">
              {pageCount(packet)} pages · {to.length === 2 ? "fax + email" : to.length === 1 ? "fax" : "no destination"}
            </span>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-1.5">
          {checks.map((c) => (
            <div key={c.key} className={cn("flex items-start gap-3 rounded-xl px-3.5 py-2.5", c.ok ? "bg-[var(--wash)]" : "bg-[#FFFAEB]")}>
              <span className={cn("mt-px flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full text-[10px] font-bold", c.ok ? "bg-[#ECFDF3] text-[#12B76A]" : "bg-[#FEF0C7] text-[#B54708]")} aria-hidden="true">
                {c.ok ? <Check className="h-3 w-3" strokeWidth={3} /> : "!"}
              </span>
              <span className="text-[13px] leading-[1.4]">
                {c.label}
                <span className="text-muted-foreground"> · {c.detail}</span>
              </span>
            </div>
          ))}
        </div>
        <h3 className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-[.08em] text-muted-foreground">Packet assembly</h3>
        <div className="overflow-hidden rounded-[12px] border border-[var(--hairline)]">
          {pages.map((p) => (
            <div key={p.page} className="flex items-center gap-3 border-b border-[var(--hairline-soft)] px-3.5 py-2.5 last:border-0">
              <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full bg-[var(--wash-strong)] text-[11px] font-medium text-[var(--ink-body)] tabular-nums">{p.page}</span>
              <span className="text-[13px]">{p.label}</span>
              <span className="ml-auto text-right text-[11.5px] text-muted-foreground tabular-nums">{p.detail}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-[var(--hairline)] px-6 py-3.5">
        <button type="button" onClick={onBack} className={SECONDARY}>
          All packets
        </button>
        <button type="button" onClick={onPreview} className={cn(SECONDARY, "flex items-center gap-1.5")}>
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          Preview packet
        </button>
        {blocked && <span className="min-w-0 flex-1 text-[12px] leading-[1.4] text-[#B54708] [text-wrap:pretty]">{packet.blockers[0]}</span>}
        <button type="button" disabled={blocked} onClick={onApprove} className="ml-auto h-[38px] rounded-[10px] bg-primary px-[18px] text-[13px] font-medium text-white transition-colors hover:bg-[#2A1BD1] disabled:cursor-not-allowed disabled:opacity-50">
          {isLast ? "Approve & finish" : "Approve & next"}
        </button>
      </div>
    </>
  );
}

function PacketPreview({ packet, exclusions, enrollment, money, onChange, onBack }: { packet: LtciPacket; exclusions: PacketExclusions; enrollment: LtciEnrollment | undefined; money: Money; onChange: (x: PacketExclusions) => void; onBack: () => void }) {
  const shown = applyExclusions(packet, exclusions);
  const toggleNote = (date: string) => onChange({ ...exclusions, noteDates: exclusions.noteDates.includes(date) ? exclusions.noteDates.filter((d) => d !== date) : [...exclusions.noteDates, date] });
  const BOX = "h-4 w-4 rounded border-[var(--hairline)] accent-[hsl(var(--primary))]";
  return (
    <>
      <DialogDescription className="sr-only">What {packet.clientName}'s packet will contain, with a box to leave any page out.</DialogDescription>
      <div className="max-h-[58vh] overflow-y-auto px-6 py-4">
        <div className="flex items-baseline gap-3">
          <h2 className="m-0 text-[17px] font-semibold tracking-[-.01em]">What the carrier will receive</h2>
          <span className="ml-auto text-[12px] text-muted-foreground tabular-nums">{pageCount(shown)} pages</span>
        </div>
        <p className="m-0 mt-1 text-[12.5px] text-muted-foreground">
          {enrollment?.carrier ?? "Carrier"}
          {packet.policyReference ? ` · ${packet.policyReference}` : ""}
        </p>
        <h3 className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-[.08em] text-muted-foreground">Cover letter and paid invoice</h3>
        <div className="overflow-hidden rounded-[12px] border border-[var(--hairline)]">
          <div className="flex items-center gap-3 border-b border-[var(--hairline-soft)] px-3.5 py-2.5">
            <span className="text-[13px]">Cover fax letter</span>
            <span className="ml-auto text-[11.5px] text-muted-foreground">Generated from payer setup · always included</span>
          </div>
          <label className={cn("flex items-start gap-3 px-3.5 py-2.5", exclusions.invoice && "opacity-60")}>
            <input type="checkbox" checked={!exclusions.invoice} onChange={() => onChange({ ...exclusions, invoice: !exclusions.invoice })} className={cn(BOX, "mt-[3px]")} />
            <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
              <span className={cn("text-[13px]", exclusions.invoice && "line-through")}>
                Paid invoice {packet.invoiceNumber ?? ""} · {shortDay(packet.periodStart)} – {shortDay(packet.periodEnd)}
              </span>
              <span className="text-[11.5px] text-muted-foreground">
                {money(packet.invoiceTotal)}
                {packet.paidOn ? ` · paid ${shortDay(packet.paidOn)}` : " · not paid"}
              </span>
              {exclusions.invoice && <span className="text-[11.5px] text-[#B54708]">The carrier reimburses against the paid invoice — the packet cannot go without it.</span>}
            </span>
          </label>
        </div>
        <h3 className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-[.08em] text-muted-foreground">
          Care notes · {packet.visits.length - exclusions.noteDates.length} of {packet.visits.length} going
        </h3>
        <div className="overflow-hidden rounded-[12px] border border-[var(--hairline)]">
          {packet.visits.map((v) => {
            const out = exclusions.noteDates.includes(v.date);
            return (
              <label key={v.date} className={cn("flex items-start gap-3 border-b border-[var(--hairline-soft)] px-3.5 py-2.5 last:border-0", out && "opacity-60")}>
                <input type="checkbox" checked={!out} onChange={() => toggleNote(v.date)} className={cn(BOX, "mt-[3px]")} />
                <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
                  <span className={cn("text-[13px]", out && "line-through")}>Care notes — {shortDay(v.date)}</span>
                  <span className="text-[11.5px] text-muted-foreground">
                    {v.hours} hrs · {v.noteFiled ? "finalized" : "not filed — the page would be blank"}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-[var(--hairline)] px-6 py-3.5">
        <button type="button" onClick={onBack} className={cn(SECONDARY, "flex-none whitespace-nowrap")}>
          Back to the checks
        </button>
        <span className="ml-auto text-[12px] text-muted-foreground">{shown.blockers.length > 0 ? shown.blockers[0] : "Changes are kept for this packet until it is sent."}</span>
      </div>
    </>
  );
}

function PacketSummary({ approved, enrollments, periodLabel, money, sent, onBack, onSend }: { approved: LtciPacket[]; enrollments: LtciEnrollment[]; periodLabel: string; money: Money; sent: boolean; onBack: () => void; onSend: () => void }) {
  const carrierOf = (id: string) => enrollments.find((e) => e.clientPersonId === id)?.carrier ?? "";
  const sentOn = approved.find((p) => p.sentOn)?.sentOn ?? null;
  const noun = approved.length === 1 ? "packet" : "packets";
  return (
    <>
      <DialogDescription className="sr-only">{sent ? `${approved.length} ${noun} sent for ${periodLabel}.` : `${approved.length} ${noun} approved and ready to send for ${periodLabel}.`}</DialogDescription>
      <div className="max-h-[58vh] overflow-y-auto px-6 py-5">
        <h2 className="m-0 text-[19px] font-semibold tracking-[-.01em]">{sent ? `${approved.length} LTCI reimbursement ${noun} sent.` : `LTCI packets ready — ${periodLabel}`}</h2>
        <p className="m-0 mt-1 text-[12.5px] text-muted-foreground [text-wrap:pretty]">
          {sent
            ? `Delivered by fax and email${sentOn ? ` on ${weekdayDay(sentOn)}` : ""} · recorded in billing history`
            : `${approved.length} ${approved.length === 1 ? "client" : "clients"} · ${approved.length} ${noun} ready · delivery method: fax + email`}
        </p>
        <div className="mt-3.5 overflow-hidden rounded-[12px] border border-[var(--hairline)]">
          {approved.length === 0 && <p className="m-0 px-4 py-6 text-center text-[12.5px] text-muted-foreground">Nothing was approved, so there is nothing to send.</p>}
          {approved.map((p) => (
            <div key={p.clientPersonId} className="flex items-center gap-2.5 border-b border-[var(--hairline-soft)] px-4 py-3 last:border-0">
              <span className="text-[13px]">{p.clientName}</span>
              <span className="text-[12px] text-muted-foreground">{carrierOf(p.clientPersonId)}</span>
              <span className={cn("whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] font-medium", sent ? "bg-[#ECFDF3] text-[#027A48]" : "bg-[#EEF0FE] text-primary")}>{sent ? "Sent · fax + email" : "Ready"}</span>
              <span className="ml-auto text-[13px] font-medium tabular-nums">{money(p.invoiceTotal)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-[var(--hairline)] px-6 py-3.5">
        <button type="button" onClick={onBack} className={SECONDARY}>
          Back to billing
        </button>
        {sent ? (
          <span className="ml-auto flex h-[38px] items-center gap-1.5 rounded-[10px] bg-[#ECFDF3] px-4 text-[13px] font-medium text-[#027A48]">
            <Check className="h-4 w-4" aria-hidden="true" />
            Sent
          </span>
        ) : (
          <button
            type="button"
            disabled={approved.length === 0}
            onClick={onSend}
            className={cn("ml-auto h-[38px] rounded-[10px] px-[18px] text-[13px] font-medium transition-colors", approved.length === 0 ? "cursor-not-allowed bg-[var(--wash-strong)] text-muted-foreground/50" : "bg-primary text-white hover:bg-[#2A1BD1]")}
          >
            Send {approved.length} ready {noun}
          </button>
        )}
      </div>
    </>
  );
}
