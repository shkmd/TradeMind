/**
 * CURRENT exchange lot sizes only — not historical. Same simplification
 * already accepted for the F&O charge-rate constants (see the comment in
 * regulatory.ts): lot sizes are revised periodically by SEBI/NSE/BSE/MCX
 * (NIFTY alone changed 4 times across FY2024-25 through Jan 2026 — 50 -> 25
 * -> 75 -> 75 -> 65), and building a date-versioned table is a bigger
 * feature than this display-only convenience warrants. A trade from before
 * an underlying's most recent lot-size change will show an approximate,
 * not exact, "lots" count.
 *
 * NSE entries (216) sourced from Dhan's official current lot-size CSV
 * (dhan.co/nse-fno-lot-size/, downloaded 2026-09-19, "Lot Size (Sep 2026)"
 * column) — a real broker's published reference, not a guess; cross-checked
 * against a real trade (ASTRAL, lot size 425, matched an actual 1-lot
 * position exactly). Covers stock + NSE index F&O.
 *
 * BSE/MCX entries (SENSEX, BANKEX, CRUDEOIL, CRUDEOILM, NATURALGAS,
 * NATGASMINI) are outside Dhan's NSE-only list — user-supplied, current as
 * of ~Jan 2026, cross-referenced against multiple sources (Zerodha/Groww
 * lot-size pages) for the index values.
 *
 * Not covered: precious/base-metal MCX contracts (GOLD, GOLDM, SILVER,
 * SILVERM, SILVERMIC, COPPER, ZINCMINI, ALUMINI) and a handful of stocks
 * whose F&O symbol changed after a corporate action this list doesn't
 * reflect (e.g. TATAMOTORS -> TMPV after the commercial-vehicles demerger).
 * Callers should show "—" for anything not in this map, never fall back to
 * a guessed value.
 */
