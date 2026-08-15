import { ModuleNotBuilt } from "@/components/layout/ModuleNotBuilt";

export default function Operations() {
  return (
    <ModuleNotBuilt
      title="Operations"
      description="Hiring, compliance and the day-to-day running of the agency."
      sprint="Sprint 6"
      scope={[
        "Hiring — the full candidate pipeline, reachable at Operations → Hiring",
        "Compliance tracking: CPR, TB screening, auto insurance, background checks",
        "Standard operating procedures and agency documents",
      ]}
    />
  );
}
