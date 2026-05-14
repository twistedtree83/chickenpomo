import { describe, it, expect } from 'vitest';
import { TimerEngine } from './TimerEngine';

function makeClock(initial = 1_000_000): { now: () => number; advance: (ms: number) => void; set: (t: number) => void } {
  let t = initial;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
    set: (n: number) => {
      t = n;
    },
  };
}

const WORK = 25 * 60 * 1000;
const BREAK = 5 * 60 * 1000;

describe('TimerEngine', () => {
  describe('initial state', () => {
    it('is idle with zero remaining and progress', () => {
      const clock = makeClock();
      const engine = new TimerEngine(clock.now);
      const state = engine.read(clock.now());
      expect(state.phase).toBe('idle');
      expect(state.remainingMs).toBe(0);
      expect(state.progress).toBe(0);
      expect(state.isRunning).toBe(false);
      expect(state.isPaused).toBe(false);
    });

    it('tick on idle returns null', () => {
      const clock = makeClock();
      const engine = new TimerEngine(clock.now);
      expect(engine.tick(clock.now())).toBeNull();
    });
  });

  describe('start', () => {
    it('transitions idle → work with full remaining time', () => {
      const clock = makeClock();
      const engine = new TimerEngine(clock.now);
      engine.start(WORK, BREAK);
      const state = engine.read(clock.now());
      expect(state.phase).toBe('work');
      expect(state.remainingMs).toBe(WORK);
      expect(state.progress).toBe(0);
      expect(state.isRunning).toBe(true);
      expect(state.isPaused).toBe(false);
    });

    it('rejects non-positive durations', () => {
      const clock = makeClock();
      const engine = new TimerEngine(clock.now);
      expect(() => engine.start(0, BREAK)).toThrow(RangeError);
      expect(() => engine.start(WORK, 0)).toThrow(RangeError);
      expect(() => engine.start(-1, BREAK)).toThrow(RangeError);
      expect(() => engine.start(WORK, Number.POSITIVE_INFINITY)).toThrow(RangeError);
      expect(() => engine.start(Number.NaN, BREAK)).toThrow(RangeError);
    });

    it('progress advances linearly during work', () => {
      const clock = makeClock();
      const engine = new TimerEngine(clock.now);
      engine.start(WORK, BREAK);
      clock.advance(WORK / 4);
      const state = engine.read(clock.now());
      expect(state.remainingMs).toBe((WORK * 3) / 4);
      expect(state.progress).toBeCloseTo(0.25, 10);
    });
  });

  describe('tick / phase transitions', () => {
    it('returns null before endTime', () => {
      const clock = makeClock();
      const engine = new TimerEngine(clock.now);
      engine.start(WORK, BREAK);
      clock.advance(WORK - 1);
      expect(engine.tick(clock.now())).toBeNull();
      expect(engine.read(clock.now()).phase).toBe('work');
    });

    it('emits work→break exactly at work endTime and switches to break', () => {
      const clock = makeClock();
      const engine = new TimerEngine(clock.now);
      const startedAt = clock.now();
      engine.start(WORK, BREAK);
      clock.advance(WORK);
      const event = engine.tick(clock.now());
      expect(event).toEqual({ from: 'work', to: 'break', at: startedAt + WORK });
      const state = engine.read(clock.now());
      expect(state.phase).toBe('break');
      expect(state.remainingMs).toBe(BREAK);
      expect(state.progress).toBe(0);
    });

    it('emits break→work after break endTime and resets break progress', () => {
      const clock = makeClock();
      const engine = new TimerEngine(clock.now);
      const startedAt = clock.now();
      engine.start(WORK, BREAK);
      clock.advance(WORK);
      engine.tick(clock.now());
      clock.advance(BREAK);
      const event = engine.tick(clock.now());
      expect(event).toEqual({ from: 'break', to: 'work', at: startedAt + WORK + BREAK });
      const state = engine.read(clock.now());
      expect(state.phase).toBe('work');
      expect(state.remainingMs).toBe(WORK);
    });

    it('does not emit a transition while still inside a phase', () => {
      const clock = makeClock();
      const engine = new TimerEngine(clock.now);
      engine.start(WORK, BREAK);
      clock.advance(WORK - 1);
      expect(engine.tick(clock.now())).toBeNull();
      clock.advance(1);
      expect(engine.tick(clock.now())).not.toBeNull();
    });

    it('reports clamped remainingMs=0 between endTime and next tick', () => {
      const clock = makeClock();
      const engine = new TimerEngine(clock.now);
      engine.start(WORK, BREAK);
      clock.advance(WORK + 1234);
      // Caller reads before tick: state still reports work but remaining clamps to 0.
      const pre = engine.read(clock.now());
      expect(pre.phase).toBe('work');
      expect(pre.remainingMs).toBe(0);
      expect(pre.progress).toBe(1);
    });
  });

  describe('backgrounded tab (wall-clock skip)', () => {
    it('skips a work session entirely if tab is backgrounded past work endTime', () => {
      const clock = makeClock();
      const engine = new TimerEngine(clock.now);
      const startedAt = clock.now();
      engine.start(WORK, BREAK);
      // Tab away for the entire work phase + a little of break.
      clock.advance(WORK + BREAK / 2);
      const event = engine.tick(clock.now());
      expect(event).toEqual({ from: 'work', to: 'break', at: startedAt + WORK });
      const state = engine.read(clock.now());
      expect(state.phase).toBe('break');
      expect(state.remainingMs).toBe(BREAK / 2);
      expect(state.progress).toBeCloseTo(0.5, 10);
    });

    it('skips multiple phases and reports only the final transition', () => {
      const clock = makeClock();
      const engine = new TimerEngine(clock.now);
      const startedAt = clock.now();
      engine.start(WORK, BREAK);
      // 30 minutes in: work (25m) ended, break (5m) ended, back to work fresh.
      clock.advance(30 * 60 * 1000);
      const event = engine.tick(clock.now());
      expect(event).toEqual({ from: 'break', to: 'work', at: startedAt + WORK + BREAK });
      const state = engine.read(clock.now());
      expect(state.phase).toBe('work');
      expect(state.remainingMs).toBe(WORK);
      expect(state.progress).toBe(0);
    });

    it('handles arbitrarily long sleep across many cycles', () => {
      const clock = makeClock();
      const engine = new TimerEngine(clock.now);
      engine.start(WORK, BREAK);
      // 10 full cycles + halfway through an 11th work session.
      const cycle = WORK + BREAK;
      clock.advance(10 * cycle + WORK / 2);
      const event = engine.tick(clock.now());
      expect(event).not.toBeNull();
      expect(event?.to).toBe('work');
      const state = engine.read(clock.now());
      expect(state.phase).toBe('work');
      expect(state.remainingMs).toBe(WORK / 2);
    });
  });

  describe('pause / resume', () => {
    it('pause freezes remaining time and marks paused', () => {
      const clock = makeClock();
      const engine = new TimerEngine(clock.now);
      engine.start(WORK, BREAK);
      clock.advance(WORK / 3);
      engine.pause(clock.now());
      const expectedRemaining = WORK - WORK / 3;
      // Time passes while paused — read should still report the frozen remaining.
      clock.advance(60_000);
      const state = engine.read(clock.now());
      expect(state.isPaused).toBe(true);
      expect(state.isRunning).toBe(false);
      expect(state.remainingMs).toBe(expectedRemaining);
      expect(state.phase).toBe('work');
    });

    it('tick while paused returns null even if wall-clock would have advanced phase', () => {
      const clock = makeClock();
      const engine = new TimerEngine(clock.now);
      engine.start(WORK, BREAK);
      clock.advance(WORK / 2);
      engine.pause(clock.now());
      clock.advance(WORK * 5);
      expect(engine.tick(clock.now())).toBeNull();
      expect(engine.read(clock.now()).phase).toBe('work');
    });

    it('resume restores the frozen remaining and continues the countdown', () => {
      const clock = makeClock();
      const engine = new TimerEngine(clock.now);
      engine.start(WORK, BREAK);
      clock.advance(WORK / 3);
      engine.pause(clock.now());
      const remainingAtPause = WORK - WORK / 3;
      clock.advance(10 * 60 * 1000);
      engine.resume(clock.now());
      const afterResume = engine.read(clock.now());
      expect(afterResume.isPaused).toBe(false);
      expect(afterResume.isRunning).toBe(true);
      expect(afterResume.remainingMs).toBe(remainingAtPause);

      clock.advance(remainingAtPause);
      const event = engine.tick(clock.now());
      expect(event?.from).toBe('work');
      expect(event?.to).toBe('break');
    });

    it('double pause is a no-op (does not refreeze remaining)', () => {
      const clock = makeClock();
      const engine = new TimerEngine(clock.now);
      engine.start(WORK, BREAK);
      clock.advance(WORK / 4);
      engine.pause(clock.now());
      const frozen = engine.read(clock.now()).remainingMs;
      clock.advance(60_000);
      engine.pause(clock.now());
      expect(engine.read(clock.now()).remainingMs).toBe(frozen);
    });

    it('resume without pause is a no-op', () => {
      const clock = makeClock();
      const engine = new TimerEngine(clock.now);
      engine.start(WORK, BREAK);
      const before = engine.read(clock.now());
      engine.resume(clock.now());
      const after = engine.read(clock.now());
      expect(after).toEqual(before);
    });

    it('pause while idle is a no-op', () => {
      const clock = makeClock();
      const engine = new TimerEngine(clock.now);
      engine.pause(clock.now());
      expect(engine.read(clock.now()).phase).toBe('idle');
      expect(engine.read(clock.now()).isPaused).toBe(false);
    });
  });

  describe('reset', () => {
    it('returns to idle from any running phase', () => {
      const clock = makeClock();
      const engine = new TimerEngine(clock.now);
      engine.start(WORK, BREAK);
      clock.advance(WORK / 2);
      engine.reset();
      const state = engine.read(clock.now());
      expect(state.phase).toBe('idle');
      expect(state.remainingMs).toBe(0);
      expect(state.progress).toBe(0);
      expect(state.isRunning).toBe(false);
      expect(state.isPaused).toBe(false);
    });

    it('returns to idle from paused state', () => {
      const clock = makeClock();
      const engine = new TimerEngine(clock.now);
      engine.start(WORK, BREAK);
      clock.advance(WORK / 4);
      engine.pause(clock.now());
      engine.reset();
      expect(engine.read(clock.now()).phase).toBe('idle');
    });

    it('tick after reset returns null', () => {
      const clock = makeClock();
      const engine = new TimerEngine(clock.now);
      engine.start(WORK, BREAK);
      clock.advance(WORK + 1);
      engine.reset();
      expect(engine.tick(clock.now())).toBeNull();
    });
  });

  describe('restart', () => {
    it('start while running discards prior phase and begins a fresh work session', () => {
      const clock = makeClock();
      const engine = new TimerEngine(clock.now);
      engine.start(WORK, BREAK);
      clock.advance(WORK / 2);
      engine.start(WORK, BREAK);
      const state = engine.read(clock.now());
      expect(state.phase).toBe('work');
      expect(state.remainingMs).toBe(WORK);
      expect(state.progress).toBe(0);
    });
  });
});
