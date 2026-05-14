export type Cell = 'grass' | 'dirt';

export class TrailModel {
  private readonly _cells: Cell[];

  constructor(numCells: number) {
    if (!Number.isInteger(numCells) || numCells <= 0) {
      throw new Error(
        `TrailModel: numCells must be a positive integer, got ${String(numCells)}`,
      );
    }
    this._cells = new Array<Cell>(numCells).fill('grass');
  }

  get cells(): ReadonlyArray<Cell> {
    return this._cells;
  }

  get length(): number {
    return this._cells.length;
  }

  stampForward(progress: number): void {
    const cutoff = this.cellsCovered(progress);
    for (let i = 0; i < cutoff; i++) {
      this._cells[i] = 'dirt';
    }
  }

  eraseBackward(progress: number): void {
    const cutoff = this.cellsCovered(progress);
    for (let i = cutoff; i < this._cells.length; i++) {
      this._cells[i] = 'grass';
    }
  }

  resetToGrass(): void {
    this._cells.fill('grass');
  }

  resetToDirt(): void {
    this._cells.fill('dirt');
  }

  private cellsCovered(progress: number): number {
    const clamped = progress < 0 ? 0 : progress > 1 ? 1 : progress;
    return Math.round(clamped * this._cells.length);
  }
}
