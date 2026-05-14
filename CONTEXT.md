# CONTEXT — Chicken Pomodoro

This file is the single source of truth for **architecture decisions** and **module naming**. PRD.md owns the *what* (product requirements, user stories, out-of-scope). CONTEXT.md owns the *how* (architectural commitments and the load-bearing names every iteration must use verbatim).

When CONTEXT.md and PRD.md disagree on naming, CONTEXT.md wins. When they disagree on a product decision, PRD.md wins and CONTEXT.md is wrong and must be updated.

---

## The one rule that explains the rest

> **Wall-clock state lives in `TimerEngine`. The view layer (canvas, React) is a pure function of state at the current `now`.**

Every other rule below is downstream of this. The `requestAnimationFrame` loop never owns timing — it only asks `TimerEngine` what's true *now* and draws accordingly. This is what lets the timer survive a backgrounded browser tab: when the tab wakes up after 30 minutes of being throttled, the next `tick(now)` call resolves the correct phase from the wall-clock delta, regardless of how many frames the browser skipped.

If you find yourself reaching for `setTimeout` or `setInterval` inside `TimerEngine`, stop. You are about to break the contract.

---

## Module vocabulary (use these names verbatim)

These names appear in code, tests, commits, and prd.json descriptions. Do not invent synonyms (`Clock`, `CountdownService`, `PomodoroTimer` — all wrong).

### Deep modules (pure logic, no DOM, fully testable)
- **`TimerEngine`** — state machine over `phase: 'idle' | 'work' | 'break'`, `endTime`, `pausedRemainingMs`. Methods: `start(workMs, breakMs)`, `pause(now)`, `resume(now)`, `reset()`, `read(now)`, `tick(now)`. `tick` returns a `TransitionEvent | null`; the renderer is responsible for reacting to transitions (chirp, notify, flip chicken direction, clear/restamp trail).
- **`TrailModel`** — array of `'grass' | 'dirt'` cells across the chicken's horizontal range. Methods: `stampForward(progressX)`, `eraseBackward(progressX)`, `cells` readonly accessor. No coupling to canvas units — cell index ↔ pixel x is done by the renderer.
- **`SettingsStore`** — typed `localStorage` wrapper, versioned key `pomodoro.settings.v1`. Methods: `get()`, `set(partial)`, `subscribe(fn)`, `reset()`. Takes a storage adapter so tests can inject a fake.

### Browser-API wrappers (thin)
- **`AudioChirp`** — `play(kind: 'work-start' | 'break-start')`. Lazy `AudioContext` on first user gesture. Square-wave + attack-decay envelope. Different pitch per kind.
- **`Notifier`** — `requestPermission()` (idempotent), `notify(title, body)`. Only fires when `document.hidden === true`.

### Rendering modules (canvas-bound)
- **`SpriteSheet`** — `load(url)`, `drawFrame(ctx, frameIndex, x, y)`.
- **`ChickenRenderer`** — owns walk-cycle frame advance (fixed fps, derived from elapsed). `draw(ctx, x, y, direction, isPaused)`. Switches sheet by direction; idle sheet when paused.
- **`ParallaxRenderer`** — given `progress` (0..1) and `wallClockMs`, draws L0–L3. Clouds drift by time; far/mid/near scroll by `progress × {0.08, 0.18, 0.35}`.
- **`GroundRenderer`** — tiles grass; stamps dirt per `TrailModel.cells`.
- **`SceneRenderer`** — orchestrator. Per rAF tick: `TimerEngine.tick(now)` → handle transition event → update `TrailModel` → compose frame (parallax → ground → trail → chicken → text overlay).

### React surface
- **`App`** — owns the long-lived module instances and current settings snapshot.
- **`Scene`** — mounts the `<canvas>` and runs the rAF loop.
- **`Controls`** — Start / Pause / Reset / ⚙ Settings. Disabled states reflect `TimerEngine` state.
- **`TimerOverlay`** — DOM-rendered `mm:ss` + phase label positioned above the canvas. (DOM, not canvas text — sharper and easier to update.)
- **`SettingsModal`** — form bound to `SettingsStore`, with min/max validation; hosts the Skip button.

