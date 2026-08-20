import { usePortalSession } from "@/context/PortalSessionProvider";
import CandidateStatus from "@/pages/portal/CandidateStatus";
import EmployeeHome from "@/pages/portal/EmployeeHome";

/**
 * One URL, three lives.
 *
 * §6 and §7 are the same instruction said twice: "Do not create another
 * onboarding account/application after the candidate advances" and "No new
 * account. No new employee app login." A candidate, a new hire mid-onboarding
 * and a caregiver of six years all sign in with the same number and land on
 * /portal/work. What they see is decided here, by the state on their grant.
 *
 * This is the alternative to three routes and a redirect. A redirect would mean
 * a caregiver's bookmark broke on the day she was hired, and somebody would
 * eventually paste /portal/work/candidate to a person who is no longer one.
 */
export default function WorkforceHome() {
  const { grant } = usePortalSession();

  // `active` is the only state that means employed. Everything earlier —
  // invited, application, documents, under_review, onboarding — is still the
  // hiring conversation, and CandidateStatus renders the right lines for each.
  if (grant?.state === "active") return <EmployeeHome />;

  return <CandidateStatus />;
}
