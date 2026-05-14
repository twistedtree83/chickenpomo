import { useEffect, useState } from 'react';
import type { Settings } from '../store/SettingsStore';
import type { TimerState } from '../engine/TimerEngine';

export const WORK_MIN_MINUTES = 5;
export const WORK_MAX_MINUTES = 60;
export const BREAK_MIN_MINUTES = 1;
export const BREAK_MAX_MINUTES = 30;

export interface SettingsModalProps {
  open: boolean;
  settings: Settings;
  state: TimerState;
  onClose(): void;
  onChange(partial: Partial<Settings>): void;
  onSkip(): void;
}

interface DraftDurations {
  workMinutes: string;
  breakMinutes: string;
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  const rounded = Math.round(value);
  if (rounded < min) return min;
  if (rounded > max) return max;
  return rounded;
}

function isValidDuration(raw: string, min: number, max: number): boolean {
  if (raw.trim() === '') return false;
  const n = Number(raw);
  if (!Number.isFinite(n)) return false;
  if (Math.round(n) !== n) return false;
  return n >= min && n <= max;
}

export function SettingsModal({
  open,
  settings,
  state,
  onClose,
  onChange,
  onSkip,
}: SettingsModalProps): JSX.Element | null {
  const [draft, setDraft] = useState<DraftDurations>({
    workMinutes: String(settings.workMinutes),
    breakMinutes: String(settings.breakMinutes),
  });

  useEffect(() => {
    if (open) {
      setDraft({
        workMinutes: String(settings.workMinutes),
        breakMinutes: String(settings.breakMinutes),
      });
    }
  }, [open, settings.workMinutes, settings.breakMinutes]);

  if (!open) return null;

  const workValid = isValidDuration(draft.workMinutes, WORK_MIN_MINUTES, WORK_MAX_MINUTES);
  const breakValid = isValidDuration(draft.breakMinutes, BREAK_MIN_MINUTES, BREAK_MAX_MINUTES);

  const commitWork = (): void => {
    if (workValid) {
      onChange({ workMinutes: clampInt(Number(draft.workMinutes), WORK_MIN_MINUTES, WORK_MAX_MINUTES) });
    } else {
      setDraft((d) => ({ ...d, workMinutes: String(settings.workMinutes) }));
    }
  };

  const commitBreak = (): void => {
    if (breakValid) {
      onChange({
        breakMinutes: clampInt(Number(draft.breakMinutes), BREAK_MIN_MINUTES, BREAK_MAX_MINUTES),
      });
    } else {
      setDraft((d) => ({ ...d, breakMinutes: String(settings.breakMinutes) }));
    }
  };

  const skipDisabled =
    !settings.skipEnabled || state.phase === 'idle' || state.isPaused;

  const handleSkipClick = (): void => {
    if (skipDisabled) return;
    onSkip();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border-2 border-slate-300 bg-slate-800 p-6 text-slate-100 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-4 flex items-center justify-between">
          <h2 className="font-pixel text-sm uppercase">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="rounded border-2 border-slate-300 px-2 py-1 text-xs hover:bg-slate-700"
          >
            ×
          </button>
        </header>

        <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-slate-300">
              Work minutes ({WORK_MIN_MINUTES}–{WORK_MAX_MINUTES})
            </span>
            <input
              type="number"
              min={WORK_MIN_MINUTES}
              max={WORK_MAX_MINUTES}
              step={1}
              value={draft.workMinutes}
              onChange={(e) => setDraft((d) => ({ ...d, workMinutes: e.target.value }))}
              onBlur={commitWork}
              aria-invalid={!workValid}
              aria-label="Work duration in minutes"
              className={`rounded border-2 bg-slate-900 px-3 py-2 text-slate-100 ${
                workValid ? 'border-slate-500' : 'border-amber-400'
              }`}
            />
            {!workValid && (
              <span className="text-xs text-amber-300">
                Enter a whole number between {WORK_MIN_MINUTES} and {WORK_MAX_MINUTES}.
              </span>
            )}
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-slate-300">
              Break minutes ({BREAK_MIN_MINUTES}–{BREAK_MAX_MINUTES})
            </span>
            <input
              type="number"
              min={BREAK_MIN_MINUTES}
              max={BREAK_MAX_MINUTES}
              step={1}
              value={draft.breakMinutes}
              onChange={(e) => setDraft((d) => ({ ...d, breakMinutes: e.target.value }))}
              onBlur={commitBreak}
              aria-invalid={!breakValid}
              aria-label="Break duration in minutes"
              className={`rounded border-2 bg-slate-900 px-3 py-2 text-slate-100 ${
                breakValid ? 'border-slate-500' : 'border-amber-400'
              }`}
            />
            {!breakValid && (
              <span className="text-xs text-amber-300">
                Enter a whole number between {BREAK_MIN_MINUTES} and {BREAK_MAX_MINUTES}.
              </span>
            )}
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.soundEnabled}
              onChange={(e) => onChange({ soundEnabled: e.target.checked })}
              className="h-4 w-4"
            />
            <span className="text-sm">Play chirp on phase transition</span>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.notificationsEnabled}
              onChange={(e) => onChange({ notificationsEnabled: e.target.checked })}
              className="h-4 w-4"
            />
            <span className="text-sm">Show browser notifications</span>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.skipEnabled}
              onChange={(e) => onChange({ skipEnabled: e.target.checked })}
              className="h-4 w-4"
            />
            <span className="text-sm">Enable the Skip button below</span>
          </label>
        </form>

        <div className="mt-6 border-t border-slate-700 pt-4">
          <button
            type="button"
            onClick={handleSkipClick}
            disabled={skipDisabled}
            className="font-pixel w-full rounded border-2 border-slate-300 bg-slate-700 px-3 py-2 text-xs uppercase text-slate-100 hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Skip current phase
          </button>
          {!settings.skipEnabled && (
            <p className="mt-2 text-xs text-slate-400">
              Toggle “Enable the Skip button” above to use this control.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
