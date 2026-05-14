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

const FREQUENCY_BY_KIND: Readonly<Record<AudioChirpKind, number>> = Object.freeze({
  'work-start': 880,
  'break-start': 660,
});

const ATTACK_SECONDS = 0.01;
const DECAY_SECONDS = 0.18;
const PEAK_GAIN = 0.2;
const TAIL_SECONDS = 0.02;

export class AudioChirp {
  private readonly factory: AudioContextFactory;
  private ctx: AudioContext | null = null;

  constructor(factory: AudioContextFactory = defaultAudioContextFactory) {
    this.factory = factory;
  }

  play(kind: AudioChirpKind): void {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = FREQUENCY_BY_KIND[kind];

    const startAt = ctx.currentTime;
    const peakAt = startAt + ATTACK_SECONDS;
    const endAt = peakAt + DECAY_SECONDS;

    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(PEAK_GAIN, peakAt);
    gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startAt);
    osc.stop(endAt + TAIL_SECONDS);
  }

  private ensureContext(): AudioContext {
    if (this.ctx === null) {
      this.ctx = this.factory();
    }
    return this.ctx;
  }
}
