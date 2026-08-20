import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { InviteCandidateDialog } from "@/components/hiring/InviteCandidateDialog";

/**
 * The button this dialog hangs off used to render and do nothing. These tests
 * exist because "it compiles" was true of that button too.
 */

function setup(onInvite = vi.fn()) {
  render(<InviteCandidateDialog open onOpenChange={vi.fn()} onInvite={onInvite} />);
  return { onInvite, user: userEvent.setup() };
}

describe("InviteCandidateDialog", () => {
  it("will not send until there is a name and a usable mobile number", async () => {
    const { user } = setup();
    const send = screen.getByRole("button", { name: /send invitation/i });
    expect(send).toBeDisabled();

    await user.type(screen.getByLabelText(/name/i), "Jamisha Harper");
    expect(send).toBeDisabled();

    await user.type(screen.getByLabelText(/mobile number/i), "7135550100");
    expect(send).toBeEnabled();
  });

  it("shows the number back formatted before the link goes anywhere", async () => {
    // A mistyped digit sends a stranger a candidate's portal link.
    const { user } = setup();
    await user.type(screen.getByLabelText(/mobile number/i), "7135550100");
    expect(screen.getByText(/Joy will text \(713\) 555-0100/)).toBeInTheDocument();
  });

  it("says what is wrong with a number rather than just refusing", async () => {
    const { user } = setup();
    const phone = screen.getByLabelText(/mobile number/i);
    await user.type(phone, "555");
    await user.tab();
    expect(phone).toHaveAttribute("aria-invalid", "true");
  });

  it("hands back a normalized number, not what was typed", async () => {
    const { onInvite, user } = setup();
    await user.type(screen.getByLabelText(/name/i), "Jamisha Harper");
    await user.type(screen.getByLabelText(/mobile number/i), "(713) 555-0100");
    await user.click(screen.getByRole("button", { name: /send invitation/i }));

    expect(onInvite).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Jamisha Harper", e164: "+17135550100" }),
    );
  });
});
