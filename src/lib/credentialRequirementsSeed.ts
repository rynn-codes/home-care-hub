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

/** Everyone who goes into a client's home, nurses included. */
const FIELD_ROLES = ["caregiver", "cna", "rn", "lvn"];

export const seedCredentialRequirements: CredentialRequirement[] = [
  {
    /*
     * The right to work, for the one basis that lapses. A permit holder's
     * expiry blocks scheduling exactly like an expired TB test; a citizen
     * or a permanent resident never sees this row. See
     * domain/employees/workAuthorization.
     */
    credentialType: "work_authorization",
    displayName: "Work permit",
    folderType: "employment",
    sensitivity: "general_credential",
    requiredForRoles: null,
    requiredForDriving: false,
    requiredForWorkAuthorization: true,
    expirationRequired: true,
    verificationRequired: true,
    suppliedBy: "employee",
    blocksSchedulingWhenExpired: true,
    warningDays: [180, 120, 90, 60, 30],
    active: true,
  },
  {
    credentialType: "background_check",
    displayName: "Background check",
    folderType: "background",
    // §19: HR and the owner only. A scheduler gets eligibility, not this.
    sensitivity: "background_sensitive",
    requiredForRoles: null,
    requiredForDriving: false,
    // Karynn: the background check is re-run yearly, so it expires.
    expirationRequired: true,
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
    expirationRequired: false,
    verificationRequired: false,
    suppliedBy: "agency",
    blocksSchedulingWhenExpired: true,
    warningDays: [30, 7],
    active: true,
  },
  {
    credentialType: "licence",
    displayName: "License or certificate",
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
    displayName: "Immunizations",
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
    displayName: "Driver's license",
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

  /* ── Added 9 September, from Karynn's list ──────────────────────────────
   *
   * "Under compliance, add I9, signature of employee handbook, Supervisory
   * Visit (90 Days), Supervisory Visit (Annually), Social Security Card,
   * Passport (Optional)" — and "Add 12 hours of education to record."
   *
   * The handbook signature was already here; the rest are new. Each is filed
   * the same way as everything above: a document, a date, and a policy about
   * what its absence means. None of them block a shift except the I-9, and
   * that one blocks because it is the form that says somebody may lawfully
   * work at all.
   */
  {
    /*
     * The I-9 is not a credential that expires — it is completed once, within
     * three days of hire, and kept. What can expire is the document behind
     * section 2, and that is the work permit above, which has its own row.
     */
    credentialType: "i9",
    displayName: "Form I-9",
    folderType: "employment",
    sensitivity: "general_credential",
    requiredForRoles: null,
    requiredForDriving: false,
    expirationRequired: false,
    verificationRequired: true,
    suppliedBy: "agency",
    blocksSchedulingWhenExpired: true,
    warningDays: [30, 7],
    active: true,
  },
  {
    /*
     * Texas requires an RN supervisory visit at intervals, and the two
     * intervals are separate obligations rather than one renewing item: the
     * ninety-day visit repeats four times a year and the annual one is its own
     * record. Filing them as one row would let a quarterly visit satisfy the
     * annual requirement, which is exactly the finding a surveyor writes up.
     */
    credentialType: "supervisory_visit_90",
    displayName: "Supervisory visit (90 days)",
    folderType: "orientation",
    sensitivity: "general_credential",
    requiredForRoles: ["caregiver", "cna"],
    requiredForDriving: false,
    expirationRequired: true,
    verificationRequired: false,
    suppliedBy: "agency",
    // Overdue supervision is a survey finding, not a reason to leave a client
    // uncovered. Karynn's call to change if she wants it stricter.
    blocksSchedulingWhenExpired: false,
    warningDays: [30, 14, 7],
    active: true,
  },
  {
    credentialType: "supervisory_visit_annual",
    displayName: "Supervisory visit (annual)",
    folderType: "orientation",
    sensitivity: "general_credential",
    requiredForRoles: ["caregiver", "cna"],
    requiredForDriving: false,
    expirationRequired: true,
    verificationRequired: false,
    suppliedBy: "agency",
    blocksSchedulingWhenExpired: false,
    warningDays: [60, 30, 14],
    active: true,
  },
  {
    /*
     * Identity for the I-9. The card itself has no expiry, so what is watched
     * is whether it is on file at all.
     */
    credentialType: "social_security_card",
    displayName: "Social security card",
    folderType: "employment",
    sensitivity: "general_credential",
    requiredForRoles: null,
    requiredForDriving: false,
    expirationRequired: false,
    verificationRequired: true,
    suppliedBy: "employee",
    blocksSchedulingWhenExpired: false,
    warningDays: [30, 7],
    active: true,
  },
  {
    /*
     * Optional, exactly as Karynn wrote it. See `optional` on
     * CredentialRequirement: never counted as missing, watched for expiry once
     * somebody actually has one on file.
     */
    credentialType: "passport",
    displayName: "Passport",
    folderType: "employment",
    sensitivity: "general_credential",
    requiredForRoles: null,
    requiredForDriving: false,
    optional: true,
    expirationRequired: true,
    verificationRequired: false,
    suppliedBy: "employee",
    blocksSchedulingWhenExpired: false,
    warningDays: [180, 90, 30],
    active: true,
  },
  {
    /*
     * Karynn, 9 September: "Add 12 hours of education to record."
     *
     * The twelve clock hours of in-service education a Texas agency records
     * for each field employee, each year. Separate from Annual training above,
     * which is Joy's own annual course — if the two are the same thing at Joy
     * Health they should be one row, and that is Karynn's call rather than an
     * assumption made here by quietly merging them.
     */
    credentialType: "education_hours",
    displayName: "In-service education (12 hours)",
    folderType: "training",
    sensitivity: "general_credential",
    requiredForRoles: ["caregiver", "cna", "lvn", "rn"],
    requiredForDriving: false,
    expirationRequired: true,
    verificationRequired: false,
    suppliedBy: "agency",
    blocksSchedulingWhenExpired: false,
    warningDays: [90, 60, 30],
    active: true,
  },
];
