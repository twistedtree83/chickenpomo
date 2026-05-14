# PRD — Chicken Pomodoro Timer

## Problem Statement

I want a pomodoro timer that I actually enjoy looking at. Generic timers (digit countdowns, ring fills) work, but they're sterile — there's no charm to keep me checking back, and the moment of phase transition is a beep with no payoff. I want the timer to feel like a tiny retro video game: something that runs in a browser tab, makes the focus session feel like a journey, and gives me a small dopamine hit at every phase boundary.

## Solution

A web-based pomodoro timer rendered as a side-scrolling 8-bit scene. A pixel-art chicken walks across the bottom quarter of the canvas as the work timer counts down — its x-position is a direct function of elapsed time, so the chicken *is* the progress bar. As it walks, it wears a dirt path into the grass behind it. When the chicken reaches the right edge, the work session is over: it celebrates briefly, a chirp plays, the phase flips to "break," and the chicken walks back toward the left, healing the path behind it as it goes. When it hits the left edge, break ends, the next work session starts, and the cycle continues until the user stops it.

Behind the chicken, a multi-layer parallax of clouds, hills, mid-ground, and near-ground sells the retro side-scroller feel. Large pixel-font digits and a phase label sit above the chicken so the time-remaining is always glanceable. Controls (Start, Pause, Reset, Settings) live outside the canvas as DOM buttons. Settings let the user configure work/break durations, sound, and notifications.

## User Stories

1. As a focus-seeker, I want to start a pomodoro work session with one click, so that I can begin without configuring anything.
2. As a focus-seeker, I want to see a 25-minute work timer count down by default, so that I get the canonical pomodoro experience without setup.
3. As a focus-seeker, I want the timer to keep accurate time even when its browser tab is backgrounded, so that I can have it running while I work in other tabs without it drifting.
4. As a focus-seeker, I want to pause the timer when I'm interrupted, so that I don't lose credit for time I wasn't actually focused.
5. As a focus-seeker, I want to resume a paused timer, so that I can continue where I left off.
6. As a focus-seeker, I want to reset the timer mid-session, so that I can abandon a session that's no longer relevant.
7. As a focus-seeker, I want the timer to auto-advance from work to break, so that I'm not tempted to skip the break by clicking past it.
8. As a focus-seeker, I want the timer to auto-advance from break to work, so that the cycle continues without me having to remember to start the next one.
9. As a focus-seeker, I want the timer to keep cycling indefinitely until I stop it, so that I can do as many pomodoros as my day needs.
10. As a focus-seeker, I want a clear visual difference between work mode and break mode, so that I always know which phase I'm in at a glance.
11. As a focus-seeker, I want a large numeric `mm:ss` countdown above the chicken, so that I can see exactly how much time is left without interpreting pixel positions.
12. As a focus-seeker, I want a phase label ("Work" or "Break") near the timer, so that I never have to guess the current mode.
13. As a focus-seeker, I want a chirp sound when the phase changes, so that I can be alerted without having to watch the screen.
14. As a focus-seeker, I want a browser notification when the phase changes and my tab is in the background, so that I'm notified even when the app isn't visible.
15. As a focus-seeker, I want to be asked for notification permission only when I press Start (not on page load), so that the permission request feels intentional rather than hostile.
16. As a focus-seeker, I want the chicken to walk across the screen during work, with its x-position representing my progress, so that the scene itself communicates how much time remains.
17. As a focus-seeker, I want the chicken to leave a worn dirt path on the grass as it walks during work, so that I can see how far I've come.
18. As a focus-seeker, I want the chicken to walk back in the opposite direction during break, so that the visual metaphor of "going back to rest" is clear.
19. As a focus-seeker, I want the dirt path to revert to grass as the chicken walks back during break, so that the start of the next work session feels like a fresh canvas.
20. As a focus-seeker, I want the chicken to play a brief celebration animation when it reaches the end of a phase, so that I get a small reward for completing the session.
21. As a focus-seeker, I want the chicken to play a head-bob idle animation when the timer is paused, so that I can tell the app is paused intentionally rather than frozen.
22. As a focus-seeker, I want the background to have parallax layers (sky/clouds, far hills, midground, near foliage), so that the scene feels alive and game-like.
23. As a focus-seeker, I want clouds in the sky to drift slowly regardless of timer state, so that the scene feels ambient and atmospheric.
24. As a focus-seeker, I want the far/mid/near parallax layers to shift subtly as the chicken progresses, so that the scene sells the feeling of a journey across a landscape.
25. As a focus-seeker, I want the scene to render in crisp pixel-art at integer scale, so that the retro aesthetic is preserved on any monitor size.
26. As a focus-seeker, I want the scene to use a pixel font for the timer digits and phase label, so that the typography matches the 8-bit visual style.
27. As a customiser, I want to open a settings panel, so that I can adjust the timer to fit my workflow.
28. As a customiser, I want to set the work duration (e.g., 5–60 minutes), so that I can run longer or shorter focus sessions.
29. As a customiser, I want to set the break duration (e.g., 1–30 minutes), so that I can match break length to my preferences.
30. As a customiser, I want to toggle sound on or off, so that I can use the timer in quiet environments.
31. As a customiser, I want to toggle browser notifications on or off, so that I can opt out of OS-level alerts.
32. As a customiser, I want a "Skip" control tucked inside settings, so that I can jump phases when needed without exposing the button to easy misuse.
33. As a customiser, I want my settings to persist across page reloads, so that I don't have to reconfigure the timer every time I open it.
34. As a returning user, I want my settings to be remembered, but I do *not* expect a half-finished session to survive closing the tab — closing the tab cancels the timer.
35. As a developer iterating on the project, I want the timer's logic to be unit-testable in isolation from any rendering, so that I can verify state-machine correctness without standing up a browser.
36. As a developer iterating on the project, I want the trail data structure to be unit-testable in isolation, so that the stamp/erase mechanic can be verified without canvas rendering.
37. As a developer iterating on the project, I want the settings store to be unit-testable in isolation, so that persistence and default behavior can be verified without a browser session.
38. As a developer iterating on the project, I want to drop new sprite PNGs into a known directory and have them picked up by the renderer with no further code changes, so that art iteration is fast.
39. As a developer iterating on the project, I want the renderer to fall back to placeholder colored rectangles for any missing sprite, so that the timer + trail + phase logic can be developed end-to-end before any art is produced.
40. As a developer iterating on the project, I want the chirp sound to be generated procedurally via the Web Audio API, so that there are no audio asset files to license, source, or bundle.

