import { ModuleNotBuilt } from "@/components/layout/ModuleNotBuilt";

export default function People() {
  return (
    <ModuleNotBuilt
      title="People"
      description="One person record, however many roles they hold."
      sprint="Sprint 0"
      scope={[
        "A single people table, with client and employee profiles hanging off it",
        "Relationships: daughter, spouse, responsible party, emergency contact, care coordination",
        "Clients and Employees are views of this record, not separate records",
        "A family member who later applies as a caregiver stays one person",
      ]}
      blockedBy="The people, profile and relationships schema. Clients and Employees currently read from separate mock collections with no shared person identity."
    />
  );
}
