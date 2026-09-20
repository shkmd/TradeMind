"use client";

import { useMemo, useState } from "react";
import {
  type Column,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TablePagination } from "@/components/shared/table-pagination";
import { cn, formatINR, formatPercent } from "@/lib/utils";

export interface HoldingRow {
  id: string;
  symbol: string;
  brokerNickname: string;
  instrumentType: "STOCK" | "ETF";
  quantity: number;
  avgCostPrice: number;
  currentPrice: number | null;
  value: number | null;
  unrealised: number | null;
  unrealisedPct: number | null;
}

const ALL_BROKERS = "__all_brokers__";
const ALL_TYPES = "__all_types__";

const columns: ColumnDef<HoldingRow>[] = [
  {
    accessorKey: "symbol",
    header: ({ column }) => <SortButton column={column}>Instrument</SortButton>,
    cell: ({ row }) => <span className="font-medium">{row.original.symbol}</span>,
  },
  {
    accessorKey: "brokerNickname",
    header: ({ column }) => <SortButton column={column}>Broker</SortButton>,
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.brokerNickname}</span>,
    filterFn: "equals",
  },
  {
    accessorKey: "instrumentType",
    header: ({ column }) => <SortButton column={column}>Type</SortButton>,
    cell: ({ row }) => (
      <Badge variant="secondary">{row.original.instrumentType === "ETF" ? "ETF/Fund" : "Stock"}</Badge>
    ),
    filterFn: "equals",
  },
  {
    accessorKey: "quantity",
    header: ({ column }) => <SortButton column={column}>Qty</SortButton>,
  },
  {
    accessorKey: "avgCostPrice",
    header: ({ column }) => <SortButton column={column}>Avg cost</SortButton>,
    cell: ({ row }) => formatINR(row.original.avgCostPrice),
  },
  {
    accessorKey: "currentPrice",
    header: ({ column }) => <SortButton column={column}>Current price</SortButton>,
    cell: ({ row }) => (row.original.currentPrice !== null ? formatINR(row.original.currentPrice) : "—"),
  },
  {
    accessorKey: "value",
    header: ({ column }) => <SortButton column={column}>Value</SortButton>,
    cell: ({ row }) => (row.original.value !== null ? formatINR(row.original.value) : "—"),
  },
  {
    accessorKey: "unrealised",
    header: ({ column }) => <SortButton column={column}>Unrealised P&amp;L</SortButton>,
    cell: ({ row }) => {
      const { unrealised, unrealisedPct } = row.original;
      return (
        <span className={cn(unrealised === null ? "text-muted-foreground" : unrealised >= 0 ? "text-success" : "text-danger")}>
          {unrealised !== null ? `${formatINR(unrealised)} (${formatPercent(unrealisedPct)})` : "—"}
        </span>
      );
    },
  },
];

function SortButton({ column, children }: { column: Column<HoldingRow, unknown>; children: React.ReactNode }) {
  return (
    <button
      className="flex items-center gap-1 hover:text-foreground"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {children}
      <ArrowUpDown className="h-3 w-3" />
    </button>
  );
}

export function HoldingsTable({ data }: { data: HoldingRow[] }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "value", desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [symbolFilter, setSymbolFilter] = useState("");

  const brokers = useMemo(() => Array.from(new Set(data.map((h) => h.brokerNickname))).sort(), [data]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, globalFilter: symbolFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setSymbolFilter,
    initialState: { pagination: { pageSize: 25 } },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: (row, _columnId, filterValue) => row.original.symbol.toLowerCase().includes(filterValue.toLowerCase()),
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Filter by symbol..."
          value={symbolFilter}
          onChange={(e) => setSymbolFilter(e.target.value)}
          className="max-w-xs"
        />
        <Select
          value={(table.getColumn("brokerNickname")?.getFilterValue() as string) ?? ALL_BROKERS}
          onValueChange={(value) => table.getColumn("brokerNickname")?.setFilterValue(value === ALL_BROKERS ? undefined : value)}
        >
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
        <Select
          value={(table.getColumn("instrumentType")?.getFilterValue() as string) ?? ALL_TYPES}
          onValueChange={(value) => table.getColumn("instrumentType")?.setFilterValue(value === ALL_TYPES ? undefined : value)}
        >
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
      <div className="overflow-x-auto rounded-lg border border-surface-border bg-surface">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="whitespace-nowrap">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="whitespace-nowrap">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-8 text-center text-sm text-muted-foreground">
                  No holdings match your filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <TablePagination table={table} totalRows={table.getFilteredRowModel().rows.length} />
    </div>
  );
}
