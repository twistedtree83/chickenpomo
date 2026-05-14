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
import { SettingsModal } from './components/SettingsModal';

interface Modules {
  // Shared clock: TimerEngine.endTime and SceneRenderer's per-frame `now` must
  // come from the same source, otherwise progress stays pinned at 0.
  now: () => number;
  timer: TimerEngine;
  trail: TrailModel;
  settings: SettingsStore;
  chirp: AudioChirp;
  notifier: Notifier;
  chicken: ChickenRenderer;
  parallax: ParallaxRenderer;
  ground: GroundRenderer;
  // Resolves once every sprite/parallax/ground image has loaded (or failed).
  // Scene gates its rAF loop on this so users never see the renderers' fallback
  // rectangles during the load gap — they see the page's sky-coloured backdrop
  // through the transparent canvas instead.
  assetsReady: Promise<void>;
}

// Trail spans the chicken's feet range: (canvasWidth 640 − chickenLeftMargin 32
// − chickenRightMargin 64) / cellWidth 8 = 68. Leading edge sits at the
// chicken's foot center, so trailOffsetX (64) = chickenLeftMargin + sprite
// half-width (32). Must stay aligned with DEFAULT_SCENE_LAYOUT and
// DEFAULT_GROUND_LAYOUT.
const TRAIL_NUM_CELLS = 68;

function buildModules(): Modules {
  const now = (): number => Date.now();
  const timer = new TimerEngine(now);
  const trail = new TrailModel(TRAIL_NUM_CELLS);
  const settings = new SettingsStore(window.localStorage);
  const chirp = new AudioChirp();
  const notifier = new Notifier();
  // BASE_URL ends with '/' and matches `base` in vite.config.ts — required so
  // GitHub Pages can serve assets from /chickenpomo/sprites/* rather than the
  // host root.
  const assetBase = `${import.meta.env.BASE_URL}sprites/`;
  const walkRight = new SpriteSheet(64, 64, 6, '#f1c40f');
  const walkLeft = new SpriteSheet(64, 64, 6, '#f1c40f');
  const idle = new SpriteSheet(64, 64, 6, '#f39c12');
  const chicken = new ChickenRenderer(walkRight, walkLeft, idle);
  const parallax = new ParallaxRenderer();
  const ground = new GroundRenderer();
  const soundBase = `${import.meta.env.BASE_URL}sounds/`;
  const assetsReady = Promise.all([
    walkRight.load(`${assetBase}chicken-walk-right.png`),
    walkLeft.load(`${assetBase}chicken-walk-left.png`),
    idle.load(`${assetBase}chicken-idle.png`),
    parallax.load({
      clouds: `${assetBase}clouds.png`,
      far: `${assetBase}hills-far.png`,
      mid: `${assetBase}mid-trees.png`,
      near: `${assetBase}near-grass.png`,
    }),
    ground.load({
      grass: `${assetBase}ground-grass.png`,
      dirt: `${assetBase}ground-dirt.png`,
    }),
    chirp.load({
      // Disgruntled cluck when the chicken is forced back to work.
      'work-start': `${soundBase}cluck-disgruntled.wav`,
      // Relieved cluck when the chicken gets to rest.
      'break-start': `${soundBase}cluck-relieved.wav`,
    }),
  ]).then(() => undefined);
  return {
    now,
    timer,
    trail,
    settings,
    chirp,
    notifier,
    chicken,
    parallax,
    ground,
    assetsReady,
  };
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
  const [state, setState] = useState<TimerState>(() => modules.timer.read(modules.now()));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const hasRequestedNotificationPermissionRef = useRef(false);

  useEffect(() => {
    return modules.settings.subscribe(setSettings);
  }, [modules]);

  useEffect(() => {
    let handle = 0;
    const loop = (): void => {
      setState(modules.timer.read(modules.now()));
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
    if (!hasRequestedNotificationPermissionRef.current) {
      hasRequestedNotificationPermissionRef.current = true;
      void modules.notifier.requestPermission();
    }
    // Must happen inside this user-gesture stack: creates the AudioContext
    // and resumes it so the cluck on the first phase transition (which fires
    // minutes later, well outside any gesture) actually plays.
    modules.chirp.prime();
    const now = modules.now();
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
    modules.timer.pause(modules.now());
  };

  const handleReset = (): void => {
    modules.timer.reset();
    modules.trail.resetToGrass();
  };

  const handleOpenSettings = (): void => {
    setSettingsOpen(true);
  };

  const handleCloseSettings = (): void => {
    setSettingsOpen(false);
  };

  const handleSettingsChange = (partial: Partial<Settings>): void => {
    modules.settings.set(partial);
  };

  const handleSkip = (): void => {
    modules.timer.skip(modules.now());
  };

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#87ceeb] text-slate-100">
      <Scene
        timer={modules.timer}
        trail={modules.trail}
        chicken={modules.chicken}
        parallax={modules.parallax}
        ground={modules.ground}
        chirp={modules.chirp}
        notifier={modules.notifier}
        now={modules.now}
        getEffectFlags={getEffectFlags}
        assetsReady={modules.assetsReady}
      />
      <div className="pointer-events-none absolute inset-x-0 top-6 flex justify-center">
        <div className="rounded-lg bg-slate-900/60 px-6 py-3 backdrop-blur-sm">
          <TimerOverlay state={state} workMinutes={settings.workMinutes} />
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
        <div className="pointer-events-auto rounded-lg bg-slate-900/60 px-4 py-3 backdrop-blur-sm">
          <Controls
            state={state}
            onStart={handleStart}
            onPause={handlePause}
            onReset={handleReset}
            onOpenSettings={handleOpenSettings}
          />
        </div>
      </div>
      <SettingsModal
        open={settingsOpen}
        settings={settings}
        state={state}
        onClose={handleCloseSettings}
        onChange={handleSettingsChange}
        onSkip={handleSkip}
      />
    </main>
  );
}
