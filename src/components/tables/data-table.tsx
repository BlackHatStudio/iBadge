// src/components/tables/data-table.tsx
'use client';

import * as React from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  type Row,
} from '@tanstack/react-table';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { DataTablePagination } from './data-table-pagination';
import { DataTableViewOptions } from './data-table-view-options';
import { Input } from '@/components/ui/input';

function isInteractive(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  if (['a', 'button', 'input', 'select', 'textarea', 'label'].includes(tag)) return true;
  if (el.closest('a,button,input,select,textarea,label,[data-row-click-ignore="true"]')) return true;
  if (el.closest('[role="columnheader"]')) return true;
  return false;
}

type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  initialPageSize?: number;
  onRowClick?: (row: Row<TData>) => void;
  getRowClassName?: (row: Row<TData>) => string | undefined;
  /** Show/hide the Columns button (default: true) */
  showColumnOptions?: boolean;
  filterColumnId?: string;
  filterPlaceholder?: string;
  className?: string;
};

export function DataTable<TData, TValue>({
  columns,
  data,
  initialPageSize = 20,
  onRowClick,
  getRowClassName,
  showColumnOptions = true,
  filterColumnId,
  filterPlaceholder = 'Filter...',
  className,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<any[]>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<Record<string, boolean>>({});
  const [rowSelection, setRowSelection] = React.useState<Record<string, boolean>>({});

  const defaultFilterable =
    filterColumnId ??
    ((columns as unknown as any[])
      .find((c) => typeof c?.accessorKey === 'string')
      ?.accessorKey?.toString() as string | undefined);

  // TanStack Table returns unstable function refs; React Compiler skips memo here — safe for our usage.
  // eslint-disable-next-line react-hooks/incompatible-library -- useReactTable is the supported API
  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, columnVisibility, rowSelection },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageIndex: 0, pageSize: initialPageSize },
    },
  });

  return (
    <div className={["space-y-3", className].filter(Boolean).join(' ')}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center py-2">
        {defaultFilterable ? (
          <Input
            placeholder={filterPlaceholder}
            value={(table.getColumn(defaultFilterable)?.getFilterValue() as string) ?? ''}
            onChange={(e) => table.getColumn(defaultFilterable)?.setFilterValue(e.target.value)}
            className="max-w-sm"
          />
        ) : null}

        {showColumnOptions && (
          <div className="ml-auto">
            <DataTableViewOptions table={table as any} />
          </div>
        )}
      </div>

      <div className="p9-table-wrap overflow-hidden rounded-xl border">
        <Table className="p9-table">
          <TableHeader className="p9-thead">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="p9-th" role="columnheader">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody className="p9-tbody">
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => {
                const clickable = Boolean(onRowClick);

                const handleClick: React.MouseEventHandler<HTMLTableRowElement> = (e) => {
                  if (!clickable) return;
                  if (isInteractive(e.target)) return;
                  onRowClick?.(row);
                };

                const handleKeyDown: React.KeyboardEventHandler<HTMLTableRowElement> = (e) => {
                  if (!clickable) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onRowClick?.(row);
                  }
                };

                const extra = getRowClassName?.(row) ?? '';
                const clickCls = clickable ? 'p9-tr--clickable' : '';

                return (
                  <TableRow
                    key={row.id}
                    className={['p9-tr', clickCls, extra].filter(Boolean).join(' ')}
                    aria-selected={row.getIsSelected() ? 'true' : 'false'}
                    onClick={handleClick}
                    onKeyDown={handleKeyDown}
                    tabIndex={clickable ? 0 : -1}
                    role={clickable ? 'button' : undefined}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="p9-td">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            ) : (
              <TableRow className="p9-tr">
                <TableCell colSpan={columns.length} className="p9-td p9-empty">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <DataTablePagination table={table} />
      </div>
    </div>
  );
}
