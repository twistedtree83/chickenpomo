# Ralph Wiggum — Chicken Pomodoro Reference Guide

## What is Chicken Pomodoro?

A web-based pomodoro timer rendered as an 8-bit side-scrolling scene. A pixel-art chicken walks across the bottom quarter of a 320×180 canvas as the work timer counts down — its x-position **is** the progress bar. As it walks, it wears a dirt path into the grass behind it. When the work session ends, the phase flips to break, the chicken walks back toward the left, and the path heals back to grass. The cycle continues until the user stops it.

The aim is a pomodoro tool you *want* to look at — a tiny retro video game rather than a sterile digit countdown. Full product context is in [`PRD.md`](./PRD.md); architectural commitments and load-bearing module names are in [`CONTEXT.md`](./CONTEXT.md).

## Stack

- **Vite + React + TypeScript (strict)** for the page chrome
- **Tailwind** for buttons, modal, and layout
- **HTML5 Canvas 2D** for the scene (320×180 logical resolution, integer scaling, `imageSmoothingEnabled = false`)
- **Web Audio API** for the procedural phase-transition chirp (no audio asset files)
- **Notification API** for backgrounded-tab alerts (permission requested on first Start click)
- **Vitest** for unit tests, colocated next to source (`Foo.ts` + `Foo.test.ts`)
- **"Press Start 2P"** (or equivalent) pixel font for timer + phase label, loaded via CSS

No backend. No accounts. No sync. Single user, single browser tab.

## Architectural commitments (non-negotiable)

These are the rules every Ralph iteration must respect. Full detail is in `CONTEXT.md` — this is the short version.

1. **`TimerEngine` is the only owner of wall-clock state.** It's a pure state machine with no DOM, no canvas, no React, no audio, no `setTimeout`. The render loop asks it `tick(now)` once per frame and reacts to the returned `TransitionEvent`.
2. **Deep modules accept `now` and storage as parameters/injected adapters.** `TimerEngine`, `TrailModel`, and `SettingsStore` never call `Date.now()` or touch `localStorage` directly. This is what makes them DOM-free and deterministic-testable.
3. **Renderers are stateless beyond cached image handles.** Model state lives in the deep modules; renderers read it each frame.
4. **Renderers fall back to coloured rectangles** when a sprite hasn't loaded — end-to-end logic must be developable before any art ships.
5. **Module names from `CONTEXT.md` are used verbatim** in code, tests, and commits: `TimerEngine`, `TrailModel`, `SettingsStore`, `AudioChirp`, `Notifier`, `SpriteSheet`, `ChickenRenderer`, `ParallaxRenderer`, `GroundRenderer`, `SceneRenderer`.

## Design constraints

- Phase transitions are automatic — no user confirmation between work↔break.
- Notification permission is requested on first Start click, **never** on page load.
- Closing the tab cancels the timer. Only settings persist to `localStorage` (versioned key `pomodoro.settings.v1`).
- Skip control lives **inside** the Settings modal, not the main control row.
- Two-tile trail (`ground-grass.png`, `ground-dirt.png`); Wang-tile edges are explicitly v1-out-of-scope.
- Chicken sprite sheets are per-direction (`chicken-walk-right.png`, `chicken-walk-left.png`); no code-flip via `ctx.scale(-1, 1)`.

## Out of scope for v1

(Don't let an iteration scope-creep into these — they're parked deliberately, see `PRD.md` § Out of Scope.)

- Native iOS / Android app
- Long-break cycle ("4 pomodoros then 15-minute long break")
- Session statistics / history
- Resume-after-close
- Music / ambient sound
- Footstep / peck SFX during the walk
- Custom skin / theming
- Multi-user / sync / accounts / backend
- Skip as a primary main-row button

---

## What is Ralph?

Ralph is an autonomous AI coding loop. You feed Claude the same structured prompt on every iteration, Claude implements one task, commits it, and updates a task list. The loop continues until Claude outputs `<promise>COMPLETE</promise>`. Then it stops.

Named after Ralph Wiggum from The Simpsons — persistent iteration despite setbacks.

**Origin:** Geoffrey Huntley (ghuntley.com/ralph/)
**Popularised by:** Matt Pocock (aihero.dev, @mattpocockuk) — note: often misattributed; Huntley invented it
**"Ralphonce"** = `ralph-once` — the single-iteration, human-in-the-loop variant from snarktank/ralph

---

## File Structure

