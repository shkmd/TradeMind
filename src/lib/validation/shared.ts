import { z } from "zod";

/**
 * An optional numeric form field. Native <input type="number"> elements
 * submit "" when left blank rather than being omitted from FormData (unlike
 * checkboxes), and z.coerce.number() turns "" into 0 via Number(""), which
 * then fails any .min(1)-style check instead of behaving like "not set".
 */
export function optionalNumber(schema: z.ZodNumber) {
  return z
    .literal("")
    .transform(() => undefined)
    .or(schema.optional());
}
