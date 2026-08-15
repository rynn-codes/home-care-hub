import { ModuleNotBuilt } from "@/components/layout/ModuleNotBuilt";

export default function Payroll() {
  return (
    <ModuleNotBuilt
      title="Payroll"
      description="Resolve exceptions and prepare the cycle for Gusto."
      sprint="Sprint 7"
      scope={[
        "Monday workflow context, with separate billing and payroll periods",
        "Needs Review queue — only items requiring action",
        "Time and EVV exceptions, overtime, mileage, adjustments",
        "Readiness checklist and approval",
        "Gusto preparation boundary — Joy prepares the file, Gusto confirms the submission",
        "LTI and paid-invoice status, plus history and audit",
      ]}
      blockedBy="Sprint 0 foundations. Payroll reads scheduling and time data that does not exist yet."
    />
  );
}
