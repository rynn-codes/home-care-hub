import type { CredentialRequirement } from "@/domain/documents/types";

/**
 * Joy's credential requirements, as data.
 *
 * §6 of the documents spec: requirements and their scheduling consequences must
 * be configurable to Joy Health policy and jurisdiction rather than hard-coded.
 * This stands in for the `credential_requirements` table in migration 0005 until
 * the database is connected — same shape, same field names, so replacing the
 * source is a swap rather than a rewrite.
 *
 * ASSUMPTION, carried over from the hiring work and still Karynn's to correct:
 * which of these stop somebody entering a client's home. Background check, TB
 * test, the role licence and CPR block; the handbook, immunisations and annual
 * training are real requirements that do not. The split errs towards blocking,
 * because sending somebody out uncovered is the worse mistake.
 *
 * `warningDays` follows §13's suggested points. A shorter list means quieter
 * warnings; that is a policy dial, not a code change.
 */

const FIELD_ROLES = ["cna", "hha", "lvn"];

export const seedCredentialRequirements: CredentialRequirement[] = [
  {
    credentialType: "background_check",
    displayName: "Background check",
    folderType: "background",
    // §19: HR and the owner only. A scheduler gets eligibility, not this.
    sensitivity: "background_sensitive",
    requiredForRoles: null,
    requiredForDriving: false,
    expirationRequired: false,
    verificationRequired: true,
    suppliedBy: "agency",
    blocksSchedulingWhenExpired: true,
    warningDays: [90, 60, 30],
    active: true,
  },
  {
    credentialType: "handbook",
    displayName: "Employee handbook",
    folderType: "employment",
    sensitivity: "general_credential",
    requiredForRoles: null,
    requiredForDriving: false,
    expirationRequired: true,
    verificationRequired: false,
    // A lapsed acknowledgement is a real gap in a file and is not a reason to
    // leave a client without a caregiver.
    suppliedBy: "agency",
    blocksSchedulingWhenExpired: false,
    warningDays: [30, 7],
    active: true,
  },
  {
    credentialType: "licence",
    displayName: "Licence or certificate",
    folderType: "credentials_licenses",
    sensitivity: "clinical_credential",
    requiredForRoles: FIELD_ROLES,
    requiredForDriving: false,
    expirationRequired: true,
    verificationRequired: true,
    suppliedBy: "employee",
    blocksSchedulingWhenExpired: true,
    warningDays: [90, 60, 30, 14, 7],
    active: true,
  },
  {
    credentialType: "cpr",
    displayName: "CPR certification",
    folderType: "credentials_licenses",
    sensitivity: "clinical_credential",
    requiredForRoles: FIELD_ROLES,
    requiredForDriving: false,
    expirationRequired: true,
    verificationRequired: true,
    suppliedBy: "employee",
    blocksSchedulingWhenExpired: true,
    warningDays: [90, 60, 30, 14, 7],
    active: true,
  },
  {
    credentialType: "tb_test",
    displayName: "TB test",
    folderType: "health_screening",
    // Health information about the employee, not an ordinary credential.
    sensitivity: "health_sensitive",
    requiredForRoles: FIELD_ROLES,
    requiredForDriving: false,
    expirationRequired: true,
    verificationRequired: true,
    suppliedBy: "employee",
    blocksSchedulingWhenExpired: true,
    warningDays: [60, 30, 14, 7],
    active: true,
  },
  {
    credentialType: "immunizations",
    displayName: "Immunisations",
    folderType: "health_screening",
    sensitivity: "health_sensitive",
    requiredForRoles: FIELD_ROLES,
    requiredForDriving: false,
    expirationRequired: true,
    verificationRequired: false,
    suppliedBy: "employee",
    blocksSchedulingWhenExpired: false,
    warningDays: [60, 30],
    active: true,
  },
  {
    credentialType: "annual_training",
    displayName: "Annual training",
    folderType: "training",
    sensitivity: "general_credential",
    requiredForRoles: FIELD_ROLES,
    requiredForDriving: false,
    expirationRequired: true,
    verificationRequired: false,
    suppliedBy: "agency",
    blocksSchedulingWhenExpired: false,
    warningDays: [60, 30],
    active: true,
  },
  {
    credentialType: "drivers_license",
    displayName: "Driver's licence",
    folderType: "driving",
    sensitivity: "identity_sensitive",
    requiredForRoles: null,
    requiredForDriving: true,
    expirationRequired: true,
    verificationRequired: true,
    suppliedBy: "employee",
    blocksSchedulingWhenExpired: true,
    warningDays: [90, 30],
    active: true,
  },
  {
    credentialType: "auto_insurance",
    displayName: "Auto insurance",
    folderType: "driving",
    sensitivity: "general_credential",
    requiredForRoles: null,
    requiredForDriving: true,
    expirationRequired: true,
    verificationRequired: true,
    suppliedBy: "employee",
    blocksSchedulingWhenExpired: true,
    warningDays: [60, 30, 14],
    active: true,
  },
];
