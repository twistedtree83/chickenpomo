# Ralph — Chicken Pomodoro Agent Instructions

You are an autonomous coding agent working on **Chicken Pomodoro**, a web-based pomodoro timer rendered as an 8-bit side-scrolling scene where a pixel-art chicken walks across the canvas as the timer counts down.

Your job is to implement exactly ONE task per session, then stop.

## Stack (do not deviate)
- Vite + React + TypeScript (strict mode)
- Tailwind for page chrome (buttons, modal, layout)
- HTML5 Canvas 2D for the scene (`imageSmoothingEnabled = false`, 320×180 logical resolution, integer scaling)
- Web Audio API for the phase-transition chirp (procedural, no audio files)
- Notification API for backgrounded-tab alerts (request permission on first Start, not on load)
- Vitest for unit tests (colocated `*.test.ts` next to source)
- "Press Start 2P" (or equivalent) pixel font for timer + phase label, loaded via CSS

## Design constraints
- Scene metaphor: chicken's x-position **is** the progress bar. Work = walks left→right stamping dirt; break = walks right→left healing the path back to grass.
- Bottom quarter of the canvas (~y=135..180) is the ground strip. Top three-quarters host parallax layers L0–L3 (sky/clouds, far hills, midground, near foliage).
- Phase transitions are automatic — no user confirmation between work↔break.
- Notification permission is requested on first Start click, never on page load.
- Closing the tab cancels the timer. Only settings persist (to `localStorage` under key `pomodoro.settings.v1`).
- Skip control lives **inside** the Settings modal, not the main control row.
- Renderers must fall back to placeholder coloured rectangles for any sprite that fails to load, so logic development proceeds without final art.

---

## Your 8-step workflow — follow in order, every session

### Step 1 — Read your inputs
Read all of these files before doing anything else:
- `PRD.md` — full product requirements and architectural decisions
- `CONTEXT.md` — load-bearing module names and architecture rules (use these names **verbatim** in code, tests, and commits — don't invent synonyms)
- `scripts/prd.json` — task list with pass/fail and dependency state
- `scripts/progress.txt` — prior iteration learnings (patterns, gotchas, dead-ends)

The non-negotiable architectural split: **TimerEngine** (wall-clock state machine, pure logic, no DOM) is separate from **SceneRenderer** (rAF-driven view). The timer survives backgrounded tabs because timing is derived from `Date.now()` deltas, not `setTimeout`. Do not collapse this split.

### Step 2 — Find your task
Select a task from `scripts/prd.json` where ALL of these are true:
- `passes` is `false`
- `afk` is `true`
- Every task listed in `depends` has `passes: true`

Pick the most foundational eligible task (lower-numbered, fewer downstream dependents waiting on it). If no such task exists, check whether all `afk: false` (human-in-the-loop) tasks are still unmet. If so, output:

```
WAITING: The next task (<id>) requires human action. See scripts/prd.json for details.
```

Substitute `<id>` with the actual task id. Then stop — do NOT output `<promise>COMPLETE</promise>`.

### Step 3 — Announce your task
Output a single line: `Working on <id>: <description>` (e.g. `Working on T-3: TimerEngine state machine`).

### Step 4 — Read existing code
Before writing anything, scan the codebase for existing implementations. Do not recreate what already exists.
- Look for the module name from CONTEXT.md (e.g. searching for `TrailModel` if the task touches it)
- Re-read the relevant section of `PRD.md` (Implementation Decisions § Modules)
- Do not read files unrelated to the current task

### Step 5 — Implement
Implement the full acceptance criteria for this ONE task. Rules:
- Follow the existing file structure: source under `src/`, with sub-folders by concern (`src/engine/` for TimerEngine + TrailModel, `src/render/` for canvas renderers, `src/components/` for React, `src/store/` for SettingsStore, `src/audio/` and `src/notify/` for the browser wrappers).
- Co-locate tests: `TimerEngine.ts` + `TimerEngine.test.ts` in the same directory.
- TypeScript strict — no `any`, no `@ts-ignore`, no `// eslint-disable` without a justifying comment.
- Deep modules (TimerEngine, TrailModel, SettingsStore) must have **no DOM imports**. They are testable in pure Node without `jsdom` / `happy-dom`.
- Tests inject `now` (a `() => number`) and a fake storage object rather than reading `Date.now()` or `localStorage` directly. Determinism over convenience.
- Renderers must accept the model state as input and not mutate it. State lives in the deep modules; renderers are stateless beyond cached `HTMLImageElement` handles.
- Use the **exact** module names from CONTEXT.md (`TimerEngine`, `TrailModel`, `SettingsStore`, `AudioChirp`, `Notifier`, `SpriteSheet`, `ChickenRenderer`, `ParallaxRenderer`, `GroundRenderer`, `SceneRenderer`).

### Step 6 — Quality gate
Run these in order and fix all failures before continuing:
```bash
npx tsc --noEmit
npx vitest run --reporter=dot
```

If the task touched lint-relevant files, also run:
```bash
npx eslint . --ext .ts,.tsx --max-warnings 0
```

The Vitest run must finish green (no skipped tests counted as failures). Do not commit while any gate is red.

If a test is genuinely flaky because of `requestAnimationFrame` timing, do **not** add a `setTimeout` sleep — instead, inject the clock and drive the test deterministically. The clock-injection pattern is the whole reason the deep modules are kept DOM-free.

### Step 7 — Commit
This project lives in `/home/kane/pomodoro`. If git isn't initialised yet (the very first task), initialise it: `git init && git add -A && git commit -m "chore: initial scaffold"` BEFORE proceeding to the feature commit.

```bash
git add -A
git commit -m "feat: [<id>] - <task description>"
```

Use conventional commits. The commit message must include the task id from `prd.json`.

### Step 8 — Mark the task complete and log learnings
1. Set `"passes": true` for the task you just completed in `scripts/prd.json`.
2. Append to `scripts/progress.txt`:
   ```
   ---
   [ISO timestamp] <id>: <task description>
   What was built: <1–3 sentences>
   Files changed: <list>
   Learnings: <anything a future iteration should know — patterns, gotchas, API quirks>
   ---
   ```
3. Re-run the quality gate quickly (`npx tsc --noEmit && npx vitest run --reporter=dot`) to confirm the prd.json edit didn't break anything (it shouldn't, but verifying takes 2 seconds).

### Step 9 — Check for completion
If every task with `afk: true` in `prd.json` now has `passes: true`, output:
```
<promise>COMPLETE</promise>
```

Otherwise output a one-line summary of what was just built and stop. The loop will restart you on the next iteration.

If a quality gate failed because of a missing dev dependency, env var, or browser-only API that the test environment can't provide, advise the user in your final line of output rather than failing silently.

---

## What you must NEVER do
- Implement more than one task per session
- Output `<promise>COMPLETE</promise>` unless ALL `afk` tasks pass
- Skip the quality gate (Step 6)
- Use `any`, `@ts-ignore`, or untyped `as` casts in TypeScript
- Add audio asset files — the chirp is procedural via Web Audio API
- Schedule timing with `setTimeout`/`setInterval` inside `TimerEngine` — all timing is derived from injected `now` deltas
- Read `Date.now()` or `localStorage` directly inside deep modules — inject them
- Couple `TimerEngine` to the canvas, React, or any DOM API
- Persist in-progress timer state to `localStorage` — only settings persist
- Add a primary-row Skip button — Skip lives inside the Settings modal only
- Use red as a phase indicator anywhere (no error/danger framing on a focus tool)
- Request notification permission on page load instead of first Start click
