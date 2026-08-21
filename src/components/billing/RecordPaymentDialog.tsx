import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDemo } from "@/context/DemoDataProvider";
import { PAYMENT_MESSAGES, type InvoiceBalance } from "@/domain/billing/receivables";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/domain/billing/invoice";

/**
 * §7.4 rung 6 — the cheque on the desk.
 *
 * The one rung of the payment fallback ladder that needs no Stripe, which is
 * why it exists before anything is connected: a family hands Karynn a cheque
 * today, and today it has somewhere to go. Reference, date, method, recorder
 * — the spec's own list — and the trail gets an entry the moment it lands.
 *
 * Refusals come from `paymentRefusals` through the provider, in the domain's
 * words. This form adds nothing of its own: a screen with private validation
 * rules is a second, slightly different Joy.
 */
export function RecordPaymentDialog({
  balance,
  open,
  onOpenChange,
}: {
  balance: InvoiceBalance | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { recordExternalPayment } = useDemo();
  const [amount, setAmount] = useState("");
  const [receivedOn, setReceivedOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<PaymentMethod>("check");
  const [reference, setReference] = useState("");

  if (!balance) return null;
  const { invoice } = balance;

  function submit() {
    const refusals = recordExternalPayment({
      id: `pay-${Date.now()}`,
      invoiceId: invoice.id,
      amount: Number(amount),
      receivedOn,
      method,
      reference: reference.trim() || null,
    });

    if (refusals.length > 0) {
      // The domain's words, not the form's. One at a time — the first is
      // usually the one that matters.
      toast.error(PAYMENT_MESSAGES[refusals[0]]);
      return;
    }

    toast.success(
      `$${Number(amount).toFixed(2)} recorded against ${invoice.clientName}'s week of ${invoice.weekStart}.`,
    );
    setAmount("");
    setReference("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record a payment</DialogTitle>
          <DialogDescription>
            {invoice.clientName} — week of {invoice.weekStart}. ${balance.balance.toFixed(2)}{" "}
            outstanding. For money that arrived outside the system: a cheque, cash, a bank
            transfer.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="pay-amount">Amount</Label>
            <Input
              id="pay-amount"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={balance.balance.toFixed(2)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="pay-date">Received on</Label>
            <Input
              id="pay-date"
              type="date"
              value={receivedOn}
              onChange={(e) => setReceivedOn(e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label id="pay-method-label">Method</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger aria-labelledby="pay-method-label">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
                  <SelectItem key={m} value={m}>
                    {PAYMENT_METHOD_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="pay-reference">Reference</Label>
            <Input
              id="pay-reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Cheque number, or the last four on the statement"
            />
            <p className="text-xs text-muted-foreground">
              What identifies it when somebody rings to ask about a line on their statement.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!amount}>
            Record it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
