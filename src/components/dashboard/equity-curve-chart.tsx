"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatINR } from "@/lib/utils";

export function EquityCurveChart({ data }: { data: { date: string; cumulativeNetPnl: number }[] }) {
  if (data.length === 0) {
    return <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">No closed trades yet.</div>;
  }

  const isPositive = data[data.length - 1]!.cumulativeNetPnl >= 0;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={isPositive ? "#10B981" : "#EF4444"} stopOpacity={0.25} />
            <stop offset="100%" stopColor={isPositive ? "#10B981" : "#EF4444"} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#E4E7E4" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#E4E7E4" }} />
        <YAxis
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={70}
          tickFormatter={(v) => formatINR(v, { decimals: false })}
        />
        <Tooltip
          formatter={(value: number) => [formatINR(value), "Cumulative net P&L"]}
          contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "#E4E7E4" }}
        />
        <Area
          type="monotone"
          dataKey="cumulativeNetPnl"
          stroke={isPositive ? "#10B981" : "#EF4444"}
          strokeWidth={2}
          fill="url(#equityFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
