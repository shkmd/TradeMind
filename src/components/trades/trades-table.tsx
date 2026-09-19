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
import { ArrowUpDown, CheckCircle2, CircleDashed } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TablePagination } from "@/components/shared/table-pagination";
import { cn, formatDate, formatINR } from "@/lib/utils";

export interface TradeRow {
  id: string;
  symbol: string;
  brokerName: string;
  side: string;
  productType: string;
  status: string;
  openedAt: string;
  closedAt: string | null;
  entryAvgPrice: number;
  exitAvgPrice: number | null;
  grossPnl: number | null;
  totalCharges: number | null;
  netPnl: number | null;
  processScore: number | null;
  ruleComplianceScore: number | null;
  journaled: boolean;
}

const columns: ColumnDef<TradeRow>[] = [
  {
    accessorKey: "openedAt",
    header: ({ column }) => <SortButton column={column}>Date</SortButton>,
    cell: ({ row }) => formatDate(row.original.openedAt),
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
    accessorKey: "side",
    header: "Side",
    cell: ({ row }) => (
      <Badge variant={row.original.side === "BUY" ? "success" : "danger"}>{row.original.side}</Badge>
    ),
  },
  { accessorKey: "productType", header: "Product" },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <Badge variant="secondary">{row.original.status.replace("_", " ")}</Badge>,
  },
  {
    accessorKey: "grossPnl",
    header: ({ column }) => <SortButton column={column}>Gross P&amp;L</SortButton>,
    cell: ({ row }) => <PnlCell value={row.original.grossPnl} />,
  },
  {
    accessorKey: "totalCharges",
    header: "Charges",
    cell: ({ row }) => (row.original.totalCharges !== null ? formatINR(row.original.totalCharges) : "—"),
  },
  {
    accessorKey: "netPnl",
    header: ({ column }) => <SortButton column={column}>Net P&amp;L</SortButton>,
    cell: ({ row }) => <PnlCell value={row.original.netPnl} />,
  },
  {
    accessorKey: "processScore",
    header: ({ column }) => <SortButton column={column}>Process</SortButton>,
    cell: ({ row }) => (row.original.processScore !== null ? row.original.processScore : "—"),
  },
  {
    accessorKey: "ruleComplianceScore",
    header: "Rule compliance",
    cell: ({ row }) =>
      row.original.ruleComplianceScore !== null ? `${row.original.ruleComplianceScore}%` : "—",
  },
  {
    accessorKey: "journaled",
    header: "Journal",
    cell: ({ row }) =>
      row.original.journaled ? (
        <CheckCircle2 className="h-4 w-4 text-success" />
      ) : (
        <CircleDashed className="h-4 w-4 text-muted-foreground" />
      ),
  },
];

function SortButton({ column, children }: { column: Column<TradeRow, unknown>; children: React.ReactNode }) {
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

export function TradesTable({ data }: { data: TradeRow[] }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "openedAt", desc: true }]);
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
      const symbol = row.original.symbol.toLowerCase();
      const broker = row.original.brokerName.toLowerCase();
      return symbol.includes(filterValue.toLowerCase()) || broker.includes(filterValue.toLowerCase());
    },
  });

  return (
    <div className="space-y-3">
      <Input
        placeholder="Filter by symbol or broker..."
        value={globalFilter}
        onChange={(e) => setGlobalFilter(e.target.value)}
        className="max-w-xs"
      />
      <div className="overflow-hidden rounded-lg border border-surface-border bg-surface">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
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
                  <TableCell key={cell.id} className="p-0">
                    <Link href={`/trading/trades/${row.original.id}`} className="block px-3 py-2.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </Link>
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-8 text-center text-sm text-muted-foreground">
                  No trades match your filter.
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
