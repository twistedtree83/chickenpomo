import { describe, expect, it, vi } from 'vitest';
import {
  Notifier,
  type NotificationPermissionState,
  type NotificationProvider,
} from './Notifier';

interface FakeProviderHandle {
  provider: NotificationProvider;
  resolveRequest(state: NotificationPermissionState): void;
  setPermission(state: NotificationPermissionState): void;
  requestCount: number;
  createCalls: Array<{ title: string; body: string }>;
}

function makeFakeProvider(initial: NotificationPermissionState = 'default'): FakeProviderHandle {
  let permission = initial;
  let pendingResolve: ((state: NotificationPermissionState) => void) | null = null;
  const createCalls: Array<{ title: string; body: string }> = [];
  let requestCount = 0;
  const provider: NotificationProvider = {
    get permission(): NotificationPermissionState {
      return permission;
    },
    requestPermission(): Promise<NotificationPermissionState> {
      requestCount += 1;
      return new Promise<NotificationPermissionState>((resolve) => {
        pendingResolve = (state): void => {
          permission = state;
          resolve(state);
        };
      });
    },
    create(title: string, body: string): void {
      createCalls.push({ title, body });
    },
  };
  return {
    provider,
    resolveRequest(state): void {
      if (pendingResolve === null) throw new Error('no pending request');
      const resolver = pendingResolve;
      pendingResolve = null;
      resolver(state);
    },
    setPermission(state): void {
      permission = state;
    },
    get requestCount(): number {
      return requestCount;
    },
    get createCalls(): Array<{ title: string; body: string }> {
      return createCalls;
    },
  };
}

describe('Notifier', () => {
  it('does not invoke the provider factory during construction (no page-load permission prompt)', () => {
    const factory = vi.fn(() => null);
    new Notifier(factory, () => true);
    expect(factory).not.toHaveBeenCalled();
  });

  it('resolves to denied when the platform has no Notification support', async () => {
    const notifier = new Notifier(() => null, () => true);
    await expect(notifier.requestPermission()).resolves.toBe('denied');
  });

  it('requests permission exactly once even when called repeatedly while pending', async () => {
    const handle = makeFakeProvider('default');
    const notifier = new Notifier(() => handle.provider, () => true);

    const first = notifier.requestPermission();
    const second = notifier.requestPermission();
    const third = notifier.requestPermission();

    handle.resolveRequest('granted');

    await expect(first).resolves.toBe('granted');
    await expect(second).resolves.toBe('granted');
    await expect(third).resolves.toBe('granted');
    expect(handle.requestCount).toBe(1);
  });

  it('short-circuits subsequent requests once a decision is recorded', async () => {
    const handle = makeFakeProvider('default');
    const notifier = new Notifier(() => handle.provider, () => true);

    const first = notifier.requestPermission();
    handle.resolveRequest('denied');
    await first;

    await expect(notifier.requestPermission()).resolves.toBe('denied');
    expect(handle.requestCount).toBe(1);
  });

  it('only fires a notification when the document is hidden and permission is granted', () => {
    const handle = makeFakeProvider('granted');
    let hidden = false;
    const notifier = new Notifier(() => handle.provider, () => hidden);

    notifier.notify('Work', 'Time to focus');
    expect(handle.createCalls).toHaveLength(0);

    hidden = true;
    notifier.notify('Work', 'Time to focus');
    expect(handle.createCalls).toEqual([{ title: 'Work', body: 'Time to focus' }]);
  });

  it('does not fire when permission is not granted', () => {
    const handle = makeFakeProvider('denied');
    const notifier = new Notifier(() => handle.provider, () => true);
    notifier.notify('Work', 'Time to focus');
    expect(handle.createCalls).toHaveLength(0);
  });

  it('caches the provider factory result across calls', async () => {
    const handle = makeFakeProvider('granted');
    const factory = vi.fn(() => handle.provider);
    const notifier = new Notifier(factory, () => true);

    await notifier.requestPermission();
    notifier.notify('a', 'b');
    notifier.notify('c', 'd');

    expect(factory).toHaveBeenCalledTimes(1);
  });
});
