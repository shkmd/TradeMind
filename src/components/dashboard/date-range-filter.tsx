"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { subDays, format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PRESETS = [
  { label: "15 Days", days: 15 },
  { label: "Month", days: 30 },
  { label: "3 Months", days: 90 },
  { label: "Year", days: 365 },
];

export function DashboardDateFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentFrom = searchParams.get("from") ?? "";
  const currentTo = searchParams.get("to") ?? "";
  const [customFrom, setCustomFrom] = useState(currentFrom);
  const [customTo, setCustomTo] = useState(currentTo);

  function applyRange(from: string | null, to: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (from) params.set("from", from);
    else params.delete("from");
    if (to) params.set("to", to);
    else params.delete("to");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function applyPreset(days: number) {
    const to = new Date();
    const from = subDays(to, days);
    const fromStr = format(from, "yyyy-MM-dd");
    const toStr = format(to, "yyyy-MM-dd");
    setCustomFrom(fromStr);
    setCustomTo(toStr);
    applyRange(fromStr, toStr);
  }

  function clearFilter() {
    setCustomFrom("");
    setCustomTo("");
    applyRange(null, null);
  }

  const isAllTime = !currentFrom && !currentTo;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Button variant={isAllTime ? "secondary" : "outline"} size="sm" onClick={clearFilter}>
        All Time
      </Button>
      {PRESETS.map((p) => (
        <Button key={p.label} variant="outline" size="sm" onClick={() => applyPreset(p.days)}>
          {p.label}
        </Button>
      ))}
      <div className="flex items-center gap-1.5">
        <Input
          type="date"
          value={customFrom}
          onChange={(e) => setCustomFrom(e.target.value)}
          className="h-8 w-[9.5rem] text-xs"
          aria-label="From date"
        />
        <span className="text-xs text-muted-foreground">to</span>
        <Input
          type="date"
          value={customTo}
          onChange={(e) => setCustomTo(e.target.value)}
          className="h-8 w-[9.5rem] text-xs"
          aria-label="To date"
        />
        <Button size="sm" variant="outline" onClick={() => applyRange(customFrom || null, customTo || null)}>
          Apply
        </Button>
      </div>
    </div>
  );
}
