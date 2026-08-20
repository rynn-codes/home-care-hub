import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest";
import PortalLogin from "@/pages/portal/PortalLogin";
import { PortalSessionProvider } from "@/context/PortalSessionProvider";

/**
 * The property under test is not "can you log in". It is that the login screen
 * cannot be used to ask whether Joy Health has a client at a given number.
 */

function renderLogin() {
  render(
    <PortalSessionProvider>
      <MemoryRouter>
        <PortalLogin />
      </MemoryRouter>
    </PortalSessionProvider>,
  );
  return userEvent.setup();
}

async function submitNumber(user: ReturnType<typeof userEvent.setup>, digits: string) {
  await user.type(screen.getByLabelText(/mobile number/i), digits);
  await user.click(screen.getByRole("button", { name: /send code/i }));
}

describe("PortalLogin", () => {
  it("will not send until the number could be a real US mobile", async () => {
    const user = renderLogin();
    expect(screen.getByRole("button", { name: /send code/i })).toBeDisabled();
    await user.type(screen.getByLabelText(/mobile number/i), "713555");
    expect(screen.getByRole("button", { name: /send code/i })).toBeDisabled();
  });

  it("answers an unknown number exactly as it answers a known one", async () => {
    // A different reply here — or no code screen — would turn this page into a
    // way of asking whether somebody is a Joy client, which is a disclosure
    // about their health made before anyone has logged in.
    const user = renderLogin();
    await submitNumber(user, "7139999999");

    expect(await screen.findByRole("heading", { name: /enter your code/i })).toBeInTheDocument();
    expect(screen.getByText(/If that number is on file/)).toBeInTheDocument();
  });

  it("sends a known number to the same screen with the same words", async () => {
    const user = renderLogin();
    await submitNumber(user, "7135550100");

    expect(await screen.findByRole("heading", { name: /enter your code/i })).toBeInTheDocument();
    expect(screen.getByText(/If that number is on file/)).toBeInTheDocument();
  });

  it("does not text an unknown number, whatever it tells them", async () => {
    // The reply is identical; the difference is only that nothing is sent.
    const user = renderLogin();
    await submitNumber(user, "7139999999");
    await screen.findByRole("heading", { name: /enter your code/i });
    expect(screen.queryByText(/The text Joy would have sent/)).not.toBeInTheDocument();
  });

  it("offers the office number to anyone who is stuck", async () => {
    renderLogin();
    expect(screen.getByRole("link", { name: /713\) 231-9662/ })).toHaveAttribute(
      "href",
      "tel:+17132319662",
    );
  });
});
