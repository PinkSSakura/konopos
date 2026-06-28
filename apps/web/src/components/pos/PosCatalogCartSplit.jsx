import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'konopos_pos_catalog_split_pct';
const DEFAULT_PCT = 58;
const MIN_CATALOG_PCT = 35;
const MAX_CATALOG_PCT = 75;

function readStoredPct() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const n = Number(raw);
    if (Number.isFinite(n) && n >= MIN_CATALOG_PCT && n <= MAX_CATALOG_PCT) return n;
  } catch {
    /* ignore */
  }
  return DEFAULT_PCT;
}

export default function PosCatalogCartSplit({ catalog, cart, className }) {
  const [catalogPct, setCatalogPct] = useState(readStoredPct);
  const dragging = useRef(false);
  const containerRef = useRef(null);

  const onPointerMove = useCallback((event) => {
    if (!dragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const pct = Math.round((x / rect.width) * 100);
    const clamped = Math.min(MAX_CATALOG_PCT, Math.max(MIN_CATALOG_PCT, pct));
    setCatalogPct(clamped);
  }, []);

  const stopDrag = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', stopDrag);
    window.addEventListener('pointercancel', stopDrag);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', stopDrag);
      window.removeEventListener('pointercancel', stopDrag);
    };
  }, [onPointerMove, stopDrag]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(catalogPct));
    } catch {
      /* ignore */
    }
  }, [catalogPct]);

  const startDrag = (event) => {
    event.preventDefault();
    dragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <div
      ref={containerRef}
      className={cn('pos-split-layout', className)}
      style={{ '--pos-catalog-pct': `${catalogPct}%` }}
    >
      <div className="pos-split-layout__catalog">{catalog}</div>
      <div
        className="pos-split-layout__handle"
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={catalogPct}
        aria-valuemin={MIN_CATALOG_PCT}
        aria-valuemax={MAX_CATALOG_PCT}
        aria-label="Redimensionner catalogue et panier"
        onPointerDown={startDrag}
      >
        <GripVertical className="size-4 text-muted-foreground" aria-hidden />
      </div>
      <div className="pos-split-layout__cart">{cart}</div>
    </div>
  );
}
