import React, { useEffect, useMemo, useState } from 'react';
import { Search, RotateCcw } from 'lucide-react';
import Combobox from '../../components/Combobox';
import MenuMobileCardList from '../../components/menu/MenuMobileCardList';
import MenuMobileDetail from '../../components/menu/MenuMobileDetail';
import MobileActionSheet from '../../components/mobile/MobileActionSheet';
import CollapsibleToolbar from '../../components/layout/CollapsibleToolbar';
import useIsMobile from '../../hooks/useIsMobile';
import { PageTableCard } from '../../components/layout/PageShell';
import AppSelect from '@/components/ui/AppSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DEFAULT_TABLE_PAGE_SIZE, TABLE_PAGE_SIZE_OPTIONS } from '../../utils/tablePagination';
import { filterMenuRows, MENU_FILTER_PLACEHOLDERS } from './menuListFilters';

function useMenuPagination(rows) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [rows]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paginatedRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return {
    paginatedRows,
    page,
    setPage,
    pageSize,
    setPageSize,
    pageCount,
    currentPage,
  };
}

function MenuPaginationControls({
  rowsLength,
  pageSize,
  setPageSize,
  currentPage,
  pageCount,
  setPage,
}) {
  if (rowsLength <= 0) return null;

  return (
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
  );
}

export function MenuTable({
  columns,
  rows,
  rowKey = '_id',
}) {
  const {
    paginatedRows,
    page,
    setPage,
    pageSize,
    setPageSize,
    pageCount,
    currentPage,
  } = useMenuPagination(rows);

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
      <MenuPaginationControls
        rowsLength={rows.length}
        pageSize={pageSize}
        setPageSize={setPageSize}
        currentPage={currentPage}
        pageCount={pageCount}
        setPage={setPage}
      />
    </div>
  );
}

function MenuMobileListView({
  section,
  rows,
  getRowActions,
}) {
  const {
    paginatedRows,
    page,
    setPage,
    pageSize,
    setPageSize,
    pageCount,
    currentPage,
  } = useMenuPagination(rows);
  const [selectedRow, setSelectedRow] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  const sheetActions = selectedRow && getRowActions
    ? getRowActions(selectedRow).map((action) => ({
      ...action,
      onClick: action.confirm
        ? () => setPendingDelete(action)
        : action.onClick,
      keepOpen: action.confirm ? true : undefined,
    }))
    : [];

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    await pendingDelete.onClick?.();
    setPendingDelete(null);
    setSelectedRow(null);
  };

  return (
    <>
      <MenuMobileCardList
        section={section}
        rows={paginatedRows}
        onSelect={setSelectedRow}
      />
      <MenuPaginationControls
        rowsLength={rows.length}
        pageSize={pageSize}
        setPageSize={setPageSize}
        currentPage={currentPage}
        pageCount={pageCount}
        setPage={setPage}
      />

      <MobileActionSheet
        open={Boolean(selectedRow)}
        onOpenChange={(open) => { if (!open) setSelectedRow(null); }}
        title={selectedRow?.name || 'Détail'}
        subtitle={section === 'subcategories'
          ? selectedRow?.category?.name
          : section === 'items'
            ? selectedRow?.category?.name
            : section === 'extras' && selectedRow
              ? `${selectedRow.price} MAD`
              : null}
        actions={sheetActions}
      >
        <MenuMobileDetail section={section} row={selectedRow} />
      </MobileActionSheet>

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => { if (!open) setPendingDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmation</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.confirm || 'Êtes-vous sûr ?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleConfirmDelete}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function MenuSectionPanel({
  section,
  columns,
  rows,
  categories = [],
  getRowActions,
}) {
  const isMobile = useIsMobile();
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

  const filterSummary = useMemo(() => {
    const parts = [];
    if (applied.search?.trim()) {
      parts.push(`« ${applied.search.trim()} »`);
    }
    if (applied.categoryId) {
      const category = categories.find((entry) => entry._id === applied.categoryId);
      if (category) parts.push(category.name);
    }
    if (applied.productType === 'FOOD') parts.push('Cuisine');
    if (applied.productType === 'DRINK') parts.push('Bar');
    if (applied.active === 'yes') parts.push('Actif');
    if (applied.active === 'no') parts.push('Inactif');
    return parts.length ? parts.join(' · ') : 'Tous';
  }, [applied, categories]);

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
    <PageTableCard contentClassName="space-y-4">
      <CollapsibleToolbar title="Recherche & filtres" summary={filterSummary}>
        <div className="menu-filter-panel">
          <div className="menu-filter-panel__search relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={MENU_FILTER_PLACEHOLDERS[section]}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyFilters();
              }}
              className="pl-9"
            />
          </div>
          {section !== 'categories' ? (
            <div className="menu-filter-panel__extra">{filterExtra}</div>
          ) : null}
          <div className="menu-filter-panel__actions">
            <Button type="button" onClick={applyFilters}>
              Filtrer
            </Button>
            <Button type="button" variant="outline" onClick={resetFilters}>
              <RotateCcw data-icon="inline-start" />
              Réinitialiser
            </Button>
          </div>
        </div>
      </CollapsibleToolbar>
      {isMobile && getRowActions ? (
        <MenuMobileListView
          section={section}
          rows={filteredRows}
          getRowActions={getRowActions}
        />
      ) : (
        <MenuTable columns={columns} rows={filteredRows} />
      )}
    </PageTableCard>
  );
}
