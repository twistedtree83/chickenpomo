import type { TimerEngine, TransitionEvent, Phase } from '../engine/TimerEngine';
import type { TrailModel } from '../engine/TrailModel';
import type { ChickenRenderer, ChickenDirection } from './ChickenRenderer';
import type { ParallaxRenderer } from './ParallaxRenderer';
import type { GroundRenderer } from './GroundRenderer';
import type { AudioChirp } from '../audio/AudioChirp';
import type { Notifier } from '../notify/Notifier';

export type NowFn = () => number;

export interface SceneLayout {
  canvasWidth: number;
  canvasHeight: number;
  chickenLeftMargin: number;
  chickenRightMargin: number;
  chickenY: number;
}

export const DEFAULT_SCENE_LAYOUT: SceneLayout = {
  canvasWidth: 320,
  canvasHeight: 180,
  chickenLeftMargin: 16,
  chickenRightMargin: 64,
  chickenY: 122,
};

export interface SceneEffectFlags {
  soundEnabled: boolean;
  notificationsEnabled: boolean;
}

export type EffectFlagsProvider = () => SceneEffectFlags;

const defaultEffectFlags: EffectFlagsProvider = () => ({
  soundEnabled: true,
  notificationsEnabled: true,
});

export interface RafScheduler {
  request(cb: (now: number) => void): number;
  cancel(handle: number): void;
}

const defaultRafScheduler: RafScheduler = {
  request(cb) {
    return globalThis.requestAnimationFrame(cb);
  },
  cancel(handle) {
    globalThis.cancelAnimationFrame(handle);
  },
};

const defaultNow: NowFn = () =>
  typeof performance !== 'undefined' ? performance.now() : Date.now();

export interface SceneRendererOptions {
  layout?: SceneLayout;
  now?: NowFn;
  rafScheduler?: RafScheduler;
  effectFlags?: EffectFlagsProvider;
}

export class SceneRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly timer: TimerEngine;
  private readonly trail: TrailModel;
  private readonly chicken: ChickenRenderer;
  private readonly parallax: ParallaxRenderer;
  private readonly ground: GroundRenderer;
  private readonly chirp: AudioChirp;
  private readonly notifier: Notifier;
  private readonly layout: SceneLayout;
  private readonly now: NowFn;
  private readonly raf: RafScheduler;
  private readonly getEffects: EffectFlagsProvider;
  private rafHandle: number | null = null;

  constructor(
    ctx: CanvasRenderingContext2D,
    timer: TimerEngine,
    trail: TrailModel,
    chicken: ChickenRenderer,
    parallax: ParallaxRenderer,
    ground: GroundRenderer,
    chirp: AudioChirp,
    notifier: Notifier,
    options: SceneRendererOptions = {},
  ) {
    this.ctx = ctx;
    this.timer = timer;
    this.trail = trail;
    this.chicken = chicken;
    this.parallax = parallax;
    this.ground = ground;
    this.chirp = chirp;
    this.notifier = notifier;
    this.layout = options.layout ?? DEFAULT_SCENE_LAYOUT;
    this.now = options.now ?? defaultNow;
    this.raf = options.rafScheduler ?? defaultRafScheduler;
    this.getEffects = options.effectFlags ?? defaultEffectFlags;
    this.ctx.imageSmoothingEnabled = false;
  }

  start(): void {
    if (this.rafHandle !== null) return;
    const loop = (): void => {
      this.frame();
      this.rafHandle = this.raf.request(loop);
    };
    this.rafHandle = this.raf.request(loop);
  }

  stop(): void {
    if (this.rafHandle === null) return;
    this.raf.cancel(this.rafHandle);
    this.rafHandle = null;
  }

  frame(): void {
    const now = this.now();
    const transition = this.timer.tick(now);
    if (transition !== null) this.handleTransition(transition);
    const state = this.timer.read(now);
    this.updateTrail(state.phase, state.progress);
    this.composeFrame(state.phase, state.progress, state.isPaused, now);
  }

  private handleTransition(event: TransitionEvent): void {
    const effects = this.getEffects();
    if (event.to === 'work') {
      this.trail.resetToGrass();
      if (effects.soundEnabled) this.chirp.play('work-start');
      if (effects.notificationsEnabled) {
        this.notifier.notify('Chicken Pomodoro', 'Back to work.');
      }
    } else {
      this.trail.resetToDirt();
      if (effects.soundEnabled) this.chirp.play('break-start');
      if (effects.notificationsEnabled) {
        this.notifier.notify('Chicken Pomodoro', 'Time for a break.');
      }
    }
  }

  private updateTrail(phase: Phase, progress: number): void {
    if (phase === 'work') {
      this.trail.stampForward(progress);
    } else if (phase === 'break') {
      this.trail.eraseBackward(1 - progress);
    }
  }

  private composeFrame(
    phase: Phase,
    progress: number,
    isPaused: boolean,
    wallClockMs: number,
  ): void {
    const { canvasWidth, chickenLeftMargin, chickenRightMargin, chickenY } = this.layout;
    const range = canvasWidth - chickenLeftMargin - chickenRightMargin;

    let chickenX = chickenLeftMargin;
    let direction: ChickenDirection = 'right';
    let visualProgress = 0;
    if (phase === 'work') {
      chickenX = chickenLeftMargin + progress * range;
      direction = 'right';
      visualProgress = progress;
    } else if (phase === 'break') {
      chickenX = chickenLeftMargin + (1 - progress) * range;
      direction = 'left';
      visualProgress = 1 - progress;
    }

    this.parallax.draw(this.ctx, visualProgress, wallClockMs);
    this.ground.draw(this.ctx, this.trail.cells);
    this.chicken.draw(this.ctx, chickenX, chickenY, direction, isPaused);
  }
}
