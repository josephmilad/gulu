/** Procedural sound effects and a little synth loop — no audio files needed. */
class Sfx {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private noiseBuf!: AudioBuffer;
  private wind: AudioBufferSourceNode | null = null;
  private music: { stop: () => void } | null = null;
  volume = 0.8;

  /** Must be called from a user gesture (browser autoplay rules). */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(ctx.destination);
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  private noise(dur: number, filterType: BiquadFilterType, freq: number, gain: number, q = 1, delay = 0) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.7 + Math.random() * 0.6;
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
    return f;
  }

  private tone(freq: number, dur: number, gain: number, type: OscillatorType = 'sine', slideTo?: number, delay = 0) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /** Volume scaled by distance from the listener. */
  private att(dist: number) {
    return Math.max(0, 1 - dist / 40);
  }

  whoosh(dist = 0) {
    const a = this.att(dist);
    if (a <= 0) return;
    const f = this.noise(0.18, 'bandpass', 900, 0.25 * a, 0.8);
    if (f && this.ctx) f.frequency.exponentialRampToValueAtTime(2400, this.ctx.currentTime + 0.15);
  }

  hit(strength = 1, dist = 0) {
    const a = this.att(dist);
    if (a <= 0) return;
    this.tone(140 + Math.random() * 40, 0.16, 0.6 * strength * a, 'sine', 50);
    this.noise(0.09, 'lowpass', 2200, 0.55 * strength * a);
    this.noise(0.05, 'highpass', 3000, 0.2 * a);
  }

  block(dist = 0) {
    const a = this.att(dist);
    if (a <= 0) return;
    this.noise(0.07, 'bandpass', 1500, 0.4 * a, 3);
    this.tone(320, 0.06, 0.15 * a, 'square', 200);
  }

  thud(dist = 0) {
    const a = this.att(dist);
    if (a <= 0) return;
    this.tone(70, 0.35, 0.7 * a, 'sine', 35);
    this.noise(0.3, 'lowpass', 500, 0.5 * a);
  }

  step(dist = 0) {
    const a = this.att(dist) * 0.5;
    if (a <= 0.02) return;
    this.noise(0.08, 'bandpass', 2600 + Math.random() * 1500, 0.12 * a, 2);
  }

  coin() {
    this.tone(1320, 0.08, 0.18, 'square');
    this.tone(1760, 0.18, 0.18, 'square', undefined, 0.07);
  }

  ui() {
    this.tone(660, 0.07, 0.15, 'triangle');
  }

  confirm() {
    this.tone(440, 0.1, 0.2, 'sawtooth');
    this.tone(880, 0.25, 0.2, 'sawtooth', undefined, 0.08);
  }

  ko() {
    this.tone(200, 0.9, 0.35, 'sawtooth', 50);
    this.thud();
  }

  startWind() {
    const ctx = this.ctx;
    if (!ctx || this.wind) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 400;
    f.Q.value = 0.6;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.12;
    const lg = ctx.createGain();
    lg.gain.value = 250;
    lfo.connect(lg).connect(f.frequency);
    const g = ctx.createGain();
    g.gain.value = 0.07;
    src.connect(f).connect(g).connect(this.master);
    src.start();
    lfo.start();
    this.wind = src;
  }

  /** Minor-key synth-pop loop in the spirit of late-80s Soviet estrada. */
  startMusic(tempo = 112) {
    const ctx = this.ctx;
    if (!ctx || this.music) return;
    const out = ctx.createGain();
    out.gain.value = 0.16;
    const delay = ctx.createDelay();
    delay.delayTime.value = (60 / tempo) * 0.75;
    const fb = ctx.createGain();
    fb.gain.value = 0.3;
    out.connect(this.master);
    out.connect(delay).connect(fb).connect(delay);
    delay.connect(this.master);
    // A minor: Am – F – C – G
    const chords = [
      [57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62],
    ];
    const lead = [76, 74, 72, 71, 72, 74, 76, 79, 77, 76, 74, 72, 74, 72, 71, 67];
    const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
    const beat = 60 / tempo;
    let next = ctx.currentTime + 0.1;
    let step = 0;
    let stopped = false;
    const note = (n: number, t: number, d: number, g: number, type: OscillatorType, cutoff: number) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = midi(n);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = cutoff;
      const gg = ctx.createGain();
      gg.gain.setValueAtTime(0.0001, t);
      gg.gain.exponentialRampToValueAtTime(g, t + 0.02);
      gg.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(f).connect(gg).connect(out);
      o.start(t);
      o.stop(t + d + 0.05);
    };
    const kick = (t: number) => {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(120, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.9, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.25);
    };
    const snare = (t: number) => {
      const s = ctx.createBufferSource();
      s.buffer = this.noiseBuf;
      const f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 1500;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.4, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      s.connect(f).connect(g).connect(out);
      s.start(t, Math.random());
      s.stop(t + 0.2);
    };
    const tick = () => {
      if (stopped) return;
      while (next < ctx.currentTime + 0.25) {
        const s = step % 64;
        const bar = Math.floor(s / 16);
        const ch = chords[bar];
        const e = beat / 4; // sixteenth
        if (s % 4 === 0) kick(next);
        if (s % 8 === 4) snare(next);
        // Octave bass on eighths.
        if (s % 2 === 0) note(ch[0] - 12 + (s % 4 === 2 ? 12 : 0), next, e * 1.8, 0.35, 'sawtooth', 700);
        if (s % 16 === 0) for (const n of ch) note(n, next, beat * 3.8, 0.08, 'square', 1400);
        if (s % 4 === 0 && step >= 64) note(lead[(s / 4) % 16], next, beat * 0.9, 0.12, 'triangle', 3000);
        next += e;
        step++;
      }
      timer = window.setTimeout(tick, 60);
    };
    let timer = window.setTimeout(tick, 0);
    this.music = {
      stop: () => {
        stopped = true;
        clearTimeout(timer);
        out.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
        setTimeout(() => out.disconnect(), 1500);
      },
    };
  }

  stopMusic() {
    this.music?.stop();
    this.music = null;
  }
}

export const sfx = new Sfx();
