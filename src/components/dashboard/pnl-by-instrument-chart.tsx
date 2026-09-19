"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatINR } from "@/lib/utils";

export function PnlByInstrumentChart({ data }: { data: { symbol: string; netPnl: number }[] }) {
  if (data.length === 0) {
    return <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">No trades yet.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E4E7E4" vertical={false} />
        <XAxis dataKey="symbol" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#E4E7E4" }} />
        <YAxis
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={70}
          tickFormatter={(v) => formatINR(v, { decimals: false })}
        />
        <Tooltip
          formatter={(value: number) => [formatINR(value), "Net P&L"]}
          contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "#E4E7E4" }}
        />
        <Bar dataKey="netPnl" radius={[4, 4, 0, 0]}>
          {data.map((entry) => (
            <Cell key={entry.symbol} fill={entry.netPnl >= 0 ? "#10B981" : "#EF4444"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
