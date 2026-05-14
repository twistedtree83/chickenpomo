import type { TimerState } from '../engine/TimerEngine';

export interface ControlsProps {
  state: TimerState;
  onStart(): void;
  onPause(): void;
  onReset(): void;
  onOpenSettings(): void;
}

const buttonClasses =
  'font-pixel text-xs uppercase rounded-md border-2 border-slate-300 bg-slate-700 px-4 py-3 text-slate-100 transition-colors hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed';

export function Controls({
  state,
  onStart,
  onPause,
  onReset,
  onOpenSettings,
}: ControlsProps): JSX.Element {
  const isIdle = state.phase === 'idle';
  const canStart = isIdle || state.isPaused;
  const canPause = !isIdle && !state.isPaused;
  const canReset = !isIdle;
  return (
    <div className="flex items-center gap-3">
      <button type="button" className={buttonClasses} onClick={onStart} disabled={!canStart}>
        {state.isPaused ? 'Resume' : 'Start'}
      </button>
      <button type="button" className={buttonClasses} onClick={onPause} disabled={!canPause}>
        Pause
      </button>
      <button type="button" className={buttonClasses} onClick={onReset} disabled={!canReset}>
        Reset
      </button>
      <button
        type="button"
        className={buttonClasses}
        onClick={onOpenSettings}
        aria-label="Open settings"
      >
        Settings
      </button>
    </div>
  );
}
