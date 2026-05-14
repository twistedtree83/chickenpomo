import { useEffect, useRef } from 'react';
import { SceneRenderer } from '../render/SceneRenderer';
import type { SceneEffectFlags } from '../render/SceneRenderer';
import type { TimerEngine } from '../engine/TimerEngine';
import type { TrailModel } from '../engine/TrailModel';
import type { ChickenRenderer } from '../render/ChickenRenderer';
import type { ParallaxRenderer } from '../render/ParallaxRenderer';
import type { GroundRenderer } from '../render/GroundRenderer';
import type { AudioChirp } from '../audio/AudioChirp';
import type { Notifier } from '../notify/Notifier';

const LOGICAL_WIDTH = 640;
const LOGICAL_HEIGHT = 360;

export interface SceneProps {
  timer: TimerEngine;
  trail: TrailModel;
  chicken: ChickenRenderer;
  parallax: ParallaxRenderer;
  ground: GroundRenderer;
  chirp: AudioChirp;
  notifier: Notifier;
  // Must be the same clock TimerEngine was constructed with — see App.tsx.
  now: () => number;
  getEffectFlags: () => SceneEffectFlags;
  // Held off the rAF loop until this resolves; until then the canvas stays
  // transparent and the page's sky-coloured backdrop shows through. Prevents a
  // flash of the renderers' fallback rectangles whenever modules get rebuilt
  // (HMR, etc.) and the image loads haven't completed yet.
  assetsReady: Promise<void>;
}

// Cover-mode scale: fill BOTH viewport dimensions (whichever is tighter
// determines content overflow, not bars). Vertical overflow is clipped by
// the parent's overflow:hidden — the canvas is centered, so the trim is
// split between top (sky cloud crowns) and bottom (lower ground tiles).
// Horizontal overflow is clipped similarly when the viewport is portrait.
// Pixels stay crisp via `image-rendering: pixelated`.
function computeScale(viewportW: number, viewportH: number): number {
  return Math.max(1, Math.max(viewportW / LOGICAL_WIDTH, viewportH / LOGICAL_HEIGHT));
}

export function Scene(props: SceneProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const ctx = canvas.getContext('2d');
    if (ctx === null) return;
    const renderer = new SceneRenderer(
      ctx,
      props.timer,
      props.trail,
      props.chicken,
      props.parallax,
      props.ground,
      props.chirp,
      props.notifier,
      { now: props.now, effectFlags: props.getEffectFlags },
    );
    let cancelled = false;
    void props.assetsReady.then(() => {
      if (cancelled) return;
      renderer.start();
    });
    return () => {
      cancelled = true;
      renderer.stop();
    };
  }, [
    props.timer,
    props.trail,
    props.chicken,
    props.parallax,
    props.ground,
    props.chirp,
    props.notifier,
    props.now,
    props.getEffectFlags,
    props.assetsReady,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (canvas === null || container === null) return;
    const applyScale = (): void => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      const scale = computeScale(w, h);
      canvas.style.width = `${LOGICAL_WIDTH * scale}px`;
      canvas.style.height = `${LOGICAL_HEIGHT * scale}px`;
    };
    applyScale();
    const observer = new ResizeObserver(applyScale);
    observer.observe(container);
    window.addEventListener('resize', applyScale);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', applyScale);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 flex items-center justify-center"
    >
      <canvas
        ref={canvasRef}
        width={LOGICAL_WIDTH}
        height={LOGICAL_HEIGHT}
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  );
}
