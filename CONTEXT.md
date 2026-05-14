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

- Logical resolution: **320 × 180**.
- Display scale: `Math.floor(min(viewportW / 320, viewportH / 180))`. Canvas is CSS-sized to `320 * scale × 180 * scale`.
- `ctx.imageSmoothingEnabled = false`.
- Ground strip: roughly `y = 135..180`. Chicken and trail live here. Parallax fills the rest.
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

- `chicken-walk-right.png` — 6 × 48×48 = 288 × 48 strip
- `chicken-walk-left.png` — 6 × 48×48 = 288 × 48 strip
- `chicken-idle.png` — 2 × 48×48 = 96 × 48 strip
- `clouds.png`, `hills-far.png`, `mid-trees.png`, `near-grass.png`
- `ground-grass.png`, `ground-dirt.png` — 16 × 16 tiles

---

## Decision log

Decisions worth recording for future iterations (and the reason they were chosen, so they can be revisited if the premise changes):

- **Architecture A (chicken-moves-across-screen)** chosen over **Architecture B (chicken-walks-in-place + scrolling world)** — because the trail is the progress indicator, and a scrolling world would scroll the trail off-screen.
- **DOM `TimerOverlay` text** chosen over **canvas-rendered text** — sharper rendering and cheaper to update.
- **Procedural Web Audio chirp** chosen over **bundled audio files** — no licensing, no asset pipeline, two lines of code.
- **Flat two-tile trail** chosen over **Wang-tile edges** — looks fine at 320×180; can be upgraded later without changing `TrailModel`.
- **Vitest** chosen over **Jest** — matches the Vite stack, zero extra config.
- **Skip lives in Settings**, not in the main control row — protects against misclicks during a focus session.
- **No long-break cycle (Cirillo 4-then-15)** in v1 — single work/break pair, alternates indefinitely. Adding the long-break ledger is anticipated to be cheap if pursued later.

---

## Reopen protocol (placeholder)

This project doesn't currently use a GitHub-backed issue tracker — work is tracked entirely in `scripts/prd.json`. If a previously-passing task needs to be reopened (a regression is discovered), flip the task back to `"passes": false` in `prd.json` and add a one-line note in `scripts/progress.txt` describing the regression and what evidence prompted the reopen, so the next iteration has full context.