---

## Hard architectural rules

1. **`TimerEngine` knows nothing about the DOM, canvas, React, audio, or notifications.** It returns a `TransitionEvent` from `tick`; the *caller* decides what to do with it.
2. **Deep modules accept `now` as a parameter or constructor-injected function.** They never call `Date.now()` directly. This is what makes tests deterministic without a fake-timer library.
3. **`SettingsStore` accepts a storage adapter.** Tests inject `{ getItem, setItem, removeItem }`; the production wiring passes `window.localStorage`. The module itself doesn't reach for the global.
4. **Renderers are stateless beyond cached image handles.** The model state (timer phase, trail cells, progress) is owned by the deep modules; renderers read it each frame.
5. **The trail mechanic uses two flat tiles** (`ground-grass.png`, `ground-dirt.png`). Wang-tile edges are explicitly out of scope for v1; the code shape must allow swapping the tile renderer later without touching `TrailModel`.
6. **Sprite loading fails gracefully.** Every renderer falls back to a coloured rectangle when its sprite hasn't loaded yet. End-to-end logic must be developable before any art ships.
7. **No setTimeout-driven phase scheduling.** All phase transitions are resolved by `TimerEngine.tick(now)` returning a `TransitionEvent`. A user backgrounding the tab for 30 minutes during a 25-minute work session must resolve to break (or further along) on the next `tick`.
8. **No in-progress timer state in `localStorage`.** Only settings persist. Closing the tab cancels the timer — this is a deliberate product decision, see PRD § User Story 34.

---

## Canvas + rendering invariants

- Logical resolution: **640 × 360**.
- Display scale: **fractional fit-to-viewport** — `min(viewportW / 640, viewportH / 360)` (no `Math.floor`). Integer-only scaling was the original rule but was dropped in favour of an edge-to-edge canvas; `image-rendering: pixelated` keeps edges crisp at non-integer scales. The page background uses the sky colour so any aspect-ratio letterboxing blends invisibly.
- `ctx.imageSmoothingEnabled = false`.
- Ground strip: roughly `y = 270..360`. Chicken and trail live here. Parallax fills the rest.
- Parallax layers bottom-align at `baselineY = 270` so the artist's relative proportions (clouds tallest, dirt shortest) match the source composition.
- Chicken x: `leftMargin + progress × (canvasWidth − leftMargin − rightMargin)`. Direction follows phase: right during work, left during break. **Sprite sheets handle direction** (separate `chicken-walk-right.png` and `chicken-walk-left.png`); no code-flip via `ctx.scale(-1, 1)`.

---

## Testing posture

A good test in this project tests **external behaviour**, not internal structure:

- Call public methods with concrete inputs; assert on public state or return values.
- Never assert on private field names, internal call counts/order, or rendering output.
- Inject `now` and storage to make tests deterministic.

**Modules under test (v1):** `TimerEngine`, `TrailModel`, `SettingsStore`.

**Modules NOT under test (v1):** all renderers, `AudioChirp`, `Notifier`, and React components. Visual iteration via running the app is faster than maintaining canvas snapshot tests, and the browser-API wrappers resist clean mocking. Reconsider on a per-bug basis if a regression recurs.

Tooling: **Vitest**, configured to run in a plain Node environment for v1 (no `happy-dom` / `jsdom` needed because the tested modules are DOM-free).

---

## Asset pipeline

Sprites live under `/public/sprites/`. Drop new PNGs in; renderers pick them up. Expected files (all optional — fallback rectangles fill in until they ship):

- `chicken-walk-right.png` — 6 × 64×64 = 384 × 64 strip
- `chicken-walk-left.png` — 6 × 64×64 = 384 × 64 strip
- `chicken-idle.png` — 6 × 64×64 = 384 × 64 strip
- `clouds.png` — 1280 × 270, transparent sky, horizontally seamless
- `hills-far.png` — 1280 × 180, transparent sky, horizontally seamless
- `mid-trees.png` — 1280 × 160, transparent sky, horizontally seamless. Bottom-aligns to `baselineY + 10` so the bottom 10 px sinks behind the ground tiles (`offsetY: 10` in `DEFAULT_PARALLAX_LAYOUT`).
- `near-grass.png` — 1280 × 27, transparent sky, horizontally seamless. Bottom-aligns to `baselineY + 8` (`offsetY: 8`) so blade tips poke above the horizon and the dirt portion hides behind the ground.
- `ground-grass.png`, `ground-dirt.png` — 32 × 32 tiles, opaque, tileable in both axes (renderer falls back to flat colours; current versions are procedurally generated dithered tiles in `build-sprites.mjs`).

