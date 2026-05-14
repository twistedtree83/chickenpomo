export type NotificationPermissionState = 'default' | 'granted' | 'denied';

export interface NotificationProvider {
  readonly permission: NotificationPermissionState;
  requestPermission(): Promise<NotificationPermissionState>;
  create(title: string, body: string): void;
}

export type NotificationProviderFactory = () => NotificationProvider | null;

export type VisibilityCheck = () => boolean;

interface NotificationCtor {
  new (title: string, options?: { body?: string }): unknown;
  readonly permission: NotificationPermissionState;
  requestPermission(): Promise<NotificationPermissionState>;
}

type GlobalWithNotification = {
  Notification?: NotificationCtor;
};

const defaultNotificationProviderFactory: NotificationProviderFactory = () => {
  const g = globalThis as unknown as GlobalWithNotification;
  const Ctor = g.Notification;
  if (!Ctor) return null;
  return {
    get permission(): NotificationPermissionState {
      return Ctor.permission;
    },
    requestPermission(): Promise<NotificationPermissionState> {
      return Ctor.requestPermission();
    },
    create(title: string, body: string): void {
      new Ctor(title, { body });
    },
  };
};

const defaultVisibilityCheck: VisibilityCheck = () => {
  const g = globalThis as unknown as { document?: { hidden?: boolean } };
  return g.document?.hidden === true;
};

export class Notifier {
  private readonly providerFactory: NotificationProviderFactory;
  private readonly isHidden: VisibilityCheck;
  private cachedProvider: NotificationProvider | null | undefined = undefined;
  private permissionRequest: Promise<NotificationPermissionState> | null = null;

  constructor(
    providerFactory: NotificationProviderFactory = defaultNotificationProviderFactory,
    isHidden: VisibilityCheck = defaultVisibilityCheck,
  ) {
    this.providerFactory = providerFactory;
    this.isHidden = isHidden;
  }

  async requestPermission(): Promise<NotificationPermissionState> {
    const provider = this.ensureProvider();
    if (provider === null) return 'denied';
    if (provider.permission !== 'default') return provider.permission;
    if (this.permissionRequest !== null) return this.permissionRequest;
    this.permissionRequest = provider.requestPermission().finally(() => {
      this.permissionRequest = null;
    });
    return this.permissionRequest;
  }

  notify(title: string, body: string): void {
    if (!this.isHidden()) return;
    const provider = this.ensureProvider();
    if (provider === null) return;
    if (provider.permission !== 'granted') return;
    provider.create(title, body);
  }

  private ensureProvider(): NotificationProvider | null {
    if (this.cachedProvider === undefined) {
      this.cachedProvider = this.providerFactory();
    }
    return this.cachedProvider;
  }
}
