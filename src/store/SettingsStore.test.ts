import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  SettingsStore,
  type Settings,
  type StorageAdapter,
} from './SettingsStore';

function createFakeStorage(initial: Record<string, string> = {}): StorageAdapter & {
  data: Record<string, string>;
} {
  const data: Record<string, string> = { ...initial };
  return {
    data,
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? (data[key] as string) : null;
    },
    setItem(key, value) {
      data[key] = value;
    },
    removeItem(key) {
      delete data[key];
    },
  };
}

describe('SettingsStore', () => {
  let storage: ReturnType<typeof createFakeStorage>;

  beforeEach(() => {
    storage = createFakeStorage();
  });

  it('returns defaults when storage is empty', () => {
    const store = new SettingsStore(storage);
    expect(store.get()).toEqual(DEFAULT_SETTINGS);
  });

  it('returns the canonical pomodoro defaults (25/5, sound on, notifs on, autoCycle on, skip off)', () => {
    const store = new SettingsStore(storage);
    expect(store.get()).toEqual({
      workMinutes: 25,
      breakMinutes: 5,
      soundEnabled: true,
      notificationsEnabled: true,
      autoCycle: true,
      skipEnabled: false,
    });
  });

  it('loads previously persisted settings from storage', () => {
    const persisted: Settings = {
      workMinutes: 50,
      breakMinutes: 10,
      soundEnabled: false,
      notificationsEnabled: false,
      autoCycle: false,
      skipEnabled: true,
    };
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(persisted));
    const store = new SettingsStore(storage);
    expect(store.get()).toEqual(persisted);
  });

  it('merges set(partial) with existing settings instead of overwriting', () => {
    const store = new SettingsStore(storage);
    store.set({ workMinutes: 45 });
    expect(store.get()).toEqual({ ...DEFAULT_SETTINGS, workMinutes: 45 });
    store.set({ soundEnabled: false });
    expect(store.get()).toEqual({
      ...DEFAULT_SETTINGS,
      workMinutes: 45,
      soundEnabled: false,
    });
  });

  it('persists changes to storage under the versioned key', () => {
    const store = new SettingsStore(storage);
    store.set({ breakMinutes: 12 });
    const raw = storage.getItem(SETTINGS_STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toEqual({
      ...DEFAULT_SETTINGS,
      breakMinutes: 12,
    });
  });

  it('uses the exact versioned key "pomodoro.settings.v1"', () => {
    expect(SETTINGS_STORAGE_KEY).toBe('pomodoro.settings.v1');
  });

  it('does not collide with a hypothetical v0 schema', () => {
    storage.setItem('pomodoro.settings.v0', JSON.stringify({ workMinutes: 999 }));
    const store = new SettingsStore(storage);
    expect(store.get()).toEqual(DEFAULT_SETTINGS);
  });

  it('returns a fresh object from get() (mutation does not affect the store)', () => {
    const store = new SettingsStore(storage);
    const snapshot = store.get();
    snapshot.workMinutes = 1;
    expect(store.get().workMinutes).toBe(DEFAULT_SETTINGS.workMinutes);
  });

  it('subscribe fires on set', () => {
    const store = new SettingsStore(storage);
    const listener = vi.fn();
    store.subscribe(listener);
    store.set({ workMinutes: 30 });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ ...DEFAULT_SETTINGS, workMinutes: 30 });
  });

  it('subscribe does not fire on get', () => {
    const store = new SettingsStore(storage);
    const listener = vi.fn();
    store.subscribe(listener);
    store.get();
    store.get();
    expect(listener).not.toHaveBeenCalled();
  });

  it('subscribe returns an unsubscribe function', () => {
    const store = new SettingsStore(storage);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();
    store.set({ workMinutes: 30 });
    expect(listener).not.toHaveBeenCalled();
  });

  it('reset returns settings to defaults and clears storage', () => {
    const store = new SettingsStore(storage);
    store.set({ workMinutes: 45, soundEnabled: false });
    store.reset();
    expect(store.get()).toEqual(DEFAULT_SETTINGS);
    expect(storage.getItem(SETTINGS_STORAGE_KEY)).toBeNull();
  });

  it('reset notifies subscribers with the default settings', () => {
    const store = new SettingsStore(storage);
    store.set({ workMinutes: 45 });
    const listener = vi.fn();
    store.subscribe(listener);
    store.reset();
    expect(listener).toHaveBeenCalledWith(DEFAULT_SETTINGS);
  });

  it('falls back to defaults when stored JSON is malformed', () => {
    storage.setItem(SETTINGS_STORAGE_KEY, '{not json');
    const store = new SettingsStore(storage);
    expect(store.get()).toEqual(DEFAULT_SETTINGS);
  });

  it('fills missing keys from a partial stored schema with defaults', () => {
    storage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ workMinutes: 33, soundEnabled: false }),
    );
    const store = new SettingsStore(storage);
    expect(store.get()).toEqual({
      ...DEFAULT_SETTINGS,
      workMinutes: 33,
      soundEnabled: false,
    });
  });

  it('replaces non-object stored values (e.g. a bare number) with defaults', () => {
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(42));
    const store = new SettingsStore(storage);
    expect(store.get()).toEqual(DEFAULT_SETTINGS);
  });

  it('supports multiple subscribers receiving the same update', () => {
    const store = new SettingsStore(storage);
    const a = vi.fn();
    const b = vi.fn();
    store.subscribe(a);
    store.subscribe(b);
    store.set({ workMinutes: 30 });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });
});
