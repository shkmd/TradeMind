"use client";

import { useState } from "react";
import {
  type Column,
  type ColumnDef,
  type ExpandedState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, ChevronDown, ChevronRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
  // Present only on a group row consolidating the same real security (by
  // ISIN) held across multiple broker accounts — see holdings-view.tsx.
  subRows?: HoldingRow[];
}

const columns: ColumnDef<HoldingRow>[] = [
  {
    accessorKey: "symbol",
    header: ({ column }) => <SortButton column={column}>Instrument</SortButton>,
    cell: ({ row }) => (
      <div className="flex items-center gap-1.5" style={{ paddingLeft: `${row.depth * 1.25}rem` }}>
        {row.getCanExpand() ? (
          <button
            onClick={row.getToggleExpandedHandler()}
            className="text-muted-foreground hover:text-foreground"
            aria-label={row.getIsExpanded() ? "Collapse" : "Expand"}
          >
            {row.getIsExpanded() ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : (
          row.depth > 0 && <span className="inline-block w-3.5" />
        )}
        <span className="font-medium">{row.original.symbol}</span>
      </div>
    ),
  },
  {
    accessorKey: "brokerNickname",
    header: ({ column }) => <SortButton column={column}>Broker</SortButton>,
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.brokerNickname}</span>,
  },
  {
    accessorKey: "instrumentType",
    header: ({ column }) => <SortButton column={column}>Type</SortButton>,
    cell: ({ row }) => (
      <Badge variant="secondary">{row.original.instrumentType === "ETF" ? "ETF/Fund" : "Stock"}</Badge>
    ),
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
  const [expanded, setExpanded] = useState<ExpandedState>({});

  const table = useReactTable({
    data,
    columns,
    state: { sorting, expanded },
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    getSubRows: (row) => row.subRows,
    // Keep a group's broker-leg rows attached under their parent regardless
    // of which page it falls on, rather than TanStack's default of counting
    // expanded children toward the page size and splitting them off.
    paginateExpandedRows: false,
    initialState: { pagination: { pageSize: 25 } },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="space-y-3">
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
              <TableRow key={row.id} className={row.depth > 0 ? "bg-surface-muted/50" : undefined}>
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
      <TablePagination table={table} totalRows={data.length} />
    </div>
  );
}
