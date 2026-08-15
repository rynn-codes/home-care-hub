import { ModuleNotBuilt } from "@/components/layout/ModuleNotBuilt";

export default function Admissions() {
  return (
    <ModuleNotBuilt
      title="Admissions"
      description="Move a referral to a ready client without losing a step."
      sprint="Sprint 1"
      scope={[
        "Work queue grouped as Needs You, Waiting and Moving Forward",
        "Referral intake with duplicate checking",
        "Stages: new referral, phone intake, assessment, pre-onboarding, ready for admission, admitted, closed",
        "Manual phone intake with autosave and draft recovery",
        "Assessment scheduling onto the one central Joy schedule",
        "Client record lives in People — Admissions is the process, not a second record",
      ]}
      blockedBy="Sprint 0 foundations: database and migrations, the people and relationships schema, domain events and audit."
    />
  );
}
