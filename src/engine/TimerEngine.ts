export type Phase = 'idle' | 'work' | 'break';
export type RunningPhase = 'work' | 'break';

export interface TransitionEvent {
  from: RunningPhase;
  to: RunningPhase;
  at: number;
}

export interface TimerState {
  phase: Phase;
  remainingMs: number;
  progress: number;
  isRunning: boolean;
  isPaused: boolean;
}

export type NowFn = () => number;

export class TimerEngine {
  private readonly now: NowFn;
  private phase: Phase = 'idle';
  private workMs = 0;
  private breakMs = 0;
  private endTime: number | null = null;
  private pausedRemainingMs: number | null = null;

  constructor(now: NowFn) {
    this.now = now;
  }

  start(workMs: number, breakMs: number): void {
    if (!Number.isFinite(workMs) || workMs <= 0) {
      throw new RangeError('TimerEngine.start: workMs must be a positive finite number');
    }
    if (!Number.isFinite(breakMs) || breakMs <= 0) {
      throw new RangeError('TimerEngine.start: breakMs must be a positive finite number');
    }
    this.workMs = workMs;
    this.breakMs = breakMs;
    this.phase = 'work';
    this.endTime = this.now() + workMs;
    this.pausedRemainingMs = null;
  }

  pause(now: number): void {
    if (this.phase === 'idle') return;
    if (this.pausedRemainingMs !== null) return;
    if (this.endTime === null) return;
    this.pausedRemainingMs = Math.max(0, this.endTime - now);
    this.endTime = null;
  }

  resume(now: number): void {
    if (this.phase === 'idle') return;
    if (this.pausedRemainingMs === null) return;
    this.endTime = now + this.pausedRemainingMs;
    this.pausedRemainingMs = null;
  }

  reset(): void {
    this.phase = 'idle';
    this.workMs = 0;
    this.breakMs = 0;
    this.endTime = null;
    this.pausedRemainingMs = null;
  }

  read(now: number): TimerState {
    if (this.phase === 'idle') {
      return { phase: 'idle', remainingMs: 0, progress: 0, isRunning: false, isPaused: false };
    }
    const total = this.phase === 'work' ? this.workMs : this.breakMs;
    let remainingMs: number;
    if (this.pausedRemainingMs !== null) {
      remainingMs = this.pausedRemainingMs;
    } else if (this.endTime !== null) {
      remainingMs = Math.max(0, this.endTime - now);
    } else {
      remainingMs = 0;
    }
    const clampedRemaining = Math.min(total, Math.max(0, remainingMs));
    const elapsed = total - clampedRemaining;
    const progress = total > 0 ? elapsed / total : 0;
    return {
      phase: this.phase,
      remainingMs,
      progress,
      isRunning: this.pausedRemainingMs === null,
      isPaused: this.pausedRemainingMs !== null,
    };
  }

  tick(now: number): TransitionEvent | null {
    if (this.phase === 'idle') return null;
    if (this.pausedRemainingMs !== null) return null;
    if (this.endTime === null) return null;
    let lastEvent: TransitionEvent | null = null;
    let guard = 0;
    for (;;) {
      const currentEnd: number | null = this.endTime;
      if (currentEnd === null || now < currentEnd) break;
      const from: RunningPhase = this.phase === 'work' ? 'work' : 'break';
      const to: RunningPhase = from === 'work' ? 'break' : 'work';
      const nextDuration = to === 'work' ? this.workMs : this.breakMs;
      this.phase = to;
      this.endTime = currentEnd + nextDuration;
      lastEvent = { from, to, at: currentEnd };
      guard += 1;
      if (guard > 100000) {
        throw new Error('TimerEngine.tick: runaway transition loop');
      }
    }
    return lastEvent;
  }
}
