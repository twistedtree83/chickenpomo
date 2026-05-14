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

const LOGICAL_WIDTH = 320;
const LOGICAL_HEIGHT = 180;

export interface SceneProps {
  timer: TimerEngine;
  trail: TrailModel;
  chicken: ChickenRenderer;
  parallax: ParallaxRenderer;
  ground: GroundRenderer;
  chirp: AudioChirp;
  notifier: Notifier;
  getEffectFlags: () => SceneEffectFlags;
}

function computeScale(viewportW: number, viewportH: number): number {
  const sx = Math.floor(viewportW / LOGICAL_WIDTH);
  const sy = Math.floor(viewportH / LOGICAL_HEIGHT);
  return Math.max(1, Math.min(sx, sy));
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
      { effectFlags: props.getEffectFlags },
    );
    renderer.start();
    return () => {
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
    props.getEffectFlags,
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
    <div ref={containerRef} className="flex w-full flex-1 items-center justify-center">
      <canvas
        ref={canvasRef}
        width={LOGICAL_WIDTH}
        height={LOGICAL_HEIGHT}
        className="bg-black"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  );
}
