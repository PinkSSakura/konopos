import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  CaseSensitive,
  ChevronUp,
  CornerDownLeft,
  Expand,
  GripVertical,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useTouchMode } from '../../context/TouchModeContext';
import {
  KEYBOARD_LANG,
  KEYBOARD_LAYOUTS,
  LANG_LABELS,
} from '../../data/keyboardLayouts';
import {
  backspaceField,
  fieldPrefersDigits,
  findEditableTarget,
  insertIntoField,
  isEditableField,
  suppressNativeKeyboard,
  submitField,
} from '../../utils/touchKeyboardInput';
import {
  defaultFabRect,
  defaultPanelRect,
  useFloatingRect,
} from '../../hooks/useFloatingDrag';

const STORAGE_LANG = 'konopos_touch_kb_lang';
const STORAGE_FAB = 'konopos_touch_kb_fab';
const STORAGE_PANEL = 'konopos_touch_kb_panel';

const FAB_SIZE = 56;
const FAB_SIZE_TOUCH = 64;

function readStoredLang() {
  try {
    const v = localStorage.getItem(STORAGE_LANG);
    if (v && Object.values(KEYBOARD_LANG).includes(v)) return v;
  } catch {
    /* ignore */
  }
  return KEYBOARD_LANG.FR;
}

function isPanelRectValid(rect) {
  return rect.width >= 200 && rect.height >= 150;
}

