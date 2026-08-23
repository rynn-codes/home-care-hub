import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// The standalone demo build signs the viewer in as the demo owner before the
// app mounts. Honest about what it is: the hosted try-it page has no Supabase
// to authenticate against (and its sandbox forbids the network call), so the
// same stand-in session the browser tests use is seeded here — Karynn opens
// the page and is simply in, as herself. The dev/production build never runs
// this branch; real auth is untouched.
if (import.meta.env.VITE_STANDALONE_DEMO === "true") {
  const ref = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "xembwxgilrsjeybuwxwt";
  const key = `sb-${ref}-auth-token`;
  try {
    if (!localStorage.getItem(key)) {
      localStorage.setItem(
        key,
        JSON.stringify({
          access_token: "standalone-demo",
          token_type: "bearer",
          expires_in: 3600 * 24 * 365,
          expires_at: Math.floor(Date.now() / 1000) + 3600 * 24 * 365,
          refresh_token: "standalone-demo",
          user: {
            id: "00000000-0000-0000-0000-000000000001",
            aud: "authenticated",
            role: "authenticated",
            email: "karynn@joyhealth.demo",
            user_metadata: { first_name: "Karynn" },
          },
        }),
      );
    }
  } catch {
    // Storage unavailable — the login screen will say so honestly.
  }
}

createRoot(document.getElementById("root")!).render(<App />);
