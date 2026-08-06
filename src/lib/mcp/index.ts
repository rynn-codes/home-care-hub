import { auth, defineMcp } from "@lovable.dev/mcp-js";
import queryClients from "./tools/query-clients";
import queryEmployees from "./tools/query-employees";
import queryShifts from "./tools/query-shifts";
import queryInvoices from "./tools/query-invoices";
import getSops from "./tools/get-sop";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "home-care-hub",
  title: "Home Care Hub",
  version: "0.1.0",
  instructions:
    "Read-only operations tools for the Home Care Hub agency dashboard. Use query_clients, query_employees, query_shifts and query_invoices to answer questions about people, schedules and billing, and get_sops for standard operating procedures.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [queryClients, queryEmployees, queryShifts, queryInvoices, getSops],
});
