export type AudioChirpKind = 'work-start' | 'break-start';

export type AudioContextFactory = () => AudioContext;

interface AudioContextCtor {
  new (): AudioContext;
}

type GlobalWithAudio = {
  AudioContext?: AudioContextCtor;
  webkitAudioContext?: AudioContextCtor;
};

const defaultAudioContextFactory: AudioContextFactory = () => {
  const g = globalThis as unknown as GlobalWithAudio;
  const Ctor = g.AudioContext ?? g.webkitAudioContext;
  if (!Ctor) {
    throw new Error('AudioChirp: Web Audio API is not available in this environment');
  }
  return new Ctor();
};

export type AudioChirpUrls = Readonly<Record<AudioChirpKind, string>>;

export class AudioChirp {
  private readonly factory: AudioContextFactory;
  private ctx: AudioContext | null = null;
  // Raw bytes are cached at load time so we never have to refetch. Decoding
  // is deferred to first play(), which is where the AudioContext is born — we
  // don't want to spin one up at page load and have it sit suspended.
  private readonly encoded = new Map<AudioChirpKind, ArrayBuffer>();
  private readonly decoded = new Map<AudioChirpKind, AudioBuffer>();

  constructor(factory: AudioContextFactory = defaultAudioContextFactory) {
    this.factory = factory;
  }

  // Fetch each clip into memory. Failures are swallowed: a missing file just
  // makes the matching play(kind) a no-op rather than throwing in the rAF
  // loop. Idempotent — kinds already cached are skipped.
  load(urls: AudioChirpUrls): Promise<void> {
    const tasks: Array<Promise<void>> = [];
    for (const kind of Object.keys(urls) as AudioChirpKind[]) {
      if (this.encoded.has(kind) || this.decoded.has(kind)) continue;
      const url = urls[kind];
      tasks.push(
        fetch(url)
          .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${r.status}`))))
          .then((buf) => {
            this.encoded.set(kind, buf);
          })
          .catch(() => undefined),
      );
    }
    return Promise.all(tasks).then(() => undefined);
  }

  play(kind: AudioChirpKind): void {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    const ready = this.decoded.get(kind);
    if (ready !== undefined) {
      this.playBuffer(ctx, ready);
      return;
    }
    const raw = this.encoded.get(kind);
    if (raw === undefined) return;
    // Decode once, then start. `decodeAudioData` consumes (detaches) the
    // ArrayBuffer, so we slice() to keep a copy in case decode fails and we
    // want to retry on a later play().
    void ctx
      .decodeAudioData(raw.slice(0))
      .then((buffer) => {
        this.decoded.set(kind, buffer);
        this.encoded.delete(kind);
        this.playBuffer(ctx, buffer);
      })
      .catch(() => undefined);
  }

  private playBuffer(ctx: AudioContext, buffer: AudioBuffer): void {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    src.start(ctx.currentTime);
  }

  private ensureContext(): AudioContext {
    if (this.ctx === null) {
      this.ctx = this.factory();
    }
    return this.ctx;
  }
}