## Implementation Decisions

### Stack
- Vite + React + TypeScript + Tailwind for the page chrome.
- HTML5 Canvas 2D context for the scene.
- Pixel-font web font (e.g., "Press Start 2P") for timer + phase label.

### Scene architecture (Architecture A: chicken-moves)
- The chicken's on-screen x-coordinate is a pure function of timer progress: `x = leftMargin + progress × (canvasWidth − leftMargin − rightMargin)`, where `progress = elapsedMs / totalMs`.
- Work phase: progress runs 0 → 1, chicken walks left → right, trail stamps dirt cells behind it.
- Break phase: progress runs 0 → 1, chicken walks right → left, trail reverts dirt cells back to grass as the chicken passes.
- The chicken always faces its direction of travel — a separate sprite sheet per direction (no code-flip).
- The parallax layers' motion is decorative; the chicken is the authoritative progress indicator.

### Canvas
- Internal logical resolution: **320×180**.
- Bottom quarter (~`y = 135..180`) is the ground strip where the chicken and trail live.
- Top three-quarters host parallax layers L0 (sky/clouds), L1 (far hills), L2 (midground), L3 (near foliage).
- Display scaling: largest integer multiple of 320×180 that fits the viewport (`scale = Math.floor(min(viewportW/320, viewportH/180))`); canvas is CSS-sized to `320×scale, 180×scale`.
- `imageSmoothingEnabled = false` on the 2D context.
- Canvas is centered on the page; page background is whatever color the page styles dictate (no letterboxing logic required — the canvas just sits where it fits).

### Modules

**Deep modules (pure logic, no DOM, fully testable):**

- **TimerEngine** — state machine. State: `phase: 'idle' | 'work' | 'break'`, `endTime: number | null`, `pausedRemainingMs: number | null`. Methods: `start(workMs, breakMs)`, `pause(now)`, `resume(now)`, `reset()`, `read(now): { phase, remainingMs, progress, isRunning, isPaused }`, `tick(now): TransitionEvent | null`. Wall-clock based. `tick` is called every frame; when the current phase's `endTime` is reached, it auto-flips: work → break or break → work, returning a transition event the caller can react to (chirp, notification). No setTimeout-driven scheduling — all timing is derived from `Date.now()` deltas.
- **TrailModel** — array of grass/dirt cells covering the chicken's x-range, fixed cell width (e.g., 4px logical). Methods: `stampForward(progressX)` marks all cells with `x ≤ progressX` as dirt, `eraseBackward(progressX)` reverts all cells with `x ≥ progressX` to grass, `cells: ReadonlyArray<'grass' | 'dirt'>`. Stateless beyond the cell array. Constructor takes `numCells`.
- **SettingsStore** — typed `localStorage` wrapper. Schema: `{ workMinutes, breakMinutes, soundEnabled, notificationsEnabled, autoCycle, skipEnabled }`. Methods: `get(): Settings`, `set(partial: Partial<Settings>)`, `subscribe(fn)`, `reset()`. Defaults: 25 / 5 / on / on / on / off. Versioned key (`pomodoro.settings.v1`).

