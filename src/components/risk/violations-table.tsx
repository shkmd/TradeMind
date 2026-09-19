"use client";

import { useState } from "react";
import Link from "next/link";
import {
  type Column,
  type ColumnDef,
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
import { TablePagination } from "@/components/shared/table-pagination";
import { cn, formatDate, formatINR } from "@/lib/utils";

export interface ViolationRow {
  id: string;
  tradeId: string;
  symbol: string;
  brokerName: string;
  ruleName: string;
  side: string;
  quantity: number;
  entryPrice: number;
  exitPrice: number | null;
  lotSize: number | null;
  lots: number | null;
  buyValue: number | null;
  sellValue: number | null;
  grossPnl: number | null;
  netPnl: number | null;
  financialCost: number | null;
  tradeDate: string;
}

const columns: ColumnDef<ViolationRow>[] = [
  {
    accessorKey: "tradeDate",
    header: ({ column }) => <SortButton column={column}>Date</SortButton>,
    cell: ({ row }) => formatDate(row.original.tradeDate),
  },
  {
    accessorKey: "symbol",
    header: ({ column }) => <SortButton column={column}>Instrument</SortButton>,
    cell: ({ row }) => (
      <div>
        <p className="font-medium">{row.original.symbol}</p>
        <p className="text-xs text-muted-foreground">{row.original.brokerName}</p>
      </div>
    ),
  },
  {
    accessorKey: "ruleName",
    header: ({ column }) => <SortButton column={column}>Rule violated</SortButton>,
  },
  {
    accessorKey: "side",
    header: "Side",
    cell: ({ row }) => (
      <Badge variant={row.original.side === "BUY" ? "success" : "danger"}>{row.original.side}</Badge>
    ),
  },
  {
    accessorKey: "lotSize",
    header: "Lot Size",
    cell: ({ row }) => row.original.lotSize ?? "—",
  },
  {
    accessorKey: "lots",
    header: ({ column }) => <SortButton column={column}>Lots</SortButton>,
    cell: ({ row }) =>
      row.original.lots !== null
        ? row.original.lots % 1 === 0
          ? row.original.lots
          : row.original.lots.toFixed(2)
        : "—",
  },
  {
    accessorKey: "quantity",
    header: ({ column }) => <SortButton column={column}>Qty</SortButton>,
  },
  {
    accessorKey: "entryPrice",
    header: ({ column }) => <SortButton column={column}>Entry Price</SortButton>,
    cell: ({ row }) => formatINR(row.original.entryPrice),
  },
  {
    accessorKey: "exitPrice",
    header: ({ column }) => <SortButton column={column}>Exit Price</SortButton>,
    cell: ({ row }) => (row.original.exitPrice !== null ? formatINR(row.original.exitPrice) : "—"),
  },
  {
    accessorKey: "buyValue",
    header: ({ column }) => <SortButton column={column}>Buy Value</SortButton>,
    cell: ({ row }) => (row.original.buyValue !== null ? formatINR(row.original.buyValue) : "—"),
  },
  {
    accessorKey: "sellValue",
    header: ({ column }) => <SortButton column={column}>Sell Value</SortButton>,
    cell: ({ row }) => (row.original.sellValue !== null ? formatINR(row.original.sellValue) : "—"),
  },
  {
    accessorKey: "grossPnl",
    header: ({ column }) => <SortButton column={column}>Gross P&amp;L</SortButton>,
    cell: ({ row }) => <PnlCell value={row.original.grossPnl} />,
  },
  {
    accessorKey: "netPnl",
    header: ({ column }) => <SortButton column={column}>Net P&amp;L</SortButton>,
    cell: ({ row }) => <PnlCell value={row.original.netPnl} />,
  },
  {
    accessorKey: "financialCost",
    header: ({ column }) => <SortButton column={column}>Violation Cost</SortButton>,
    cell: ({ row }) =>
      row.original.financialCost !== null ? (
        <span className="financial-figure text-danger">{formatINR(row.original.financialCost)}</span>
      ) : (
        "—"
      ),
  },
];

function SortButton({ column, children }: { column: Column<ViolationRow, unknown>; children: React.ReactNode }) {
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

function PnlCell({ value }: { value: number | null }) {
  if (value === null) return <span>—</span>;
  return <span className={cn("financial-figure", value >= 0 ? "text-success" : "text-danger")}>{formatINR(value)}</span>;
}

export function ViolationsTable({ data }: { data: ViolationRow[] }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "tradeDate", desc: true }]);
  const [globalFilter, setGlobalFilter] = useState("");

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    initialState: { pagination: { pageSize: 25 } },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: (row, _columnId, filterValue) => {
      const needle = filterValue.toLowerCase();
      return (
        row.original.symbol.toLowerCase().includes(needle) ||
        row.original.brokerName.toLowerCase().includes(needle) ||
        row.original.ruleName.toLowerCase().includes(needle)
      );
    },
  });

  return (
    <div className="space-y-3">
      <Input
        placeholder="Filter by symbol, broker or rule..."
        value={globalFilter}
        onChange={(e) => setGlobalFilter(e.target.value)}
        className="max-w-xs"
      />
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
              <TableRow key={row.id} className="cursor-pointer">
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="whitespace-nowrap p-0">
                    <Link href={`/trading/trades/${row.original.tradeId}`} className="block px-3 py-2.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </Link>
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-8 text-center text-sm text-muted-foreground">
                  No violations match your filter.
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
