/**
 * Best-effort ETF/fund detection from a symbol or display name — there's no
 * real instrument-type data source wired up yet (Instrument.sector is
 * never populated), so this is a naming-convention heuristic only, used
 * for display/filtering, never for financial calculations. Patterns
 * verified against this app's own real holdings data: Nippon's "BEES"
 * suffix (GOLDBEES, ITBEES, PHARMABEES), the common "IETF" suffix
 * (PSUBNKIETF, SILVERIETF, METALIETF), a literal "ETF" substring (NIP IND
 * ETF IT, ICICIPRAMC - EVIETF), and AMC/AML fund-house-prefixed names
 * (MIRAEAMC - METAL, ICICIPRAMC - METALIETF, MOTILALAMC - MOENERGY,
 * TATAAML-TATAGOLD). Will miss ETFs that don't follow any of these
 * conventions (e.g. MON100) — never false-flags a real ambiguity, just
 * under-detects.
 */
export function isLikelyETF(symbolOrName: string): boolean {
  const upper = symbolOrName.toUpperCase();
  return (
    /ETF/.test(upper) ||
    /BEES$/.test(upper) ||
    /IETF$/.test(upper) ||
    /\b[A-Z]+AMC\s*-/.test(upper) ||
    /\b[A-Z]+AML\s*-/.test(upper)
  );
}
