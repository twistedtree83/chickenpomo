// DEV-ONLY — REMOVE BEFORE FINAL RELEASE.
// Hidden affordance for testing fast work/break cycles (sub-30-second durations
// the SettingsModal won't allow). Click the corner button, enter the password,
// dial seconds, hit Start. Delete this file plus the <DevModeButton /> wiring
// in App.tsx to retire.
import { useState } from 'react';

const DEV_PASSWORD = 'hotChicken';
const MIN_SECONDS = 1;
const MAX_SECONDS = 30;

export interface DevModeButtonProps {
  onStartDevCycle(workMs: number, breakMs: number): void;
}

export function DevModeButton({ onStartDevCycle }: DevModeButtonProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [passwordDraft, setPasswordDraft] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [workSeconds, setWorkSeconds] = useState('5');
  const [breakSeconds, setBreakSeconds] = useState('5');

  const close = (): void => {
    setOpen(false);
    setPasswordDraft('');
    setPasswordError(false);
  };

  const submitPassword = (): void => {
    if (passwordDraft === DEV_PASSWORD) {
      setUnlocked(true);
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  };

  const startCycle = (): void => {
    const w = Number(workSeconds);
    const b = Number(breakSeconds);
    if (!isValidSeconds(w) || !isValidSeconds(b)) return;
    onStartDevCycle(w * 1000, b * 1000);
    close();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-pixel rounded border border-slate-500/60 bg-slate-900/40 px-2 py-1 text-[10px] uppercase tracking-wider text-slate-300 hover:bg-slate-800/70"
        aria-label="Dev mode"
      >
        Dev
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Dev mode"
          onClick={close}
        >
          <div
            className="w-full max-w-sm rounded-lg border-2 border-slate-300 bg-slate-800 p-6 text-slate-100 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="mb-4 flex items-center justify-between">
              <h2 className="font-pixel text-sm uppercase">Dev mode</h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close dev mode"
                className="rounded border-2 border-slate-300 px-2 py-1 text-xs hover:bg-slate-700"
              >
                ×
              </button>
            </header>

            {!unlocked ? (
              <form
                className="flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  submitPassword();
                }}
              >
                <label className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wide text-slate-300">
                    Password
                  </span>
                  <input
                    type="password"
                    autoFocus
                    value={passwordDraft}
                    onChange={(e) => {
                      setPasswordDraft(e.target.value);
                      setPasswordError(false);
                    }}
                    aria-invalid={passwordError}
                    aria-label="Dev mode password"
                    className={`rounded border-2 bg-slate-900 px-3 py-2 text-slate-100 ${
                      passwordError ? 'border-amber-400' : 'border-slate-500'
                    }`}
                  />
                  {passwordError && (
                    <span className="text-xs text-amber-300">Wrong password.</span>
                  )}
                </label>
                <button
                  type="submit"
                  className="font-pixel rounded border-2 border-slate-300 bg-slate-700 px-3 py-2 text-xs uppercase hover:bg-slate-600"
                >
                  Unlock
                </button>
              </form>
            ) : (
              <form
                className="flex flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  startCycle();
                }}
              >
                <p className="text-xs text-slate-300">
                  Starts a work→break cycle immediately, bypassing SettingsModal
                  minimums. Range: {MIN_SECONDS}–{MAX_SECONDS} s each.
                </p>
                <label className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wide text-slate-300">
                    Work seconds
                  </span>
                  <input
                    type="number"
                    min={MIN_SECONDS}
                    max={MAX_SECONDS}
                    step={1}
                    value={workSeconds}
                    onChange={(e) => setWorkSeconds(e.target.value)}
                    className="rounded border-2 border-slate-500 bg-slate-900 px-3 py-2 text-slate-100"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wide text-slate-300">
                    Break seconds
                  </span>
                  <input
                    type="number"
                    min={MIN_SECONDS}
                    max={MAX_SECONDS}
                    step={1}
                    value={breakSeconds}
                    onChange={(e) => setBreakSeconds(e.target.value)}
                    className="rounded border-2 border-slate-500 bg-slate-900 px-3 py-2 text-slate-100"
                  />
                </label>
                <button
                  type="submit"
                  disabled={
                    !isValidSeconds(Number(workSeconds)) ||
                    !isValidSeconds(Number(breakSeconds))
                  }
                  className="font-pixel rounded border-2 border-slate-300 bg-slate-700 px-3 py-2 text-xs uppercase hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Start dev cycle
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function isValidSeconds(n: number): boolean {
  if (!Number.isFinite(n)) return false;
  if (Math.round(n) !== n) return false;
  return n >= MIN_SECONDS && n <= MAX_SECONDS;
}
