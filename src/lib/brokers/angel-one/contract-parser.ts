import type { DerivativeContract } from "../adapter";

/**
 * Parses Angel One F&O contract strings from the "Trades and Charges"
 * report's Scrip/Contract column. Six real shapes confirmed against the
 * user's actual export (dispatches on the first token, the prefix):
 *
 *  - BSXOPT (BSE index options):     "BSXOPT SENSEX Apr  1 2025 78200.00 CE (BT)"
 *  - BKXOPT (BSE BANKEX options):    "BKXOPT BANKEX Jan 28 2025 55200.00 CE (BT)"
 *  - OPTIDX (NSE index options):     "OPTIDX NIFTY Mar 27 2025 23600.00 CE (BT)"
 *  - OPTSTK (NSE individual-stock options): "OPTSTK RELIANCE Mar 27 2025 1310.00 CE (BT)"
 *  - OPTFUT (MCX commodity options): "OPTFUT CRUDEOIL 16APR25 6100.00 CE"
 *  - FUTCOM (MCX commodity futures): "FUTCOM NATGASMINI 25NOV24" (no strike/CE-PE)
 *
 * BSXOPT/BKXOPT/OPTIDX/OPTSTK all share one shape: a spaced "Mon D YYYY"
 * date (sometimes with a double space, e.g. "Apr  1") and an optional
 * trailing "(BT)"-style suffix confirmed to be a per-row annotation, not
 * part of contract identity — stripped before parsing. Commodity contracts
 * (OPTFUT/FUTCOM) use a compact "DDMMMYY" date and no suffix. Anything else
 * — an unrecognized prefix, or a shape that doesn't match its prefix's
 * expected pattern — is rejected with a specific reason rather than guessed.
 */

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

export type ContractParseResult = { ok: true; contract: DerivativeContract } | { ok: false; reasons: string[] };

function parseSpacedDate(monthTok: string, dayTok: string, yearTok: string): string | null {
  const month = MONTHS[monthTok.toLowerCase()];
  if (!month) return null;
  if (!/^\d{1,2}$/.test(dayTok)) return null;
  if (!/^\d{4}$/.test(yearTok)) return null;
  return `${yearTok}-${month}-${dayTok.padStart(2, "0")}`;
}

/** e.g. "16APR25" or "25NOV24" -> DDMMMYY, two-digit year assumed 20xx. */
function parseCompactDate(tok: string): string | null {
  const match = tok.match(/^(\d{2})([A-Za-z]{3})(\d{2})$/);
  if (!match) return null;
  const [, day, monAbbr, yy] = match;
  const month = MONTHS[monAbbr!.toLowerCase()];
  if (!month) return null;
  return `20${yy}-${month}-${day}`;
}

function toExpiryDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00+05:30`);
}

function parseStrike(tok: string): number | null {
  const value = Number(tok.replace(/,/g, ""));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function parseIndexOption(prefix: string, tokens: string[]): ContractParseResult {
  if (tokens.length < 7) {
    return { ok: false, reasons: [`"${prefix}" contract too short to contain underlying, expiry, strike and option type`] };
  }
  const optionTypeTok = tokens[tokens.length - 1]!.toUpperCase();
  if (optionTypeTok !== "CE" && optionTypeTok !== "PE") {
    return { ok: false, reasons: [`expected a trailing CE or PE token, got "${tokens[tokens.length - 1]}"`] };
  }
  const strike = parseStrike(tokens[tokens.length - 2]!);
  if (strike === null) {
    return { ok: false, reasons: [`could not parse strike price from "${tokens[tokens.length - 2]}"`] };
  }
  const yearTok = tokens[tokens.length - 3]!;
  const dayTok = tokens[tokens.length - 4]!;
  const monthTok = tokens[tokens.length - 5]!;
  const isoDate = parseSpacedDate(monthTok, dayTok, yearTok);
  if (!isoDate) {
    return { ok: false, reasons: [`could not parse expiry date from "${monthTok} ${dayTok} ${yearTok}"`] };
  }
  const underlying = tokens.slice(1, tokens.length - 5).join(" ").toUpperCase();
  if (!underlying) return { ok: false, reasons: ["could not determine the underlying symbol"] };

  return {
    ok: true,
    contract: { underlying, expiryDate: toExpiryDate(isoDate), strikePrice: strike, optionType: optionTypeTok, segment: "OPTIONS" },
  };
}

function parseCommodityOption(tokens: string[]): ContractParseResult {
  if (tokens.length < 5) return { ok: false, reasons: ['"OPTFUT" contract too short to contain underlying, expiry, strike and option type'] };
  const optionTypeTok = tokens[tokens.length - 1]!.toUpperCase();
  if (optionTypeTok !== "CE" && optionTypeTok !== "PE") {
    return { ok: false, reasons: [`expected a trailing CE or PE token, got "${tokens[tokens.length - 1]}"`] };
  }
  const strike = parseStrike(tokens[tokens.length - 2]!);
  if (strike === null) {
    return { ok: false, reasons: [`could not parse strike price from "${tokens[tokens.length - 2]}"`] };
  }
  const dateTok = tokens[tokens.length - 3]!;
  const isoDate = parseCompactDate(dateTok);
  if (!isoDate) return { ok: false, reasons: [`could not parse expiry date from "${dateTok}"`] };
  const underlying = tokens.slice(1, tokens.length - 3).join(" ").toUpperCase();
  if (!underlying) return { ok: false, reasons: ["could not determine the underlying symbol"] };

  return {
    ok: true,
    contract: { underlying, expiryDate: toExpiryDate(isoDate), strikePrice: strike, optionType: optionTypeTok, segment: "OPTIONS" },
  };
}

function parseCommodityFuture(tokens: string[]): ContractParseResult {
  if (tokens.length < 3) return { ok: false, reasons: ['"FUTCOM" contract too short to contain underlying and expiry'] };
  const last = tokens[tokens.length - 1]!.toUpperCase();
  if (last === "CE" || last === "PE") {
    return {
      ok: false,
      reasons: [`"FUTCOM" contracts are futures and shouldn't have a trailing CE/PE token — got "${tokens[tokens.length - 1]}"`],
    };
  }
  const dateTok = tokens[tokens.length - 1]!;
  const isoDate = parseCompactDate(dateTok);
  if (!isoDate) return { ok: false, reasons: [`could not parse expiry date from "${dateTok}"`] };
  const underlying = tokens.slice(1, tokens.length - 1).join(" ").toUpperCase();
  if (!underlying) return { ok: false, reasons: ["could not determine the underlying symbol"] };

  return {
    ok: true,
    contract: { underlying, expiryDate: toExpiryDate(isoDate), strikePrice: null, optionType: null, segment: "FUTURES" },
  };
}

export function parseAngelContract(rawInput: string): ContractParseResult {
  const raw = rawInput.trim();
  if (!raw) return { ok: false, reasons: ["Empty contract string"] };

  // Strip a trailing "(SUFFIX)" annotation — confirmed via real data to be a
  // per-row tag (e.g. "(BT)"), not part of contract identity.
  const suffixMatch = raw.match(/^(.*?)\s*\(([A-Za-z]+)\)\s*$/);
  const withoutSuffix = suffixMatch ? suffixMatch[1]!.trim() : raw;

  const tokens = withoutSuffix.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { ok: false, reasons: ["Empty contract string"] };

  const prefix = tokens[0]!.toUpperCase();
  if (prefix === "BSXOPT" || prefix === "BKXOPT" || prefix === "OPTIDX" || prefix === "OPTSTK") {
    return parseIndexOption(prefix, tokens);
  }
  if (prefix === "OPTFUT") return parseCommodityOption(tokens);
  if (prefix === "FUTCOM") return parseCommodityFuture(tokens);

  return { ok: false, reasons: [`unrecognized F&O contract format (prefix "${tokens[0]}") — not supported yet`] };
}
