import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

dayjs.locale('fr');

const HOUR_START = 6;
const HOUR_END = 24;
const HOUR_HEIGHT = 48;
const SNAP_MINUTES = 15;
const MIN_DURATION_MINUTES = 30;
const DEFAULT_CLICK_DURATION_MINUTES = 60;
const DRAG_THRESHOLD_PX = 4;

const ROLE_COLORS = {
  waiter: 'bg-blue-500/85 border-blue-600 text-white',
  cook: 'bg-orange-500/85 border-orange-600 text-white',
  barman: 'bg-violet-500/85 border-violet-700 text-white',
};

function weekDays(weekStart) {
  return Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day'));
}

function snapMinutes(rawMinutes) {
  const max = (HOUR_END - HOUR_START) * 60;
  const snapped = Math.round(rawMinutes / SNAP_MINUTES) * SNAP_MINUTES;
  return Math.max(0, Math.min(max, snapped));
}

function yToMinutes(clientY, columnTop) {
  const relativeY = clientY - columnTop;
  return snapMinutes((relativeY / HOUR_HEIGHT) * 60);
}

function minutesToDayTime(day, minutesFromGridStart) {
  const totalMinutes = HOUR_START * 60 + minutesFromGridStart;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return day.hour(hour).minute(minute).second(0).millisecond(0);
}

function planTopPx(plan) {
  const start = dayjs(plan.planned_start);
  const minutes = (start.hour() - HOUR_START) * 60 + start.minute();
  return Math.max(0, (minutes / 60) * HOUR_HEIGHT);
}

function planHeightPx(plan) {
  const start = dayjs(plan.planned_start);
  const end = dayjs(plan.planned_end);
  const minutes = Math.max(MIN_DURATION_MINUTES, end.diff(start, 'minute'));
  return (minutes / 60) * HOUR_HEIGHT;
}

function planDurationMinutes(plan) {
  return Math.max(
    MIN_DURATION_MINUTES,
    dayjs(plan.planned_end).diff(dayjs(plan.planned_start), 'minute'),
  );
}

function normalizeRange(startMinutes, endMinutes) {
  let start = snapMinutes(Math.min(startMinutes, endMinutes));
  let end = snapMinutes(Math.max(startMinutes, endMinutes));
  if (end - start < MIN_DURATION_MINUTES) {
    end = Math.min((HOUR_END - HOUR_START) * 60, start + MIN_DURATION_MINUTES);
  }
  return { start, end };
}

