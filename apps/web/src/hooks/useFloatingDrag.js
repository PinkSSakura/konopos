import { useCallback, useEffect, useRef, useState } from 'react';

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

function clampRect(rect, { minW = 48, minH = 48, margin = 8 } = {}) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.max(minW, Math.min(rect.width, vw - margin * 2));
  const height = Math.max(minH, Math.min(rect.height, vh - margin * 2));
  const x = Math.max(margin, Math.min(rect.x, vw - width - margin));
  const y = Math.max(margin, Math.min(rect.y, vh - height - margin));
  return { x, y, width, height };
}

function normalizeRect(raw, fallback, opts) {
  if (!raw || typeof raw !== 'object') return clampRect(fallback, opts);
  const rect = {
    x: Number(raw.x),
    y: Number(raw.y),
    width: Number(raw.width),
    height: Number(raw.height),
  };
  if (![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)) {
    return clampRect(fallback, opts);
  }
  return clampRect(rect, opts);
}

/**
 * Position flottante (FAB ou fenêtre) — glisser-déposer au pointeur.
 * Le clic reste fonctionnel : preventDefault seulement après déplacement réel.
 */
export function useFloatingRect(storageKey, defaultRect, options = {}) {
  const {
    draggable = true,
    resizable = false,
    clickThreshold = 10,
    minW = 48,
    minH = 48,
  } = options;

  const [rect, setRect] = useState(() =>
    normalizeRect(loadJson(storageKey, null), defaultRect(), { minW, minH })
  );

  const dragState = useRef(null);
  const movedRef = useRef(false);

  useEffect(() => {
    saveJson(storageKey, rect);
  }, [storageKey, rect]);

  useEffect(() => {
    const onResize = () => setRect((r) => clampRect(r, { minW, minH }));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [minW, minH]);

  const endDrag = useCallback(() => {
    dragState.current = null;
    document.body.classList.remove('touch-kb-dragging');
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      const s = dragState.current;
      if (!s) return;

      const dx = e.clientX - s.startX;
      const dy = e.clientY - s.startY;

      if (!s.active) {
        if (Math.abs(dx) <= clickThreshold && Math.abs(dy) <= clickThreshold) return;
        s.active = true;
        movedRef.current = true;
        document.body.classList.add('touch-kb-dragging');
      }

      e.preventDefault();

      if (s.mode === 'move' && draggable) {
        setRect((r) =>
          clampRect(
            { ...r, x: s.originX + dx, y: s.originY + dy },
            { minW, minH }
          )
        );
      } else if (s.mode === 'resize' && resizable) {
        setRect((r) =>
          clampRect(
            { ...r, width: s.originW + dx, height: s.originH + dy },
            { minW, minH }
          )
        );
      }
    };

    const onUp = () => endDrag();

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [clickThreshold, draggable, resizable, endDrag, minW, minH]);

  const startDrag = useCallback(
    (mode) => (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      if (e.target.closest?.('.touch-kb-no-drag')) return;

      movedRef.current = false;
      dragState.current = {
        mode,
        active: false,
        startX: e.clientX,
        startY: e.clientY,
        originX: rect.x,
        originY: rect.y,
        originW: rect.width,
        originH: rect.height,
      };
    },
    [rect]
  );

  const consumeClickIfMoved = useCallback(() => {
    if (movedRef.current) {
      movedRef.current = false;
      return true;
    }
    return false;
  }, []);

  const resetToDefault = useCallback(() => {
    setRect(clampRect(defaultRect(), { minW, minH }));
  }, [defaultRect, minW, minH]);

  const style = {
    position: 'fixed',
    left: rect.x,
    top: rect.y,
    width: rect.width,
    height: rect.height,
    zIndex: 1100,
  };

  return {
    rect,
    setRect,
    style,
    movedRef,
    consumeClickIfMoved,
    resetToDefault,
    bindMoveHandle: draggable ? { onPointerDown: startDrag('move') } : {},
    bindResizeHandle: resizable ? { onPointerDown: startDrag('resize') } : {},
  };
}

export function defaultFabRect(size = 56) {
  const margin = 20;
  return {
    x: Math.max(margin, window.innerWidth - size - margin),
    y: Math.max(margin, window.innerHeight - size - margin),
    width: size,
    height: size,
  };
}

export function defaultPanelRect() {
  const margin = 12;
  const width = Math.min(720, window.innerWidth - margin * 2);
  const height = Math.min(380, Math.floor(window.innerHeight * 0.45));
  return {
    x: Math.max(margin, (window.innerWidth - width) / 2),
    y: Math.max(margin, window.innerHeight - height - margin - 80),
    width,
    height,
  };
}
