"use client";

import { useMemo, useState } from "react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { HoldingsTable, type HoldingRow } from "@/components/portfolio/holdings-table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatINR, formatPercent } from "@/lib/utils";

export interface HoldingViewRow {
  id: string;
  symbol: string;
  brokerNickname: string;
  instrumentType: "STOCK" | "ETF";
  quantity: number;
  avgCostPrice: number;
  currentPrice: number | null;
  previousClose: number | null;
}

const ALL_BROKERS = "__all_brokers__";
const ALL_TYPES = "__all_types__";

export function HoldingsView({ holdings }: { holdings: HoldingViewRow[] }) {
  const [symbolFilter, setSymbolFilter] = useState("");
  const [brokerFilter, setBrokerFilter] = useState(ALL_BROKERS);
  const [typeFilter, setTypeFilter] = useState(ALL_TYPES);

  const brokers = useMemo(() => Array.from(new Set(holdings.map((h) => h.brokerNickname))).sort(), [holdings]);

  const filtered = useMemo(
    () =>
      holdings.filter(
        (h) =>
          (symbolFilter === "" || h.symbol.toLowerCase().includes(symbolFilter.toLowerCase())) &&
          (brokerFilter === ALL_BROKERS || h.brokerNickname === brokerFilter) &&
          (typeFilter === ALL_TYPES || h.instrumentType === typeFilter)
      ),
    [holdings, symbolFilter, brokerFilter, typeFilter]
  );

  // Same KPI math as before, now recomputed over whatever the filters leave
  // — invested amount is knowable for every holding regardless of live
  // pricing (cost basis is always on file); gain figures only make sense
  // over holdings with a known current price, so they're computed
  // separately rather than treating a missing price as zero.
  const totalInvested = filtered.reduce((sum, h) => sum + h.avgCostPrice * h.quantity, 0);
  const pricedHoldings = filtered.filter((h) => h.currentPrice !== null);
  const currentValue = pricedHoldings.reduce((sum, h) => sum + h.currentPrice! * h.quantity, 0);
  const investedForPriced = pricedHoldings.reduce((sum, h) => sum + h.avgCostPrice * h.quantity, 0);
  const overallGain = currentValue - investedForPriced;
  const overallGainPct = investedForPriced !== 0 ? (overallGain / investedForPriced) * 100 : null;

  const holdingsWithPrevClose = filtered.filter((h) => h.currentPrice !== null && h.previousClose !== null);
  const todaysGain = holdingsWithPrevClose.reduce(
    (sum, h) => sum + (h.currentPrice! - h.previousClose!) * h.quantity,
    0
  );
  const todaysBaseValue = holdingsWithPrevClose.reduce((sum, h) => sum + h.previousClose! * h.quantity, 0);
  const todaysGainPct = todaysBaseValue !== 0 ? (todaysGain / todaysBaseValue) * 100 : null;
  const unpricedCount = filtered.length - pricedHoldings.length;

  const tableData: HoldingRow[] = filtered.map((h) => {
    const value = h.currentPrice !== null ? h.currentPrice * h.quantity : null;
    const unrealised = h.currentPrice !== null ? (h.currentPrice - h.avgCostPrice) * h.quantity : null;
    const unrealisedPct = h.currentPrice !== null ? ((h.currentPrice - h.avgCostPrice) / h.avgCostPrice) * 100 : null;
    return {
      id: h.id,
      symbol: h.symbol,
      brokerNickname: h.brokerNickname,
      instrumentType: h.instrumentType,
      quantity: h.quantity,
      avgCostPrice: h.avgCostPrice,
      currentPrice: h.currentPrice,
      value,
      unrealised,
      unrealisedPct,
    };
  });

  return (
    <div>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Total holdings" value={String(filtered.length)} />
        <KpiCard label="Invested amount" value={formatINR(totalInvested)} />
        <KpiCard label="Current value" value={formatINR(currentValue)} />
        <KpiCard
          label="Overall gain"
          value={`${formatINR(overallGain)}${overallGainPct !== null ? ` (${formatPercent(overallGainPct)})` : ""}`}
          tone={overallGain >= 0 ? "positive" : "negative"}
          sublabel={unpricedCount > 0 ? `${unpricedCount} holding${unpricedCount === 1 ? "" : "s"} without a live price, excluded` : undefined}
        />
        <KpiCard
          label="Today's gain"
          value={
            holdingsWithPrevClose.length > 0
              ? `${formatINR(todaysGain)}${todaysGainPct !== null ? ` (${formatPercent(todaysGainPct)})` : ""}`
              : "—"
          }
          tone={holdingsWithPrevClose.length > 0 ? (todaysGain >= 0 ? "positive" : "negative") : "neutral"}
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Input
          placeholder="Filter by symbol..."
          value={symbolFilter}
          onChange={(e) => setSymbolFilter(e.target.value)}
          className="max-w-xs"
        />
        <Select value={brokerFilter} onValueChange={setBrokerFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All brokers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_BROKERS}>All brokers</SelectItem>
            {brokers.map((broker) => (
              <SelectItem key={broker} value={broker}>
                {broker}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_TYPES}>All types</SelectItem>
            <SelectItem value="STOCK">Stocks</SelectItem>
            <SelectItem value="ETF">ETFs/Funds</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <HoldingsTable data={tableData} />
    </div>
  );
}