**Browser-API wrappers (thin, integration-tested at most):**

- **AudioChirp** — single `play(kind: 'work-start' | 'break-start')` method backed by Web Audio API: lazy-create `AudioContext` on first user gesture, generate a short square-wave tone with an attack-decay envelope. Different pitch per kind.
- **Notifier** — Notification API wrapper. `requestPermission()` (idempotent), `notify(title, body)`. Only fires when `document.hidden === true`.

**Rendering modules (canvas-bound):**

- **SpriteSheet** — `load(url): Promise<SpriteSheet>`, `drawFrame(ctx, frameIndex, x, y)`. Holds the loaded `HTMLImageElement` and frame dimensions.
- **ChickenRenderer** — owns the walk-cycle frame index, advances it based on elapsed time and a fixed framerate (e.g., 10 fps). Methods: `draw(ctx, x, y, direction, isPaused)`. Switches sprite sheets by direction; switches to idle sheet when paused.
- **ParallaxRenderer** — given `progress` (0..1) and `wallClockMs`, draws layers L0–L3. Clouds offset by time; hills/mid/near offset by progress × per-layer-factor (8% / 18% / 35%).
- **GroundRenderer** — draws the ground strip (tiled grass) and stamps dirt tiles per the TrailModel cells.
- **SceneRenderer** — orchestrator. On each rAF tick, calls `TimerEngine.tick(now)`, handles transition events (audio + notification + chicken-direction flip + trail reset), updates `TrailModel`, then composes the frame: parallax → ground → trail → chicken → text overlay.

**React UI:**

- `App` — top-level, owns React state for "current settings snapshot" and instantiates the long-lived modules (TimerEngine, TrailModel, renderers).
- `Scene` — mounts the canvas element and starts the rAF loop on mount.
- `Controls` — Start / Pause / Reset / ⚙ Settings buttons. Disabled states reflect TimerEngine state.
- `TimerOverlay` — renders the `mm:ss` text and phase label as DOM elements positioned above the canvas (alternative considered: render text into the canvas; rejected because DOM text is sharper and easier to update without re-rendering the whole scene). Pixel font applied via CSS.
- `SettingsModal` — form bound to `SettingsStore` with min/max validation on the duration fields.

### Behavior contracts

- **Phase transitions are auto.** No user confirmation between work and break or break and work.
- **Phase-end celebration** is implemented by reusing the idle sprite — a brief 1–2 second beat where the chicken is at the boundary, idle frames cycling, before direction flips.
- **Audio + notification fire on phase transition,** driven by `SceneRenderer` handling `TimerEngine.tick`'s transition event.
- **Notification permission request happens on first Start click,** not on page load.
- **Closing the tab cancels the timer** — no resume-after-close logic. Only `SettingsStore` writes to `localStorage`.
- **Skip control** is rendered inside the Settings modal as a small "Skip current phase" button; not surfaced in the main control row.

### Asset pipeline

- Sprites live under `/public/sprites/`. The user produces them in PixelLab and drops them in:
  - `chicken-walk-right.png` — 6 frames × 48×48 = 288×48 strip
  - `chicken-walk-left.png` — 6 frames × 48×48 = 288×48 strip
  - `chicken-idle.png` — 2 frames × 48×48 = 96×48 strip
  - `clouds.png` — 2–3 cloud sprites (transparent)
  - `hills-far.png` — long horizontal strip (~640×60)
  - `mid-trees.png` — long horizontal strip (~640×80)
  - `near-grass.png` — discrete grass tuft/post sprites
  - `ground-grass.png` — 16×16 tile
  - `ground-dirt.png` — 16×16 tile
- Renderers fall back to placeholder colored rectangles for any sprite that fails to load, so logic development can proceed before art is final.

## Testing Decisions

