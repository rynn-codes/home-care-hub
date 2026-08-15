import { ModuleNotBuilt } from "@/components/layout/ModuleNotBuilt";

export default function Hiring() {
  return (
    <ModuleNotBuilt
      title="Hiring"
      description="Applicant to active employee, without recreating Gusto."
      sprint="Sprint 6"
      scope={[
        "Stages: interview, documents, background, decision, offer, onboarding, ready, closed",
        "The full continuum past the offer — orientation, field orientation, first shift, week one follow-up, active employee",
        "Documented no-show interviews, kept rather than deleted",
        "Document requirements with tighter access control on identity documents",
        "Gusto status boundary — never shown as successful unless Gusto confirms it",
        "Application data progressively builds the permanent employee profile",
      ]}
      blockedBy="The approved Hiring Screen Roadmap, which is not yet in the repository. The current mockup stops at the offer."
    />
  );
}