export const CURRENT_LOT_SIZES: Record<string, number> = {
  // BSE indices (not in Dhan's NSE-only list) — user-supplied.
  SENSEX: 20,
  BANKEX: 30,
  // MCX commodities (not in Dhan's NSE-only list) — user-supplied, cross-
  // checked against real trade quantities (e.g. a COPPER trade of exactly
  // 2500 units = 1 lot, a SILVERM trade of exactly 110 units = 22 lots).
  CRUDEOIL: 100,
  CRUDEOILM: 10,
  NATURALGAS: 1250,
  NATGASMINI: 250,
  COPPER: 2500,
  GOLDM: 100,
  SILVER: 30,
  SILVERM: 5,
  // These four report quantity already in whole lots (1 = 1 lot) rather
  // than a smaller natural unit — verified the same way (every real
  // quantity seen for these was itself a small whole number).
  GOLD: 1,
  ALUMINI: 1,
  ZINCMINI: 1,
  SILVERMIC: 1,

  // NSE stock + index F&O — sourced from Dhan's lot-size CSV (see header comment).
  "360ONE": 500,
  // Not in Dhan's current list — user-supplied, verified: the sole real
  // AARTIIND trade seen is exactly 1325 (single data point, less certain
  // than the multi-trade-confirmed entries below).
  AARTIIND: 1325,
  ABB: 125,
  ABCAPITAL: 3100,
  ADANIENSOL: 675,
  ADANIENT: 309,
  ADANIGREEN: 600,
  ADANIPORTS: 475,
  ADANIPOWER: 3550,
  ALKEM: 125,
  AMBER: 100,
  AMBUJACEM: 1200,
  ANGELONE: 2500,
  APLAPOLLO: 350,
  APOLLOHOSP: 125,
  ASHOKLEY: 5000,
  ASIANPAINT: 250,
  ASTRAL: 425,
  ATHERENERG: 375,
  AUBANK: 1000,
  AUROPHARMA: 550,
  AXISBANK: 625,
  "BAJAJ-AUTO": 75,
  BAJAJFINSV: 300,
  BAJAJHLDNG: 75,
  BAJFINANCE: 750,
  BANDHANBNK: 3600,
  BANKBARODA: 2925,
  BANKINDIA: 5200,
  BANKNIFTY: 30,
  BDL: 425,
  BEL: 1425,
  BHARATFORG: 500,
  BHARTIARTL: 475,
  BHEL: 2625,
  BIOCON: 2500,
  BLUESTARCO: 325,
  BOSCHLTD: 25,
  BPCL: 1975,
  BRITANNIA: 125,
  BSE: 200,
  CAMS: 825,
  CANBK: 6750,
  CDSL: 475,
  CGPOWER: 850,
  CHOLAFIN: 625,
  CIPLA: 425,
  COALINDIA: 1350,
  COCHINSHIP: 400,
  COFORGE: 475,
  COLPAL: 275,
  CONCOR: 1250,
  CROMPTON: 2150,
  CUMMINSIND: 200,
  DABUR: 1250,
  // Not in Dhan's current list (likely removed from F&O since traded) —
  // user-supplied, cross-checked: every real DALBHARAT trade quantity seen
  // is an exact multiple of 325.
  DALBHARAT: 325,
  DELHIVERY: 2075,
  DIVISLAB: 100,
  DIXON: 50,
  DLF: 950,
  DMART: 150,
  DRREDDY: 625,
  EICHERMOT: 100,
  // Not in Dhan's current list — user-supplied, cross-checked: every real
  // EXIDEIND trade quantity seen (19 trades) is exactly 1800.
  EXIDEIND: 1800,
  ETERNAL: 2425,
  FEDERALBNK: 2500,
  FINNIFTY: 60,
  FORCEMOT: 25,
  FORTIS: 775,
  GAIL: 3550,
  GLENMARK: 375,
  GMRAIRPORT: 6975,
  GODFRYPHLP: 275,
  GODREJCP: 500,
  GODREJPROP: 325,
  GOLDSTAR: 1100,
  GRASIM: 250,
  "GVT&D": 125,
  HAL: 150,
  HAVELLS: 500,
  HCLTECH: 400,
  HDFCAMC: 300,
  HDFCBANK: 650,
  HDFCLIFE: 1100,
  HEROMOTOCO: 150,
  HINDALCO: 700,
  HINDPETRO: 2025,
  HINDUNILVR: 300,
  HINDZINC: 1225,
  HYUNDAI: 275,
  ICICIBANK: 700,
  ICICIGI: 325,
  ICICIPRULI: 925,
  IDEA: 71475,
  IDFCFIRSTB: 9275,
  IEX: 4350,
  // Not in Dhan's current list — user-supplied, verified: the sole real
  // IIFL trade seen is exactly 1650 (single data point).
  IIFL: 1650,
  INDHOTEL: 1000,
  INDIANB: 1000,
  INDIGO: 150,
  INDUSINDBK: 700,
  INDUSTOWER: 1700,
  INFY: 400,
  INOXWIND: 6400,
  IOC: 4875,
  IREDA: 4525,
  IRFC: 5425,
  ITC: 1725,
  JINDALSTEL: 625,
  JIOFIN: 2350,
  JSWENERGY: 1075,
  JSWSTEEL: 675,
  JUBLFOOD: 1250,
  KALYANKJIL: 1350,
  KAYNES: 150,
  KEI: 175,
  KFINTECH: 575,
  KOTAKBANK: 2000,
  KPITTECH: 775,
  // Not in Dhan's current list — user-supplied, verified: both real
  // LALPATHLAB trades seen are exactly 150.
  LALPATHLAB: 150,
  LAURUSLABS: 850,
  LICHSGFIN: 1000,
  LICI: 1400,
  LODHA: 625,
  LT: 175,
  LTF: 2250,
  // Not in Dhan's current list — user-supplied, verified: both real LTIM
  // trades seen are exactly 150.
  LTIM: 150,
  LTM: 150,
  // Not in Dhan's current list — user-supplied, verified: both real LTTS
  // trades seen are exactly 100.
  LTTS: 100,
  LUPIN: 425,
  "M&M": 200,
  MAHABANK: 6500,
  MANAPPURAM: 3000,
  MANKIND: 250,
  MARICO: 1200,
  MARUTI: 50,
  MAXHEALTH: 525,
  MAZDOCK: 225,
  MCX: 225,
  MFSL: 400,
  MIDCPNIFTY: 120,
  MOTHERSON: 6150,
  MOTILALOFS: 775,
  MPHASIS: 275,
  MUTHOOTFIN: 275,
  "NAM-INDIA": 625,
  NATIONALUM: 1875,
  NAUKRI: 550,
  NBCC: 6500,
  NESTLEIND: 500,
  NHPC: 6950,
  NIFTY: 65,
  NIFTYNXT50: 25,
  NMDC: 6750,
  NTPC: 1500,
  // Not in Dhan's current list — user-supplied 250, consistent with (not
  // contradicted by) all 4 real trades being exactly 500 = 2 lots.
  NUVAMA: 250,
  NYKAA: 3125,
  OBEROIRLTY: 350,
  OFSS: 100,
  OIL: 1400,
  ONGC: 2250,
  PAGEIND: 20,
  PATANJALI: 1075,
  PAYTM: 725,
  PERSISTENT: 125,
  PETRONET: 1900,
  PFC: 1300,
  PGEL: 950,
  PHOENIXLTD: 350,
  PIDILITIND: 500,
  PIIND: 175,
  PNB: 8000,
  PNBHOUSING: 650,
  POLICYBZR: 350,
  POLYCAB: 125,
  POWERGRID: 1900,
  POWERINDIA: 25,
  // Not in Dhan's current list — user-supplied, verified: all 4 real
  // PPLPHARMA trades seen (4 separate dates) are exactly 2625.
  PPLPHARMA: 2625,
  PREMIERENE: 650,
  PRESTIGE: 450,
  // Not in Dhan's current list — user-supplied, verified: both real
  // PVRINOX trades seen are exactly 407.
  PVRINOX: 407,
  RADICO: 150,
  RBLBANK: 3175,
  RECLTD: 1575,
  RELIANCE: 500,
  RVNL: 1925,
  SAGILITY: 12000,
  SAIL: 4700,
  // Not in Dhan's current list — user-supplied, verified: real SAMMAANCAP
  // trades are 4300, 4300, and 8600 (= 2x4300).
  SAMMAANCAP: 4300,
  SBICARD: 800,
  SBILIFE: 375,
  SBIN: 750,
  SHREECEM: 25,
  SHRIRAMFIN: 825,
  SIEMENS: 175,
  SOLARINDS: 50,
  SONACOMS: 1225,
  SRF: 200,
  SUNPHARMA: 350,
  SUPREMEIND: 175,
  SUZLON: 12700,
  SWIGGY: 1825,
  TATACONSUM: 550,
  TATAELXSI: 125,
  // Not in Dhan's current list (removed from F&O since traded, pre-demerger
  // symbol — see TMPV) — user-supplied, verified: all 8 real trades = 550.
  TATAMOTORS: 550,
  TATAPOWER: 1450,
  TATASTEEL: 2750,
  TCS: 225,
  TECHM: 600,
  TIINDIA: 200,
  // Not in Dhan's current list — user-supplied, verified: all 3 real
  // TITAGARH trades seen (3 separate dates) are exactly 725.
  TITAGARH: 725,
  TITAN: 175,
  TMPV: 1600,
  TORNTPHARM: 125,
  // Not in Dhan's current list — user-supplied, verified: the sole real
  // TORNTPOWER trade seen is exactly 850 (single data point).
  TORNTPOWER: 850,
  TRENT: 225,
  TVSMOTOR: 175,
  ULTRACEMCO: 50,
  UNIONBANK: 4425,
  UNITDSPR: 400,
  UNOMINDA: 550,
  UPL: 1355,
  VBL: 1275,
  VEDL: 1150,
  VMM: 4850,
  VOLTAS: 375,
  WAAREEENER: 175,
  WIPRO: 3000,
  YESBANK: 31100,
  ZYDUSLIFE: 900,
};

export function getCurrentLotSize(underlying: string | null | undefined): number | null {
  if (!underlying) return null;
  return CURRENT_LOT_SIZES[underlying.toUpperCase()] ?? null;
}