A good test in this project tests **external behavior**, not internal structure. For each deep module that means:

- Calling its public methods with concrete inputs and asserting on the resulting public state or return values.
- Never asserting on private field names, the count or order of internal calls, or rendering output.
- Using fake/controllable inputs for time and storage (inject `now` and a fake `localStorage`) so tests are deterministic.

### Modules under test

- **TimerEngine** — heavy coverage. Cover: initial state is idle; `start` transitions to work with correct `endTime`; `tick(now)` before endTime returns no transition; `tick(now)` at/after endTime returns a `work→break` transition and updates state to break; `tick` after break endTime transitions back to work and resets; `pause` then `resume` preserves remaining time; `reset` returns to idle; wall-clock skip (tab backgrounded for 30 minutes during a 25-minute work session) correctly resolves to the right phase on next `tick`.
- **TrailModel** — `stampForward` produces the expected dirt prefix; `eraseBackward` reverts the expected suffix; idempotency (`stampForward(x)` twice equals once); monotonicity contracts for the work and break phases respectively.
- **SettingsStore** — defaults returned when storage is empty; `set(partial)` merges with existing settings; `subscribe` fires on `set` and not on `get`; versioned key prevents collision with prior schemas.

### Modules NOT under test (v1)

- **SpriteSheet, ChickenRenderer, ParallaxRenderer, GroundRenderer, SceneRenderer** — visual iteration via running the app is faster than maintaining canvas snapshot tests for pixel art. Reconsider if a specific rendering bug recurs and warrants regression coverage.
- **AudioChirp, Notifier** — both are thin wrappers around browser APIs that resist clean mocking; manual smoke-test in browser is sufficient.
- **React components** — behavior is mostly visual chrome; covered by manual testing in the browser.

### Tooling

- Vitest for unit tests (matches the Vite stack — no extra configuration vs. Jest).
- No DOM is needed for the tested modules; `happy-dom` / `jsdom` not required for v1.

### Prior art

- No prior art in this repo (greenfield). Pattern to follow: test files colocated next to source (`TimerEngine.ts` + `TimerEngine.test.ts` in the same directory).

## Out of Scope

- **Native iOS / Android app.** A future port to React Native is anticipated but not part of this PRD.
- **Long-break cycle logic** (Cirillo "4 pomodoros then 15-minute long break"). v1 alternates one work and one break duration indefinitely.
- **Session statistics / history** ("you completed 8 pomodoros today"). No persistence beyond settings.
- **Resume-after-close.** Closing the tab cancels the timer. No localStorage of in-progress timer state.
- **Music / ambient sound.** A single phase-transition chirp only; music can be added later as opt-in.
- **Footstep / peck SFX** during the walk cycle. Considered and rejected for v1 — risks grating over a long session.
- **Custom skin / theming system.** Single visual style for v1. Adding palette swaps is anticipated to be cheap if pursued later.
- **Multi-user / sync.** Single-user, single-browser-tab. No accounts, no backend.
- **Wang-tile terrain** for the trail edges. v1 uses two flat tiles (grass and dirt). Wang tiles can be dropped in later without code changes if PixelLab is used to generate them.
- **Skip as a primary control.** Skip exists inside settings for v1, not as a visible main-row button.
- **Dedicated celebration animation.** Reuses the idle frames for v1; a wing-flap or hop sprite can replace it later.

## Further Notes

- The "chicken-moves-across-screen" architecture was chosen over "chicken-walks-in-place-with-scrolling-world" because the trail mechanic is core to the design and a scrolling-world trail would scroll off-screen — defeating its role as progress indicator.
- Parallax is preserved as decorative ambient motion (clouds time-drifting) plus subtle chicken-coupled scroll on far/mid/near layers, which sells "journey" without breaking the screen-space progress metaphor.
- The hard separation between **TimerEngine** (wall-clock state machine) and the **SceneRenderer** (rAF-driven view) is the single most important architectural decision. It is what makes the timer survive backgrounded tabs correctly, and it is what makes the timer logic unit-testable without a browser.
- The trail's two-tile representation (grass / dirt) is deliberately simpler than what PixelLab could produce (Wang tiles, edge variants). The flat tiles look fine at 320×180 with crisp pixel scaling; upgrading later means swapping art only.
- A future port to React Native / Expo would reuse `TimerEngine`, `TrailModel`, `SettingsStore` and `AudioChirp` (with a different audio backend), and rewrite the renderer layer against Skia or `react-native-reanimated`.
