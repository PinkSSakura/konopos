import React, { useMemo, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { DEFAULT_TABLE_PAGE_SIZE, TABLE_PAGE_SIZE_OPTIONS } from '@/utils/tablePagination';

function resolveRowKey(record, index, rowKey) {
  if (typeof rowKey === 'function') return rowKey(record);
  if (rowKey) return record[rowKey];
  return record._id ?? record.id ?? index;
}

function getCellValue(record, column) {
  if (column.render) {
    const value = column.dataIndex
      ? (Array.isArray(column.dataIndex)
        ? column.dataIndex.reduce((acc, key) => acc?.[key], record)
        : record[column.dataIndex])
      : undefined;
    return column.render(value, record);
  }
  if (Array.isArray(column.dataIndex)) {
    return column.dataIndex.reduce((acc, key) => acc?.[key], record);
  }
  return record[column.dataIndex];
}

export default function SimpleTable({
  columns = [],
  dataSource = [],
  rowKey = '_id',
  pagination = {},
  loading = false,
  locale,
  className,
}) {
  const paginate = pagination !== false;
  const defaultPageSize = pagination?.defaultPageSize ?? DEFAULT_TABLE_PAGE_SIZE;
  const pageSizeOptions = pagination?.pageSizeOptions ?? TABLE_PAGE_SIZE_OPTIONS;

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const total = dataSource.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount);

  const rows = useMemo(() => {
    if (!paginate) return dataSource;
    const start = (currentPage - 1) * pageSize;
    return dataSource.slice(start, start + pageSize);
  }, [dataSource, paginate, currentPage, pageSize]);

  if (loading) {
    return (
      <div className={cn('rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground', className)}>
        Chargement…
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className={cn('rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground', className)}>
        {locale?.emptyText || 'Aucune donnée'}
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead
                  key={column.key || column.dataIndex || column.title}
                  className={cn(column.className, column.align === 'center' && 'text-center')}
                  style={column.width ? { width: column.width } : undefined}
                >
                  {column.title}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((record, index) => (
              <TableRow key={resolveRowKey(record, index, rowKey)}>
                {columns.map((column) => (
                  <TableCell
                    key={column.key || column.dataIndex || column.title}
                    className={cn(column.className, column.align === 'center' && 'text-center')}
                  >
                    {getCellValue(record, column)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {paginate && total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">
            {total} élément{total > 1 ? 's' : ''}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {pagination?.showSizeChanger !== false && (
              <Select
                value={String(pageSize)}
                onValueChange={(value) => {
                  setPageSize(Number(value));
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[88px]" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pageSizeOptions.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size} / page
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Préc.
            </Button>
            <span>
              {currentPage} / {pageCount}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage >= pageCount}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            >
              Suiv.
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Ant Design Table alias for gradual migration. */
export { SimpleTable as Table };
