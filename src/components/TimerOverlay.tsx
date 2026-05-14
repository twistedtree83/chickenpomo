import type { TimerState } from '../engine/TimerEngine';

export interface TimerOverlayProps {
  state: TimerState;
  workMinutes: number;
}

function formatRemaining(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function describe(state: TimerState, workMinutes: number): { label: string; time: string } {
  if (state.phase === 'idle') {
    return { label: 'Ready', time: formatRemaining(workMinutes * 60_000) };
  }
  const base = state.phase === 'work' ? 'Work' : 'Break';
  return {
    label: state.isPaused ? `${base} — Paused` : base,
    time: formatRemaining(state.remainingMs),
  };
}

export function TimerOverlay({ state, workMinutes }: TimerOverlayProps): JSX.Element {
  const { label, time } = describe(state, workMinutes);
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="font-pixel text-xs uppercase tracking-[0.3em] text-slate-300">{label}</div>
      <div className="font-pixel text-5xl text-slate-50 tabular-nums">{time}</div>
    </div>
  );
}
