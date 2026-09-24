import { paperworkWatch } from "./paperwork";
import { admissionWatch } from "./admissions";
import { evvWatch } from "./evv";
import { locationWatch } from "./location";
import { addressWatch } from "./address";
import { agreementWatch } from "./agreement";
import { expenseWatch } from "./expense";
import type { Monitor } from "./types";

/** Every monitor Joy runs, in the order their findings are listed within a severity. */
export const MONITORS: readonly Monitor[] = [paperworkWatch, admissionWatch, evvWatch, locationWatch, addressWatch, agreementWatch, expenseWatch];

export * from "./types";
export * from "./run";
export { spanLabel } from "./paperwork";
export { distanceLabel } from "./location";
