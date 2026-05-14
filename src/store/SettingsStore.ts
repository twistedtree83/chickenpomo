export interface Settings {
  workMinutes: number;
  breakMinutes: number;
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  autoCycle: boolean;
  skipEnabled: boolean;
}

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type SettingsListener = (settings: Settings) => void;

export const SETTINGS_STORAGE_KEY = 'pomodoro.settings.v1';

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  workMinutes: 25,
  breakMinutes: 5,
  soundEnabled: true,
  notificationsEnabled: true,
  autoCycle: true,
  skipEnabled: false,
});

function isSettings(value: unknown): value is Settings {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['workMinutes'] === 'number' &&
    typeof v['breakMinutes'] === 'number' &&
    typeof v['soundEnabled'] === 'boolean' &&
    typeof v['notificationsEnabled'] === 'boolean' &&
    typeof v['autoCycle'] === 'boolean' &&
    typeof v['skipEnabled'] === 'boolean'
  );
}

function mergeWithDefaults(value: unknown): Settings {
  if (typeof value !== 'object' || value === null) {
    return { ...DEFAULT_SETTINGS };
  }
  const v = value as Record<string, unknown>;
  const merged: Settings = {
    workMinutes:
      typeof v['workMinutes'] === 'number' ? v['workMinutes'] : DEFAULT_SETTINGS.workMinutes,
    breakMinutes:
      typeof v['breakMinutes'] === 'number' ? v['breakMinutes'] : DEFAULT_SETTINGS.breakMinutes,
    soundEnabled:
      typeof v['soundEnabled'] === 'boolean' ? v['soundEnabled'] : DEFAULT_SETTINGS.soundEnabled,
    notificationsEnabled:
      typeof v['notificationsEnabled'] === 'boolean'
        ? v['notificationsEnabled']
        : DEFAULT_SETTINGS.notificationsEnabled,
    autoCycle:
      typeof v['autoCycle'] === 'boolean' ? v['autoCycle'] : DEFAULT_SETTINGS.autoCycle,
    skipEnabled:
      typeof v['skipEnabled'] === 'boolean' ? v['skipEnabled'] : DEFAULT_SETTINGS.skipEnabled,
  };
  return merged;
}

export class SettingsStore {
  private readonly storage: StorageAdapter;
  private readonly key: string;
  private readonly listeners = new Set<SettingsListener>();
  private cached: Settings;

  constructor(storage: StorageAdapter, key: string = SETTINGS_STORAGE_KEY) {
    this.storage = storage;
    this.key = key;
    this.cached = this.load();
  }

  get(): Settings {
    return { ...this.cached };
  }

  set(partial: Partial<Settings>): void {
    const next: Settings = { ...this.cached, ...partial };
    if (!isSettings(next)) {
      throw new TypeError('SettingsStore.set received invalid partial settings');
    }
    this.cached = next;
    this.storage.setItem(this.key, JSON.stringify(next));
    this.emit();
  }

  reset(): void {
    this.cached = { ...DEFAULT_SETTINGS };
    this.storage.removeItem(this.key);
    this.emit();
  }

  subscribe(listener: SettingsListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private load(): Settings {
    const raw = this.storage.getItem(this.key);
    if (raw === null) {
      return { ...DEFAULT_SETTINGS };
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      return mergeWithDefaults(parsed);
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  private emit(): void {
    const snapshot = this.get();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}
