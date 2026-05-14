import { describe, it, expect } from 'vitest';
import { TrailModel } from './TrailModel';

const countDirt = (cells: ReadonlyArray<'grass' | 'dirt'>): number =>
  cells.reduce((n, c) => (c === 'dirt' ? n + 1 : n), 0);

describe('TrailModel construction', () => {
  it('initialises all cells to grass', () => {
    const trail = new TrailModel(10);
    expect(trail.length).toBe(10);
    expect(trail.cells).toHaveLength(10);
    expect(trail.cells.every((c) => c === 'grass')).toBe(true);
  });

  it('rejects non-positive cell counts', () => {
    expect(() => new TrailModel(0)).toThrow();
    expect(() => new TrailModel(-1)).toThrow();
  });

  it('rejects non-integer cell counts', () => {
    expect(() => new TrailModel(3.5)).toThrow();
    expect(() => new TrailModel(Number.NaN)).toThrow();
  });
});

describe('TrailModel.stampForward', () => {
  it('stampForward(0) leaves everything as grass', () => {
    const trail = new TrailModel(10);
    trail.stampForward(0);
    expect(countDirt(trail.cells)).toBe(0);
  });

  it('stampForward(1) marks every cell as dirt', () => {
    const trail = new TrailModel(10);
    trail.stampForward(1);
    expect(countDirt(trail.cells)).toBe(10);
    expect(trail.cells.every((c) => c === 'dirt')).toBe(true);
  });

  it('stampForward(0.5) marks the leftmost half as dirt', () => {
    const trail = new TrailModel(10);
    trail.stampForward(0.5);
    expect(trail.cells.slice(0, 5).every((c) => c === 'dirt')).toBe(true);
    expect(trail.cells.slice(5).every((c) => c === 'grass')).toBe(true);
  });

  it('is idempotent — calling twice with the same progress equals once', () => {
    const a = new TrailModel(20);
    const b = new TrailModel(20);
    a.stampForward(0.4);
    b.stampForward(0.4);
    b.stampForward(0.4);
    expect(b.cells).toEqual(a.cells);
  });

  it('is monotonic — a smaller subsequent progress does not erase prior dirt', () => {
    const trail = new TrailModel(10);
    trail.stampForward(0.7);
    const beforeRetreat = [...trail.cells];
    trail.stampForward(0.3);
    expect(trail.cells).toEqual(beforeRetreat);
    expect(countDirt(trail.cells)).toBe(7);
  });

  it('clamps progress below 0 and above 1', () => {
    const low = new TrailModel(10);
    low.stampForward(-5);
    expect(countDirt(low.cells)).toBe(0);

    const high = new TrailModel(10);
    high.stampForward(2);
    expect(countDirt(high.cells)).toBe(10);
  });
});

describe('TrailModel.eraseBackward', () => {
  it('eraseBackward(1) on an all-dirt trail leaves it all dirt', () => {
    const trail = new TrailModel(10);
    trail.stampForward(1);
    trail.eraseBackward(1);
    expect(countDirt(trail.cells)).toBe(10);
  });

  it('eraseBackward(0) reverts every cell to grass', () => {
    const trail = new TrailModel(10);
    trail.stampForward(1);
    trail.eraseBackward(0);
    expect(countDirt(trail.cells)).toBe(0);
  });

  it('eraseBackward(0.4) reverts cells from index 4 onward to grass', () => {
    const trail = new TrailModel(10);
    trail.stampForward(1);
    trail.eraseBackward(0.4);
    expect(trail.cells.slice(0, 4).every((c) => c === 'dirt')).toBe(true);
    expect(trail.cells.slice(4).every((c) => c === 'grass')).toBe(true);
  });

  it('is idempotent — calling twice with the same progress equals once', () => {
    const a = new TrailModel(20);
    const b = new TrailModel(20);
    a.stampForward(1);
    b.stampForward(1);
    a.eraseBackward(0.6);
    b.eraseBackward(0.6);
    b.eraseBackward(0.6);
    expect(b.cells).toEqual(a.cells);
  });

  it('is monotonic across a break — as progress decreases from 1 to 0, dirt count only shrinks', () => {
    const trail = new TrailModel(20);
    trail.stampForward(1);
    let prevDirt = countDirt(trail.cells);
    for (let step = 1; step >= 0; step -= 0.1) {
      trail.eraseBackward(step);
      const dirt = countDirt(trail.cells);
      expect(dirt).toBeLessThanOrEqual(prevDirt);
      prevDirt = dirt;
    }
    expect(prevDirt).toBe(0);
  });

  it('clamps progress below 0 and above 1', () => {
    const low = new TrailModel(10);
    low.stampForward(1);
    low.eraseBackward(-3);
    expect(countDirt(low.cells)).toBe(0);

    const high = new TrailModel(10);
    high.stampForward(1);
    high.eraseBackward(99);
    expect(countDirt(high.cells)).toBe(10);
  });
});

describe('TrailModel work→break cycle', () => {
  it('stampForward across work then eraseBackward across break returns to all-grass', () => {
    const trail = new TrailModel(40);
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      trail.stampForward(i / steps);
    }
    expect(countDirt(trail.cells)).toBe(40);

    for (let i = steps; i >= 0; i--) {
      trail.eraseBackward(i / steps);
    }
    expect(countDirt(trail.cells)).toBe(0);
  });

  it('resetToGrass clears all dirt regardless of prior state', () => {
    const trail = new TrailModel(10);
    trail.stampForward(0.8);
    trail.resetToGrass();
    expect(countDirt(trail.cells)).toBe(0);
  });

  it('resetToDirt fills every cell with dirt', () => {
    const trail = new TrailModel(10);
    trail.resetToDirt();
    expect(countDirt(trail.cells)).toBe(10);
  });
});