export default function ShiftPlannerCalendar({
  plans,
  weekStart,
  onWeekChange,
  onPlanClick,
  onRangeSelect,
  onPlanChange,
}) {
  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const hours = useMemo(
    () => Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i),
    [],
  );

  const gridRef = useRef(null);
  const columnRefs = useRef({});
  const dragRef = useRef(null);
  const suppressPlanClickRef = useRef(false);
  const [dragPreview, setDragPreview] = useState(null);

  const plansByDay = useMemo(() => {
    const map = {};
    for (const day of days) {
      const key = day.format('YYYY-MM-DD');
      map[key] = plans.filter((p) => dayjs(p.planned_start).format('YYYY-MM-DD') === key);
    }
    return map;
  }, [plans, days]);

  const getDayFromClientX = useCallback((clientX) => {
    const grid = gridRef.current;
    if (!grid) return null;
    const dayColumns = grid.querySelectorAll('[data-day-column]');
    for (let i = 0; i < dayColumns.length; i += 1) {
      const rect = dayColumns[i].getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right) {
        return days[i];
      }
    }
    return null;
  }, [days]);

  const finishDrag = useCallback((drag) => {
    if (!drag) return;

    if (drag.type === 'create' && onRangeSelect) {
      const { start, end } = normalizeRange(drag.startMinutes, drag.currentMinutes);
      const startTime = minutesToDayTime(drag.day, start);
      const endTime = minutesToDayTime(drag.day, end);
      onRangeSelect(startTime, endTime);
    }

    if (drag.type === 'move' && onPlanChange) {
      const duration = drag.durationMinutes;
      const start = snapMinutes(drag.currentMinutes);
      const end = Math.min(
        (HOUR_END - HOUR_START) * 60,
        start + duration,
      );
      const startTime = minutesToDayTime(drag.day, start);
      const endTime = minutesToDayTime(drag.day, end);
      onPlanChange(drag.plan._id, {
        planned_start: startTime.toDate(),
        planned_end: endTime.toDate(),
      });
    }

    if (drag.type === 'resize' && onPlanChange) {
      const startMinutes = dayjs(drag.plan.planned_start).diff(
        dayjs(drag.plan.planned_start).startOf('day'),
        'minute',
      ) - HOUR_START * 60;
      const { end } = normalizeRange(startMinutes, drag.currentMinutes);
      const day = dayjs(drag.plan.planned_start);
      const startTime = dayjs(drag.plan.planned_start);
      const endTime = minutesToDayTime(day, end);
      onPlanChange(drag.plan._id, {
        planned_start: startTime.toDate(),
        planned_end: endTime.toDate(),
      });
    }
  }, [onRangeSelect, onPlanChange]);

  const handlePointerMove = useCallback((event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const movedPx = Math.abs(event.clientY - drag.originY)
      + (drag.type === 'move' ? Math.abs(event.clientX - drag.originX) : 0);

    if (!drag.moved && movedPx < DRAG_THRESHOLD_PX && drag.type === 'create') {
      return;
    }

    drag.moved = true;

    if (drag.type === 'move') {
      const day = getDayFromClientX(event.clientX);
      const column = day ? columnRefs.current[day.format('YYYY-MM-DD')] : null;
      if (!day || !column) return;
      const rect = column.getBoundingClientRect();
      const currentMinutes = yToMinutes(event.clientY, rect.top);
      const maxStart = (HOUR_END - HOUR_START) * 60 - drag.durationMinutes;
      const clamped = Math.max(0, Math.min(maxStart, currentMinutes));
      drag.day = day;
      drag.currentMinutes = clamped;
      setDragPreview({
        type: 'move',
        dayKey: day.format('YYYY-MM-DD'),
        top: (clamped / 60) * HOUR_HEIGHT,
        height: (drag.durationMinutes / 60) * HOUR_HEIGHT,
        label: drag.plan.user?.fullname,
      });
      return;
    }

    const column = columnRefs.current[drag.dayKey];
    if (!column) return;
    const rect = column.getBoundingClientRect();
    const currentMinutes = yToMinutes(event.clientY, rect.top);
    drag.currentMinutes = currentMinutes;

    const { start, end } = normalizeRange(drag.startMinutes, currentMinutes);
    setDragPreview({
      type: drag.type,
      dayKey: drag.dayKey,
      top: (start / 60) * HOUR_HEIGHT,
      height: ((end - start) / 60) * HOUR_HEIGHT,
      label: drag.type === 'resize' ? drag.plan.user?.fullname : null,
    });
  }, [getDayFromClientX]);

  const handlePointerUp = useCallback((event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    window.removeEventListener('pointercancel', handlePointerUp);

    if (drag.type === 'create' && !drag.moved) {
      const endMinutes = Math.min(
        (HOUR_END - HOUR_START) * 60,
        drag.startMinutes + DEFAULT_CLICK_DURATION_MINUTES,
      );
      drag.currentMinutes = endMinutes;
    }

    if (drag.type === 'move' || drag.type === 'resize') {
      if (drag.moved) {
        suppressPlanClickRef.current = true;
        finishDrag(drag);
      }
    } else if (drag.type === 'create') {
      finishDrag(drag);
    }

    dragRef.current = null;
    setDragPreview(null);
  }, [finishDrag, handlePointerMove]);

  const startPointerDrag = useCallback((event, dragState) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    const pointerId = event.pointerId;
    event.currentTarget.setPointerCapture?.(pointerId);

    dragRef.current = {
      ...dragState,
      pointerId,
      originX: event.clientX,
      originY: event.clientY,
      moved: false,
    };

    if (dragState.type === 'create') {
      setDragPreview({
        type: 'create',
        dayKey: dragState.dayKey,
        top: (dragState.startMinutes / 60) * HOUR_HEIGHT,
        height: (DEFAULT_CLICK_DURATION_MINUTES / 60) * HOUR_HEIGHT,
      });
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  }, [handlePointerMove, handlePointerUp]);

  const onColumnPointerDown = useCallback((event, day) => {
    if (!onRangeSelect) return;
    if (event.target.closest('[data-plan-block]')) return;

    const column = columnRefs.current[day.format('YYYY-MM-DD')];
    if (!column) return;
    const rect = column.getBoundingClientRect();
    const startMinutes = yToMinutes(event.clientY, rect.top);

    startPointerDrag(event, {
      type: 'create',
      day,
      dayKey: day.format('YYYY-MM-DD'),
      startMinutes,
      currentMinutes: startMinutes,
    });
  }, [onRangeSelect, startPointerDrag]);

  const onPlanMoveStart = useCallback((event, plan, day) => {
    if (!onPlanChange || event.target.closest('[data-resize-handle]')) return;

    const start = dayjs(plan.planned_start);
    const startMinutes = (start.hour() - HOUR_START) * 60 + start.minute();

    startPointerDrag(event, {
      type: 'move',
      plan,
      day,
      dayKey: day.format('YYYY-MM-DD'),
      durationMinutes: planDurationMinutes(plan),
      currentMinutes: startMinutes,
      startMinutes,
    });
  }, [onPlanChange, startPointerDrag]);

  const onPlanResizeStart = useCallback((event, plan) => {
    if (!onPlanChange) return;
    event.stopPropagation();

    const start = dayjs(plan.planned_start);
    const end = dayjs(plan.planned_end);
    const startMinutes = (start.hour() - HOUR_START) * 60 + start.minute();
    const endMinutes = (end.hour() - HOUR_START) * 60 + end.minute();

    startPointerDrag(event, {
      type: 'resize',
      plan,
      dayKey: start.format('YYYY-MM-DD'),
      startMinutes,
      currentMinutes: endMinutes,
    });
  }, [onPlanChange, startPointerDrag]);

  useEffect(() => () => {
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    window.removeEventListener('pointercancel', handlePointerUp);
  }, [handlePointerMove, handlePointerUp]);

  const canInteract = Boolean(onRangeSelect || onPlanChange);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" size="icon" onClick={() => onWeekChange(weekStart.subtract(1, 'week'))}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onWeekChange(dayjs().startOf('week'))}>
            Cette semaine
          </Button>
          <Button type="button" variant="outline" size="icon" onClick={() => onWeekChange(weekStart.add(1, 'week'))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <p className="text-sm font-medium capitalize">
          {days[0].format('D MMM')} — {days[6].format('D MMM YYYY')}
        </p>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="size-2.5 rounded bg-blue-500" /> Serveur</span>
          <span className="flex items-center gap-1"><span className="size-2.5 rounded bg-orange-500" /> Cuisine</span>
          <span className="flex items-center gap-1"><span className="size-2.5 rounded bg-violet-500" /> Bar</span>
        </div>
      </div>

      {canInteract && (
        <p className="text-xs text-muted-foreground">
          Glissez sur un jour pour créer un créneau (plusieurs heures). Déplacez ou redimensionnez un bloc existant.
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-border bg-muted/40">
            <div />
            {days.map((day) => (
              <div
                key={day.format('YYYY-MM-DD')}
                className={cn(
                  'border-l border-border px-2 py-2 text-center text-xs font-medium',
                  day.isSame(dayjs(), 'day') && 'bg-[var(--brand-primary)]/10',
                )}
              >
                <div className="capitalize">{day.format('ddd')}</div>
                <div className="text-base">{day.format('D')}</div>
              </div>
            ))}
          </div>

          <div ref={gridRef} className="grid grid-cols-[56px_repeat(7,1fr)]">
            <div className="relative" style={{ height: (HOUR_END - HOUR_START) * HOUR_HEIGHT }}>
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="absolute right-2 -translate-y-1/2 text-[10px] text-muted-foreground"
                  style={{ top: (hour - HOUR_START) * HOUR_HEIGHT }}
                >
                  {`${hour}h`}
                </div>
              ))}
            </div>

            {days.map((day) => {
              const key = day.format('YYYY-MM-DD');
              const dayPlans = plansByDay[key] || [];
              const preview = dragPreview?.dayKey === key ? dragPreview : null;

              return (
                <div
                  key={key}
                  ref={(node) => {
                    columnRefs.current[key] = node;
                  }}
                  data-day-column
                  className={cn(
                    'relative touch-none border-l border-border select-none',
                    day.isSame(dayjs(), 'day') && 'bg-[var(--brand-primary)]/5',
                    onRangeSelect && 'cursor-crosshair',
                  )}
                  style={{ height: (HOUR_END - HOUR_START) * HOUR_HEIGHT }}
                  onPointerDown={(event) => onColumnPointerDown(event, day)}
                >
                  {hours.map((hour) => (
                    <div
                      key={hour}
                      className="pointer-events-none absolute left-0 right-0 border-t border-border/60"
                      style={{
                        top: (hour - HOUR_START) * HOUR_HEIGHT,
                        height: HOUR_HEIGHT,
                      }}
                    />
                  ))}

                  {preview && (
                    <div
                      className={cn(
                        'pointer-events-none absolute left-1 right-1 z-20 rounded border-2 border-dashed px-1.5 py-0.5',
                        preview.type === 'create'
                          ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/25'
                          : 'border-primary bg-primary/20',
                      )}
                      style={{
                        top: preview.top,
                        height: preview.height,
                        minHeight: 22,
                      }}
                    >
                      {preview.label && (
                        <div className="truncate text-[11px] font-semibold text-foreground">
                          {preview.label}
                        </div>
                      )}
                    </div>
                  )}

                  {dayPlans.map((plan) => (
                    <div
                      key={plan._id}
                      data-plan-block
                      className={cn(
                        'absolute left-1 right-1 z-10 overflow-hidden rounded border px-1.5 py-0.5 text-left text-[11px] shadow-sm',
                        ROLE_COLORS[plan.role_key] || 'bg-muted border-border',
                        onPlanChange ? 'cursor-grab active:cursor-grabbing' : '',
                      )}
                      style={{
                        top: planTopPx(plan),
                        height: planHeightPx(plan),
                        minHeight: 22,
                      }}
                      onPointerDown={(event) => onPlanMoveStart(event, plan, day)}
                    >
                      <button
                        type="button"
                        className="block w-full text-left"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (suppressPlanClickRef.current) {
                            suppressPlanClickRef.current = false;
                            return;
                          }
                          onPlanClick?.(plan);
                        }}
                      >
                        <div className="truncate font-semibold">{plan.user?.fullname || '—'}</div>
                        <div className="truncate opacity-90">
                          {dayjs(plan.planned_start).format('HH:mm')}
                          {' – '}
                          {dayjs(plan.planned_end).format('HH:mm')}
                        </div>
                      </button>
                      {onPlanChange && (
                        <div
                          data-resize-handle
                          className="absolute inset-x-0 bottom-0 z-20 h-2 cursor-ns-resize bg-black/15 hover:bg-black/25"
                          onPointerDown={(event) => onPlanResizeStart(event, plan)}
                          aria-label="Redimensionner le créneau"
                        />
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