```
PRD.md              Product requirements + architectural decisions
CONTEXT.md          Module vocabulary + architectural rules (load-bearing names)
scripts/
  ralph.sh          Full autonomous loop (N iterations)
  ralphonce.sh      Single iteration — run, review, repeat
  RALPH_PROMPT.md   What Claude reads at the start of every iteration
  prd.json          Task list (T-1 … T-15)
  progress.txt      Append-only log of what each iteration built
```

---

## Command Lines

### Single iteration (recommended to start)
```bash
./scripts/ralphonce.sh
```
Claude runs once, implements one task, commits, updates `prd.json` and `progress.txt`, then stops. You review the output, check the code, and run again when ready.

### Full autonomous loop — 10 iterations (default)
```bash
./scripts/ralph.sh
```

### Full autonomous loop — custom iteration count
```bash
./scripts/ralph.sh 20
./scripts/ralph.sh 50
```

---

## How a Single Iteration Works

1. Claude reads `PRD.md`, `CONTEXT.md`, `scripts/prd.json`, and `scripts/progress.txt`
2. Claude finds the next task where `passes: false`, `afk: true`, and all dependencies are met
3. Claude implements the task, following Chicken Pomodoro's stack and architectural rules
4. Quality gate: `npx tsc --noEmit` → `npx vitest run --reporter=dot` (and `eslint` if relevant)
5. Commit: `feat: [T-X] - <description>`
6. Claude sets `passes: true` in `prd.json`
7. Claude appends learnings to `progress.txt`
8. If all `afk` tasks are done: outputs `<promise>COMPLETE</promise>` and stops
9. Otherwise: outputs a one-line status and stops

---

## Task Types in prd.json

| Label | Meaning |
|-------|---------|
| `afk: true` | Claude can implement autonomously — run Ralph |
| `afk: false` (hitl) | Requires human action (e.g. dropping in sprite art) — Ralph will pause and tell you |

### Human tasks you must complete manually (hitl)
- **T-14** Drop initial sprite art into `/public/sprites/`. Until this is done, renderers fall back to coloured rectangles — useful for end-to-end logic dev but not the finished look.

When Ralph encounters a hitl blocker it outputs `WAITING: ...` and stops. Complete the task, set `"passes": true` for it in `prd.json`, then run Ralph again.

---

## Marking a Human Task Done

Open `scripts/prd.json`, find the task (e.g. T-14), and change:
```json
"passes": false
```
to:
```json
"passes": true
```

Then run `./scripts/ralphonce.sh` again.

---

## Tips for Chicken Pomodoro Specifically

- **Start with T-1** (Vite + React + TS + Tailwind + Vitest scaffold) — it has no dependencies and unblocks everything.
- **The `TimerEngine` ↔ renderer split is sacred.** Don't let an iteration reach for `setTimeout` inside `TimerEngine` or import the canvas into a deep module — see CONTEXT.md § "Hard architectural rules".
- **Deep modules (TimerEngine, TrailModel, SettingsStore) are DOM-free.** Tests inject `now` and a fake storage adapter. No `happy-dom` / `jsdom` needed for v1.
- **Renderers fall back to coloured rectangles** when a sprite hasn't loaded. T-7 onward should not block on T-14.
- **Check `progress.txt`** after each iteration to see what patterns Claude discovered (and what gotchas to avoid).

---

## Key Repositories & Resources

| Resource | URL |
|----------|-----|
| Original snarktank/ralph | github.com/snarktank/ralph |
| frankbria/ralph-claude-code | github.com/frankbria/ralph-claude-code |
| Geoffrey Huntley's blog | ghuntley.com/ralph/ |
| Matt Pocock's guide | aihero.dev/getting-started-with-ralph |
| Adam Tuttle's workflow | adamtuttle.codes/blog/2026/my-ralph-workflow-for-claude-code/ |

---

## Troubleshooting

**Ralph keeps implementing the same task:** Check that RALPH_PROMPT.md step 8 ran — `passes` should have been updated. If not, set it manually.

**Ralph outputs WAITING on T-14:** Drop the sprite PNGs into `/public/sprites/`, then set `"passes": true` for T-14 in `prd.json`.

**Quality gate fails every iteration:** Check `scripts/progress.txt` — Claude should have logged what went wrong. Often a missing dev dependency or a renderer reaching into a deep module by mistake.

**Loop exits with "max iterations reached":** Run `./scripts/ralph.sh 50` to give it more attempts, or use `ralphonce.sh` to step through manually.
