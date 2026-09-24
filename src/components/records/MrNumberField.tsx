import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mrNumber, mrNumberTaken, whyNoMrNumber } from "@/domain/records/mrNumber";

/**
 * The MR # row on a client or employee record.
 *
 * Shows the number once one exists. Otherwise, for somebody who may write,
 * an "Issue an MR number" link opens a four-digit field: the number is
 * computed from the initials and the last four of the social security
 * number, and only the number is kept. The digits are in React state for as
 * long as the field is open and nowhere else — not on the record, not on
 * this device, not in the audit trail.
 */
export function MrNumberField({
  firstName,
  lastName,
  value,
  existing,
  canEdit,
  onIssue,
}: {
  firstName: string;
  lastName: string;
  value: string | null | undefined;
  /** Every number already issued, so a collision is caught before it is saved. */
  existing: Array<string | null | undefined>;
  canEdit: boolean;
  onIssue: (number: string) => void;
}) {
  const [digits, setDigits] = useState("");
  const [open, setOpen] = useState(false);
  const number = mrNumber({ firstName, lastName, ssn: digits });
  const taken = number ? mrNumberTaken(number, existing) : false;
  const why = digits.trim() ? whyNoMrNumber({ firstName, lastName, ssn: digits }) : null;

  if (value) return <span className="font-medium tabular-nums tracking-[.02em]">{value}</span>;
  if (!canEdit) return <span className="text-muted-foreground">Not issued</span>;
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[13px] font-medium text-primary underline-offset-4 hover:underline"
      >
        Issue an MR number
      </button>
    );
  }
  return (
    <span className="flex flex-col gap-2">
      <span className="flex flex-wrap items-center gap-2">
        <Input
          aria-label="Last four of the social security number"
          inputMode="numeric"
          maxLength={4}
          value={digits}
          onChange={(e) => setDigits(e.target.value)}
          placeholder="6789"
          className="h-9 w-24 tabular-nums"
          autoFocus
        />
        <Button
          size="sm"
          disabled={!number || taken}
          onClick={() => {
            if (number && !taken) onIssue(number);
          }}
        >
          {number && !taken ? `Issue ${number}` : "Issue"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </span>
      {taken && number && (
        <span className="text-[12px] leading-[1.5] text-[#B42318]">
          {number} already belongs to somebody else. Check which record is right before issuing another.
        </span>
      )}
      {why && !taken && <span className="text-[12px] leading-[1.5] text-muted-foreground">{why}</span>}
      <span className="text-[12px] leading-[1.5] text-muted-foreground">
        The four digits are used to make the number and are not saved.
      </span>
    </span>
  );
}