Source art lives under `/assets/`. Background panels are now hand-painted in Photoshop at native logical resolution (1280-wide, alpha PNGs) and dropped under `/assets/new/`. The `scripts/build-sprites.mjs` build performs three operations: (1) stitches chicken animation frames into per-direction strips using a shared bounding-box pass so the figure doesn't jitter; (2) pass-through-copies `/assets/new/*.png` into `/public/sprites/` (no resize, no chroma-key — the artist supplies game-ready alpha PNGs); (3) procedurally generates `ground-grass.png` and `ground-dirt.png`. **The old `/assets/background/` cyan-sky + 2048→540 downscale path is retired** — don't reintroduce it; either pipe new source files through the pass-through copy or hand-paint replacements at native size.

---

## Decision log

Decisions worth recording for future iterations (and the reason they were chosen, so they can be revisited if the premise changes):

- **Architecture A (chicken-moves-across-screen)** chosen over **Architecture B (chicken-walks-in-place + scrolling world)** — because the trail is the progress indicator, and a scrolling world would scroll the trail off-screen.
- **DOM `TimerOverlay` text** chosen over **canvas-rendered text** — sharper rendering and cheaper to update.
- **Procedural Web Audio chirp** chosen over **bundled audio files** — no licensing, no asset pipeline, two lines of code.
- **Flat two-tile trail** chosen over **Wang-tile edges** — looks fine at 320×180; can be upgraded later without changing `TrailModel`.
- **Vitest** chosen over **Jest** — matches the Vite stack, zero extra config.
- **Fit-to-cover fractional scaling** chosen over **integer-only fit-to-contain** (2026-05-14) — the original integer-scaling rule produced visible sky-blue letterbox bars on most desktop viewports, killing immersion. Fit-to-cover (`Math.max(viewportW/640, viewportH/360)`) fills both viewport dimensions; vertical/horizontal overflow is clipped by the parent's `overflow:hidden`. Trade-off: slight cropping of cloud crowns on wide viewports and side margins on portrait. Acceptable because the cropped regions are either sky-only or extra ground.
- **64×64 chicken frames** chosen over **96×96** (2026-05-14) — the chicken at 96×96 felt too large relative to the world at the new 640×360 canvas. Smaller frame gives more breathing room around the trees and ground. `chickenY` moved 244 → 276 so feet still sit on the ground strip.
- **Per-layer `offsetY` on parallax layout** chosen over **a single shared baseline** (2026-05-14) — the artist-supplied panels look better when their bottoms sink slightly behind the ground tiles, hiding the hard horizon seam. Mid-trees +10, near-grass +8, clouds and far hills 0.
- **Native-resolution Photoshop panels** chosen over **2048-wide downscaled exports** (2026-05-14) — downscaling 2048→540 muddied pixel edges. Painting directly at the target logical size with the Pencil tool preserves crisp pixel art. The build script's downscale + chroma-key path is retired in favour of pass-through copy.
- **Skip lives in Settings**, not in the main control row — protects against misclicks during a focus session.
- **No long-break cycle (Cirillo 4-then-15)** in v1 — single work/break pair, alternates indefinitely. Adding the long-break ledger is anticipated to be cheap if pursued later.

---

## Reopen protocol (placeholder)

This project doesn't currently use a GitHub-backed issue tracker — work is tracked entirely in `scripts/prd.json`. If a previously-passing task needs to be reopened (a regression is discovered), flip the task back to `"passes": false` in `prd.json` and add a one-line note in `scripts/progress.txt` describing the regression and what evidence prompted the reopen, so the next iteration has full context.
