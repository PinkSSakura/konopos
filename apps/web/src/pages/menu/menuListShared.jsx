import React, { useEffect, useState } from 'react';
import TableListFilterBar from '../../components/TableListFilterBar';
import Combobox from '../../components/Combobox';
import { PageTableCard } from '../../components/layout/PageShell';
import AppSelect from '@/components/ui/AppSelect';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DEFAULT_TABLE_PAGE_SIZE, TABLE_PAGE_SIZE_OPTIONS } from '../../utils/tablePagination';
import { filterMenuRows, MENU_FILTER_PLACEHOLDERS } from './menuListFilters';

export function MenuTable({
  columns,
  rows,
  rowKey = '_id',
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [rows]);

  const paginatedRows = rows.slice((page - 1) * pageSize, page * pageSize);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount);

  return (
    <div>
      <div className="menu-table-wrap data-table-wrap">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-3 py-2.5 font-medium text-muted-foreground ${col.className || ''}`}
                >
                  {col.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-muted-foreground">
                  Aucun élément pour le moment.
                </td>
              </tr>
            ) : (
              paginatedRows.map((row) => (
                <tr key={row[rowKey]} className="border-t transition-colors hover:bg-muted/30">
                  {columns.map((col) => (
                    <td key={col.key} className={`px-3 py-2.5 align-middle ${col.className || ''}`}>
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {rows.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2 text-sm">
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
              {TABLE_PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
      )}
    </div>
  );
}

export function MenuSectionPanel({
  section,
  label,
  columns,
  rows,
  categories = [],
}) {
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState(null);
  const [productType, setProductType] = useState(null);
  const [active, setActive] = useState(null);
  const [applied, setApplied] = useState({
    search: '',
    categoryId: null,
    productType: null,
    active: null,
  });

  const resetFilters = () => {
    setSearch('');
    setCategoryId(null);
    setProductType(null);
    setActive(null);
    setApplied({
      search: '',
      categoryId: null,
      productType: null,
      active: null,
    });
  };

  const applyFilters = () => {
    setApplied({
      search,
      categoryId,
      productType,
      active,
    });
  };

  const filteredRows = filterMenuRows(section, rows, applied);

  const filterExtra = (
    <>
      {(section === 'subcategories' || section === 'items') && (
        <Combobox
          options={[
            { value: '', label: 'Toutes catégories' },
            ...categories.map((c) => ({ value: c._id, label: c.name })),
          ]}
          value={categoryId || ''}
          onValueChange={(value) => setCategoryId(value || null)}
          placeholder="Catégorie"
          className="w-full min-w-[160px] sm:w-[200px]"
        />
      )}
      {section === 'items' && (
        <AppSelect
          allowClear
          placeholder="Type produit"
          style={{ width: 160 }}
          value={productType}
          onChange={setProductType}
          options={[
            { value: 'FOOD', label: 'Cuisine' },
            { value: 'DRINK', label: 'Bar' },
          ]}
        />
      )}
      {section === 'extras' && (
        <AppSelect
          allowClear
          placeholder="Statut"
          style={{ width: 140 }}
          value={active}
          onChange={setActive}
          options={[
            { value: 'yes', label: 'Actif' },
            { value: 'no', label: 'Inactif' },
          ]}
        />
      )}
    </>
  );

  return (
    <PageTableCard title={label} contentClassName="space-y-4">
      <TableListFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={MENU_FILTER_PLACEHOLDERS[section]}
        onApply={applyFilters}
        onReset={resetFilters}
        extra={filterExtra}
      />
      <MenuTable columns={columns} rows={filteredRows} />
    </PageTableCard>
  );
}
