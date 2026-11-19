import type { FruitKind } from './round';

// Short, locally synthesized effects: no downloads and no microphone access.
export class SliceSound {
  private context: AudioContext | null = null;
  private last = 0;
  muted = false;
  unlock() {
    try {
      this.context ??= new AudioContext();
      void this.context.resume().catch(() => {});
    } catch { /* Audio is optional; play remains available without an audio device. */ }
  }
  play(kind: FruitKind) {
    const ctx = this.context;
    if (!ctx || ctx.state !== 'running' || this.muted || ctx.currentTime - this.last < .035) return;
    const now = ctx.currentTime; this.last = now;
    const duration = kind === 'melon' ? .18 : .12;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const noise = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    noise.buffer = buffer; filter.type = 'lowpass';
    filter.frequency.setValueAtTime(kind === 'melon' ? 1100 : 6500, now);
    filter.frequency.exponentialRampToValueAtTime(180, now + duration);
    gain.gain.setValueAtTime(.25, now); gain.gain.exponentialRampToValueAtTime(.001, now + duration);
    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(now); noise.stop(now + duration);
    noise.onended = () => { noise.disconnect(); filter.disconnect(); gain.disconnect(); };
    const tone = ctx.createOscillator(), envelope = ctx.createGain();
    tone.frequency.setValueAtTime(kind === 'melon' ? 180 : 760, now);
    tone.frequency.exponentialRampToValueAtTime(kind === 'melon' ? 55 : 280, now + duration);
    envelope.gain.setValueAtTime(.09, now); envelope.gain.exponentialRampToValueAtTime(.001, now + duration);
    tone.connect(envelope).connect(ctx.destination); tone.start(now); tone.stop(now + duration);
    tone.onended = () => { tone.disconnect(); envelope.disconnect(); };
  }
  dispose() { void this.context?.close(); this.context = null; }
}
