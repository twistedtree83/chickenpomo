import { useEffect, useMemo, useRef, useState } from 'react';
import { TimerEngine } from './engine/TimerEngine';
import type { TimerState } from './engine/TimerEngine';
import { TrailModel } from './engine/TrailModel';
import { SettingsStore } from './store/SettingsStore';
import type { Settings } from './store/SettingsStore';
import { AudioChirp } from './audio/AudioChirp';
import { Notifier } from './notify/Notifier';
import { SpriteSheet } from './render/SpriteSheet';
import { ChickenRenderer } from './render/ChickenRenderer';
import { ParallaxRenderer } from './render/ParallaxRenderer';
import { GroundRenderer } from './render/GroundRenderer';
import type { SceneEffectFlags } from './render/SceneRenderer';
import { Scene } from './components/Scene';
import { Controls } from './components/Controls';
import { TimerOverlay } from './components/TimerOverlay';

interface Modules {
  timer: TimerEngine;
  trail: TrailModel;
  settings: SettingsStore;
  chirp: AudioChirp;
  notifier: Notifier;
  chicken: ChickenRenderer;
  parallax: ParallaxRenderer;
  ground: GroundRenderer;
}

// (canvasWidth 320 − chickenLeftMargin 16 − chickenRightMargin 64) / cellWidth 4 = 60.
// Must stay aligned with DEFAULT_SCENE_LAYOUT and DEFAULT_GROUND_LAYOUT.
const TRAIL_NUM_CELLS = 60;

function buildModules(): Modules {
  const timer = new TimerEngine(() => Date.now());
  const trail = new TrailModel(TRAIL_NUM_CELLS);
  const settings = new SettingsStore(window.localStorage);
  const chirp = new AudioChirp();
  const notifier = new Notifier();
  const walkRight = new SpriteSheet(48, 48, 6, '#f1c40f');
  const walkLeft = new SpriteSheet(48, 48, 6, '#f1c40f');
  const idle = new SpriteSheet(48, 48, 2, '#f39c12');
  void walkRight.load('/sprites/chicken-walk-right.png');
  void walkLeft.load('/sprites/chicken-walk-left.png');
  void idle.load('/sprites/chicken-idle.png');
  const chicken = new ChickenRenderer(walkRight, walkLeft, idle);
  const parallax = new ParallaxRenderer();
  void parallax.load({
    clouds: '/sprites/clouds.png',
    far: '/sprites/hills-far.png',
    mid: '/sprites/mid-trees.png',
    near: '/sprites/near-grass.png',
  });
  const ground = new GroundRenderer();
  void ground.load({
    grass: '/sprites/ground-grass.png',
    dirt: '/sprites/ground-dirt.png',
  });
  return { timer, trail, settings, chirp, notifier, chicken, parallax, ground };
}

function useStableModules(): Modules {
  const ref = useRef<Modules | null>(null);
  if (ref.current === null) {
    ref.current = buildModules();
  }
  return ref.current;
}

export function App(): JSX.Element {
  const modules = useStableModules();
  const [settings, setSettings] = useState<Settings>(() => modules.settings.get());
  const [state, setState] = useState<TimerState>(() => modules.timer.read(Date.now()));
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    return modules.settings.subscribe(setSettings);
  }, [modules]);

  useEffect(() => {
    let handle = 0;
    const loop = (): void => {
      setState(modules.timer.read(Date.now()));
      handle = window.requestAnimationFrame(loop);
    };
    handle = window.requestAnimationFrame(loop);
    return () => {
      window.cancelAnimationFrame(handle);
    };
  }, [modules]);

  const getEffectFlags = useMemo<() => SceneEffectFlags>(
    () => () => ({
      soundEnabled: settingsRef.current.soundEnabled,
      notificationsEnabled: settingsRef.current.notificationsEnabled,
    }),
    [],
  );

  const handleStart = (): void => {
    const now = Date.now();
    const current = modules.timer.read(now);
    if (current.isPaused) {
      modules.timer.resume(now);
      return;
    }
    if (current.phase === 'idle') {
      const snapshot = modules.settings.get();
      modules.trail.resetToGrass();
      modules.timer.start(snapshot.workMinutes * 60_000, snapshot.breakMinutes * 60_000);
    }
  };

  const handlePause = (): void => {
    modules.timer.pause(Date.now());
  };

  const handleReset = (): void => {
    modules.timer.reset();
    modules.trail.resetToGrass();
  };

  const handleOpenSettings = (): void => {
    // SettingsModal wiring lives in T-12.
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-between gap-6 bg-slate-900 p-6 text-slate-100">
      <TimerOverlay state={state} workMinutes={settings.workMinutes} />
      <Scene
        timer={modules.timer}
        trail={modules.trail}
        chicken={modules.chicken}
        parallax={modules.parallax}
        ground={modules.ground}
        chirp={modules.chirp}
        notifier={modules.notifier}
        getEffectFlags={getEffectFlags}
      />
      <Controls
        state={state}
        onStart={handleStart}
        onPause={handlePause}
        onReset={handleReset}
        onOpenSettings={handleOpenSettings}
      />
    </main>
  );
}