export default function TouchVirtualKeyboard() {
  const { touchMode } = useTouchMode();
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState(readStoredLang);
  const [shift, setShift] = useState(false);
  const [target, setTarget] = useState(null);

  const fabSize = touchMode ? FAB_SIZE_TOUCH : FAB_SIZE;
  const fab = useFloatingRect(
    STORAGE_FAB,
    () => defaultFabRect(fabSize),
    { draggable: true, resizable: false, minW: fabSize, minH: fabSize, clickThreshold: 10 }
  );

  const panel = useFloatingRect(
    STORAGE_PANEL,
    defaultPanelRect,
    { draggable: true, resizable: true, minW: 280, minH: 200, clickThreshold: 6 }
  );

  useEffect(() => {
    if (!touchMode) {
      setOpen(false);
      return undefined;
    }

    const onFocusIn = (e) => {
      const field = findEditableTarget(e.target);
      if (!field) return;
      suppressNativeKeyboard(field);
      setTarget(field);
      if (fieldPrefersDigits(field)) {
        setLang(KEYBOARD_LANG.DIGITS);
      }
    };

    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, [touchMode]);

  useEffect(() => {
    localStorage.setItem(STORAGE_LANG, lang);
    if (lang !== KEYBOARD_LANG.FR) setShift(false);
  }, [lang]);

  useEffect(() => {
    document.documentElement.classList.toggle('touch-kb-open', open);
    return () => document.documentElement.classList.remove('touch-kb-open');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!isPanelRectValid(panel.rect)) {
      panel.resetToDefault();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const layoutKey = useMemo(() => {
    if (lang === KEYBOARD_LANG.FR && shift) return `${KEYBOARD_LANG.FR}_shift`;
    return lang;
  }, [lang, shift]);

  const rows = KEYBOARD_LAYOUTS[layoutKey] || KEYBOARD_LAYOUTS[KEYBOARD_LANG.FR];

  const handleKey = useCallback(
    (key) => {
      if (!target || !isEditableField(target)) return;
      if (key === ' ') insertIntoField(target, ' ');
      else insertIntoField(target, key);
    },
    [target]
  );

  const handleLangChange = (value) => {
    setLang(value);
    if (target && isEditableField(target)) {
      target.dir = value === KEYBOARD_LANG.AR ? 'rtl' : 'ltr';
      target.style.textAlign = value === KEYBOARD_LANG.AR ? 'right' : '';
    }
  };

  const onFabPointerUp = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (fab.consumeClickIfMoved()) return;
    setOpen((v) => !v);
  };

  if (!touchMode) return null;

  const targetLabel = target?.placeholder || target?.name || 'champ sélectionné';

  const ui = (
    <>
      <div
        className="touch-kb-fab-wrap"
        style={fab.style}
        {...fab.bindMoveHandle}
        onPointerUp={onFabPointerUp}
        role="button"
        tabIndex={0}
        aria-label="Ouvrir le clavier tactile"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
      >
        <Button
          size="icon-lg"
          className={`touch-kb-fab rounded-full ${touchMode ? 'touch-kb-fab-lg' : ''}`}
          tabIndex={-1}
          aria-hidden
        >
          <CaseSensitive className="size-5" />
        </Button>
      </div>

      {open && (
        <div
          className="touch-kb-panel"
          style={{ ...panel.style, zIndex: 10050 }}
          role="dialog"
          aria-label="Clavier virtuel"
        >
          <div className="touch-kb-panel-header" {...panel.bindMoveHandle}>
            <span className="touch-kb-drag-grip" title="Glisser pour déplacer">
              <GripVertical className="size-4" />
            </span>
            <div className="touch-kb-header-controls touch-kb-no-drag">
              <ToggleGroup
                type="single"
                value={lang}
                onValueChange={(value) => value && handleLangChange(value)}
                variant="outline"
                size="sm"
                className="touch-kb-lang"
              >
                {LANG_LABELS.map(({ key, label }) => (
                  <ToggleGroupItem
                    key={key}
                    value={key}
                    className="min-w-11 px-3 py-1.5 text-[15px] font-semibold"
                  >
                    {label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <p className="touch-kb-hint truncate text-sm text-muted-foreground">
                {target ? targetLabel : 'Touchez un champ texte'}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="touch-kb-close touch-kb-no-drag"
              onClick={() => setOpen(false)}
              aria-label="Fermer le clavier"
            >
              <X className="size-4" />
            </Button>
          </div>

          <div className="touch-kb-panel-body">
            <div className={`touch-kb-keys ${lang === KEYBOARD_LANG.AR ? 'touch-kb-keys-rtl' : ''}`}>
              {rows.map((row, ri) => (
                <div key={ri} className="touch-kb-row">
                  {row.map((key) => (
                    <button
                      key={`${ri}-${key}`}
                      type="button"
                      className={`touch-kb-key ${key === ' ' ? 'touch-kb-key-space' : ''}`}
                      onPointerDown={(e) => e.preventDefault()}
                      onClick={() => handleKey(key)}
                    >
                      {key === ' ' ? 'Espace' : key}
                    </button>
                  ))}
                </div>
              ))}

              <div className="touch-kb-row touch-kb-row-actions">
                <button
                  type="button"
                  className="touch-kb-key touch-kb-key-space touch-kb-key-action"
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => handleKey(' ')}
                >
                  Espace
                </button>
                {lang === KEYBOARD_LANG.FR && (
                  <button
                    type="button"
                    className={`touch-kb-key touch-kb-key-action ${shift ? 'touch-kb-key-active' : ''}`}
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => setShift((s) => !s)}
                  >
                    <ChevronUp className="inline size-4" /> Maj
                  </button>
                )}
                <button
                  type="button"
                  className="touch-kb-key touch-kb-key-action"
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => target && backspaceField(target)}
                >
                  <ArrowLeft className="inline size-4" /> Effacer
                </button>
                <button
                  type="button"
                  className="touch-kb-key touch-kb-key-action touch-kb-key-enter"
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => target && submitField(target)}
                >
                  <CornerDownLeft className="inline size-4" /> Entrée
                </button>
              </div>
            </div>
          </div>

          <div
            className="touch-kb-resize-handle"
            title="Glisser pour redimensionner"
            {...panel.bindResizeHandle}
          >
            <Expand className="size-4" />
          </div>
        </div>
      )}
    </>
  );

  return createPortal(ui, document.body);
}
