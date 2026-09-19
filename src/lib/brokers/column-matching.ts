/**
 * Flexible CSV header matching, used by the Dhan/Upstox/Angel One/Kotak
 * adapters. Their live-API JSON field names are verified against each
 * broker's official SDK/docs (see comments in each adapter), but their
 * *downloadable tradebook CSV* header text is not independently confirmed
 * against a real exported file — broker web UIs commonly rename fields
 * between the API and the CSV export (e.g. "trading_symbol" -> "Symbol").
 * Matching against a list of accepted aliases per logical field, rather
 * than one hardcoded guess, tolerates that variance instead of silently
 * failing on a real file whose headers differ slightly from the guess.
 */

/** Normalizes a header for comparison: lowercase, strip non-alphanumerics. */
export function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export interface ColumnAliasMap {
  [logicalField: string]: string[];
}

/**
 * Given the raw header row (as parsed keys) and an alias map, returns a
 * mapping from logical field name -> actual raw header key present in the
 * file, or undefined if no alias matched.
 */
export function resolveColumnMap(
  rawHeaders: string[],
  aliases: ColumnAliasMap
): Record<string, string | undefined> {
  const normalizedToRaw = new Map<string, string>();
  for (const raw of rawHeaders) {
    normalizedToRaw.set(normalizeHeader(raw), raw);
  }

  const resolved: Record<string, string | undefined> = {};
  for (const [logicalField, candidates] of Object.entries(aliases)) {
    resolved[logicalField] = undefined;
    for (const candidate of candidates) {
      const match = normalizedToRaw.get(normalizeHeader(candidate));
      if (match) {
        resolved[logicalField] = match;
        break;
      }
    }
  }
  return resolved;
}

export function getField(row: Record<string, string>, columnMap: Record<string, string | undefined>, logicalField: string): string {
  const rawKey = columnMap[logicalField];
  if (!rawKey) return "";
  return row[rawKey] ?? "";
}

/**
 * Zerodha/Upstox pass their raw segment column straight through
 * unnormalized (format never independently confirmed against a real file,
 * unlike Dhan/Kotak which parse a compound exchangeSegment code). A deny
 * list — reject only when the value clearly indicates F&O — is safer than
 * an allow list requiring an exact "EQ" match, since failing loudly on a
 * genuine equity row whose exact segment spelling was never confirmed would
 * be worse than the risk of an F&O row slipping through an unrecognized
 * spelling.
 */
export function looksLikeFnoSegment(rawSegment: string): boolean {
  return /\b(FUT|OPT|FO|NFO|BFO)\b/.test(rawSegment.toUpperCase());
}
